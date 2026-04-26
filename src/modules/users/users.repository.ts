import { Injectable } from '@nestjs/common';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';

@Injectable()
export class UsersRepository {
  private readonly repo: Repository<User>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
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
