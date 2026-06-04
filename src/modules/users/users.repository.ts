import { User } from '@modules/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';

@Injectable()
export class UsersRepository {
  private readonly repo: Repository<User>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email }, withDeleted: true });
  }

  /**
   * Case-insensitive username lookup against active (non-soft-deleted) users.
   * Pass `excludeUserId` to ignore a specific user (used by the change endpoint
   * so a user is not considered to be in conflict with themselves).
   */
  async findByUsername(
    username: string,
    excludeUserId?: string,
  ): Promise<User | null> {
    const qb = this.repo
      .createQueryBuilder('user')
      .where('LOWER(user.username) = :username', {
        username: username.trim().toLowerCase(),
      });
    if (excludeUserId) {
      qb.andWhere('user.id != :excludeUserId', { excludeUserId });
    }
    return qb.getOne();
  }

  /**
   * Case-insensitive username lookup including soft-deleted users. Used at
   * registration: the DB unique constraint covers soft-deleted rows too, so a
   * pre-flight check must see them to surface a clean conflict.
   */
  async findByUsernameIncludingDeleted(username: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .withDeleted()
      .where('LOWER(user.username) = :username', {
        username: username.trim().toLowerCase(),
      })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async saveUser(user: User, queryRunner?: QueryRunner): Promise<User> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(User)
      : this.repo;
    return repo.save(user);
  }

  async updateUser(
    id: string,
    data: Partial<User>,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(User)
      : this.repo;
    await repo.update(id, data);
  }

  async softDeleteUser(user: User): Promise<void> {
    await this.repo.softRemove(user);
  }

  async findAllPaginated(
    page: number,
    limit: number,
    roles?: string[],
  ): Promise<[User[], number]> {
    const queryBuilder = this.repo.createQueryBuilder('user');

    if (roles && roles.length > 0) {
      queryBuilder.andWhere('user.role IN (:...roles)', { roles });
    }

    return queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();
  }

  createEntity(data: Partial<User>): User {
    return this.repo.create(data);
  }
}
