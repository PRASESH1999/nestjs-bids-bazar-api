import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ReportStatus } from '@common/enums/report-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { ProductReport } from './entities/product-report.entity';

export interface ReportFilters {
  status?: ReportStatus;
  reportedUserId?: string;
}

@Injectable()
export class ReportsRepository {
  private readonly repo: Repository<ProductReport>;
  private readonly productRepo: Repository<Product>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(ProductReport);
    this.productRepo = this.dataSource.getRepository(Product);
  }

  async findProductById(productId: string): Promise<Product | null> {
    return this.productRepo.findOneBy({ id: productId });
  }

  async findOne(
    reporterId: string,
    productId: string,
  ): Promise<ProductReport | null> {
    return this.repo.findOneBy({ reporterId, productId });
  }

  async findById(id: string): Promise<ProductReport | null> {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<ProductReport>): ProductReport {
    return this.repo.create(data);
  }

  async save(report: ProductReport): Promise<ProductReport> {
    return this.repo.save(report);
  }

  // Rolling-window rate limit — counts this reporter's reports created since
  // `since`, regardless of which product. No throttler dependency: see
  // ReportsService for why (the global ThrottlerGuard is disabled, and
  // @nestjs/throttler tracks by IP, not by authenticated user).
  async countByReporterSince(reporterId: string, since: Date): Promise<number> {
    return this.repo.count({
      where: { reporterId, createdAt: MoreThanOrEqual(since) },
    });
  }

  async findPaginated(
    page: number,
    limit: number,
    filters: ReportFilters,
  ): Promise<[ProductReport[], number]> {
    const qb = this.repo
      .createQueryBuilder('report')
      .orderBy('report.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('report.status = :status', { status: filters.status });
    }
    if (filters.reportedUserId) {
      qb.andWhere('report.reportedUserId = :reportedUserId', {
        reportedUserId: filters.reportedUserId,
      });
    }

    return qb.getManyAndCount();
  }
}
