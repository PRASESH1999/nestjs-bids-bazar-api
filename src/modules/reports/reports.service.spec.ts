import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { Permission } from '@common/enums/permission.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { ReportStatus } from '@common/enums/report-status.enum';
import { Role } from '@common/enums/role.enum';
import { RolePermissionsMap } from '@modules/auth/role-permissions.map';
import { Product } from '@modules/products/entities/product.entity';
import { ProductReport } from './entities/product-report.entity';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

const mockReportsRepository = {
  findProductById: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  countByReporterSince: jest.fn(),
  findPaginated: jest.fn(),
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    ownerId: 'seller-1',
    title: 'Test product',
    description: 'A product long enough to pass validation.',
    specifications: null,
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    condition: ItemCondition.NEW,
    status: ProductStatus.ACTIVE,
    basePrice: 1000,
    biddingStartPrice: 1200,
    instantBuyPrice: 1400,
    currency: 'NPR',
    biddingDurationHours: 72,
    currentHighestBid: null,
    currentHighestBidderId: null,
    biddingStartedAt: null,
    biddingEndsAt: null,
    viewCount: 0,
    isRare: false,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    province: null,
    district: null,
    city: null,
    street: null,
    wardNumber: null,
    winningBidId: null,
    closedAt: null,
    settledAt: null,
    abandonedAt: null,
    withdrawnAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    images: [],
    ...overrides,
  };
}

function makeReport(overrides: Partial<ProductReport> = {}): ProductReport {
  return {
    id: 'report-1',
    reporterId: 'reporter-1',
    productId: 'product-1',
    reportedUserId: 'seller-1',
    remarks: 'This looks fake.',
    status: ReportStatus.PENDING,
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as ProductReport;
}

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = new ReportsService(
      mockReportsRepository as unknown as ReportsRepository,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('reportProduct', () => {
    it('creates a report against the product owner for an active, publicly visible product', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.ACTIVE, ownerId: 'seller-1' }),
      );
      mockReportsRepository.findOne.mockResolvedValue(null);
      mockReportsRepository.countByReporterSince.mockResolvedValue(0);
      const created = makeReport();
      mockReportsRepository.create.mockReturnValue(created);
      mockReportsRepository.save.mockResolvedValue(created);

      const result = await service.reportProduct(
        'reporter-1',
        'product-1',
        'This looks fake.',
      );

      expect(mockReportsRepository.create).toHaveBeenCalledWith({
        reporterId: 'reporter-1',
        productId: 'product-1',
        reportedUserId: 'seller-1',
        remarks: 'This looks fake.',
      });
      expect(result.reportedUserId).toBe('seller-1');
      expect(result.status).toBe(ReportStatus.PENDING);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(null);

      await expect(
        service.reportProduct('reporter-1', 'missing-product', 'remarks'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the product is not publicly visible (e.g. still DRAFT)', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.DRAFT }),
      );

      await expect(
        service.reportProduct('reporter-1', 'product-1', 'remarks'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when reporting an inactive/closed product (e.g. CLOSED)', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.CLOSED }),
      );

      await expect(
        service.reportProduct('reporter-1', 'product-1', 'remarks'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the reporter is the product owner', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(
        makeProduct({ ownerId: 'reporter-1' }),
      );

      await expect(
        service.reportProduct('reporter-1', 'product-1', 'remarks'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when this reporter already reported this product', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(makeProduct());
      mockReportsRepository.findOne.mockResolvedValue(makeReport());

      await expect(
        service.reportProduct('reporter-1', 'product-1', 'remarks'),
      ).rejects.toThrow(ConflictException);
      expect(mockReportsRepository.create).not.toHaveBeenCalled();
    });

    it('throws a 429 HttpException once the reporter hits 10 reports in the last 24 hours', async () => {
      mockReportsRepository.findProductById.mockResolvedValue(makeProduct());
      mockReportsRepository.findOne.mockResolvedValue(null);
      mockReportsRepository.countByReporterSince.mockResolvedValue(10);

      await expect(
        service.reportProduct('reporter-1', 'product-1', 'remarks'),
      ).rejects.toThrow(HttpException);

      try {
        await service.reportProduct('reporter-1', 'product-1', 'remarks');
        fail('expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      expect(mockReportsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('listReports', () => {
    it('maps paginated reports with meta', async () => {
      mockReportsRepository.findPaginated.mockResolvedValue([
        [makeReport()],
        1,
      ]);

      const result = await service.listReports(1, 20, {});

      expect(mockReportsRepository.findPaginated).toHaveBeenCalledWith(
        1,
        20,
        {},
      );
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(result.data[0].id).toBe('report-1');
    });
  });

  describe('updateStatus', () => {
    it('updates status and adminNote', async () => {
      const existing = makeReport();
      mockReportsRepository.findById.mockResolvedValue(existing);
      mockReportsRepository.save.mockImplementation((r: ProductReport) =>
        Promise.resolve(r),
      );

      const result = await service.updateStatus(
        'report-1',
        ReportStatus.ACTION_TAKEN,
        'Seller warned',
      );

      expect(result.status).toBe(ReportStatus.ACTION_TAKEN);
      expect(result.adminNote).toBe('Seller warned');
    });

    it('throws NotFoundException when the report does not exist', async () => {
      mockReportsRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', ReportStatus.DISMISSED),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

describe('Reports permissions', () => {
  it('grants REPORT_SUBMIT to USER but not REPORT_MANAGE', () => {
    expect(RolePermissionsMap[Role.USER]).toContain(Permission.REPORT_SUBMIT);
    expect(RolePermissionsMap[Role.USER]).not.toContain(
      Permission.REPORT_MANAGE,
    );
  });

  it('grants REPORT_MANAGE to ADMIN (list/update-status are admin-only)', () => {
    expect(RolePermissionsMap[Role.ADMIN]).toContain(Permission.REPORT_MANAGE);
  });
});
