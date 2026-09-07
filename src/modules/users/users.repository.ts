import { NEVER_LISTED_STATUSES } from '@common/enums/product-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';

@Injectable()
export class UsersRepository {
  private readonly repo: Repository<User>;
  private readonly productRepo: Repository<Product>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(User);
    this.productRepo = this.dataSource.getRepository(Product);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
      .withDeleted()
      .getOne();
  }

  /** Atomically claims the next value from the `username_seq` Postgres sequence. */
  async nextUsernameSequenceValue(): Promise<number> {
    const [{ seq }] = await this.dataSource.query<{ seq: string }[]>(
      "SELECT nextval('username_seq') AS seq",
    );
    return Number(seq);
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  // Single IN query for the whole batch — used to attach seller rating
  // aggregates to a list of products without one lookup per owner.
  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.repo.find({
      where: { id: In(ids) },
      select: {
        id: true,
        username: true,
        averageRating: true,
        ratingCount: true,
      },
    });
  }

  // Grouped, single-query count per seller — never computed/stored per
  // product, and never one query per seller. `totalListings` counts every
  // product that was ever approved and went public (see NEVER_LISTED_STATUSES);
  // `totalSold` counts only SETTLED (fully completed) sales.
  async countListingsAndSalesBySeller(
    sellerIds: string[],
  ): Promise<Map<string, { totalListings: number; totalSold: number }>> {
    if (sellerIds.length === 0) return new Map();

    const rows = await this.productRepo
      .createQueryBuilder('product')
      .select('product.ownerId', 'ownerId')
      .addSelect(
        'COUNT(*) FILTER (WHERE product.status NOT IN (:...neverListed))',
        'totalListings',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE product.status = 'SETTLED')",
        'totalSold',
      )
      .where('product.ownerId IN (:...sellerIds)', { sellerIds })
      .setParameter('neverListed', NEVER_LISTED_STATUSES)
      .groupBy('product.ownerId')
      .getRawMany<{
        ownerId: string;
        totalListings: string;
        totalSold: string;
      }>();

    return new Map(
      rows.map((row) => [
        row.ownerId,
        {
          totalListings: Number(row.totalListings),
          totalSold: Number(row.totalSold),
        },
      ]),
    );
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.repo.findOneBy({ googleId });
  }

  async findByFacebookId(facebookId: string): Promise<User | null> {
    return this.repo.findOneBy({ facebookId });
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
