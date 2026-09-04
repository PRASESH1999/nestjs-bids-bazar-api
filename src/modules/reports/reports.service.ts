import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_LISTING_STATUSES,
  PUBLICLY_VISIBLE_STATUSES,
} from '@common/enums/product-status.enum';
import { ReportStatus } from '@common/enums/report-status.enum';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { ProductReport } from './entities/product-report.entity';
import { ReportFilters, ReportsRepository } from './reports.repository';

// At most this many reports per reporter within the rolling window below.
const MAX_REPORTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReportResponse {
  id: string;
  reporterId: string;
  productId: string;
  reportedUserId: string;
  remarks: string;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async reportProduct(
    reporterId: string,
    productId: string,
    remarks: string,
  ): Promise<ReportResponse> {
    const product = await this.reportsRepository.findProductById(productId);
    // Masked as 404 rather than leaking that a non-public product exists —
    // same visibility rule as the product detail page and Favorites.
    if (!product || !PUBLICLY_VISIBLE_STATUSES.includes(product.status)) {
      throw new NotFoundException('Product not found');
    }

    if (!ACTIVE_LISTING_STATUSES.includes(product.status)) {
      throw new BadRequestException(
        'This product is no longer active and cannot be reported',
      );
    }

    if (product.ownerId === reporterId) {
      throw new ForbiddenException('You cannot report your own product');
    }

    const existing = await this.reportsRepository.findOne(
      reporterId,
      productId,
    );
    if (existing) {
      throw new ConflictException('You have already reported this product');
    }

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await this.reportsRepository.countByReporterSince(
      reporterId,
      since,
    );
    if (recentCount >= MAX_REPORTS_PER_WINDOW) {
      throw new HttpException(
        'You have submitted too many reports in the last 24 hours. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The unique (reporterId, productId) index is the final backstop against
    // a concurrent double-report race — a 23505 from it is mapped to the
    // same 409 by the global exception filter.
    const report = this.reportsRepository.create({
      reporterId,
      productId,
      reportedUserId: product.ownerId,
      remarks,
    });
    const saved = await this.reportsRepository.save(report);

    return this.mapReport(saved);
  }

  async listReports(
    page: number,
    limit: number,
    filters: ReportFilters,
  ): Promise<PaginatedResult<ReportResponse>> {
    const [reports, total] = await this.reportsRepository.findPaginated(
      page,
      limit,
      filters,
    );
    return {
      data: reports.map((r) => this.mapReport(r)),
      meta: { page, limit, total },
    };
  }

  async updateStatus(
    id: string,
    status: ReportStatus,
    adminNote?: string,
  ): Promise<ReportResponse> {
    const report = await this.reportsRepository.findById(id);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = status;
    if (adminNote !== undefined) {
      report.adminNote = adminNote;
    }

    const saved = await this.reportsRepository.save(report);
    return this.mapReport(saved);
  }

  private mapReport(report: ProductReport): ReportResponse {
    return {
      id: report.id,
      reporterId: report.reporterId,
      productId: report.productId,
      reportedUserId: report.reportedUserId,
      remarks: report.remarks,
      status: report.status,
      adminNote: report.adminNote,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
