import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { BiddingService } from './services/bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ListBidsAdminQueryDto } from './dto/list-bids-admin.query.dto';

@ApiTags('bidding')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class BiddingController {
  private readonly logger = new Logger(BiddingController.name);

  constructor(
    private readonly biddingService: BiddingService,
    private readonly auctionLifecycleService: AuctionLifecycleService,
  ) {}

  // ─── USER: place a bid ────────────────────────────────────────────────────

  @Post('products/:id/bids')
  @RequirePermissions(Permission.BID_PLACE)
  @ApiOperation({
    summary: 'Place a bid on a product (email-verified USER only)',
  })
  async placeBid(
    @Param('id') productId: string,
    @Body() dto: PlaceBidDto,
    @Request() req: RequestWithUser,
  ) {
    // Defense-in-depth: close the auction if its timer expired before this bid arrives.
    // Failures are non-fatal — placeBid re-validates product status inside its own transaction.
    try {
      await this.auctionLifecycleService.closeIfExpired(productId);
    } catch (err: unknown) {
      this.logger.warn(
        `Pre-bid closeIfExpired failed for product ${productId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.biddingService.placeBid(req.user.sub, productId, dto);
  }

  // ─── USER: bid history for a product ─────────────────────────────────────

  @Get('products/:id/bids')
  @RequirePermissions(Permission.BID_VIEW_OWN)
  @ApiOperation({
    summary:
      'Get bid history for a product. Admins receive full metadata; users see names only.',
  })
  async getBidsForProduct(
    @Param('id') productId: string,
    @Request() req: RequestWithUser,
  ) {
    const viewerType = req.user.permissions.includes(Permission.BID_VIEW_ALL)
      ? 'admin'
      : 'authenticated';
    return this.biddingService.getBidsForProduct(productId, viewerType);
  }

  // ─── USER: my bids ────────────────────────────────────────────────────────

  @Get('bids/me')
  @RequirePermissions(Permission.BID_VIEW_OWN)
  @ApiOperation({ summary: "Get the authenticated user's own bid history" })
  async getMyBids(
    @Request() req: RequestWithUser,
    @Query() query: PaginationDto,
  ) {
    return this.biddingService.getMyBids(req.user.sub, query);
  }

  // ─── ADMIN: full bid history with metadata ────────────────────────────────

  @Get('admin/products/:id/bids')
  @RequirePermissions(Permission.BID_VIEW_ALL)
  @ApiOperation({
    summary:
      'Admin: get full bid history for a product (includes emails and metadata)',
  })
  async adminGetBidsForProduct(@Param('id') productId: string) {
    return this.biddingService.getBidsForProduct(productId, 'admin');
  }

  // ─── ADMIN: confirm payment manually ─────────────────────────────────────

  @Post('admin/products/:id/confirm-payment')
  @RequirePermissions(Permission.PAYMENT_CONFIRM_MANUAL)
  @ApiOperation({
    summary:
      'Admin: manually confirm payment for the currently-responsible bid, settling the auction',
  })
  async confirmPayment(
    @Param('id') productId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.auctionLifecycleService.confirmPaymentManual(
      req.user.sub,
      productId,
    );
  }

  // ─── ADMIN: list all bids with filters ────────────────────────────────────

  @Get('admin/bids')
  @RequirePermissions(Permission.BID_VIEW_ALL)
  @ApiOperation({
    summary: 'Admin: list all bids with optional filters and pagination',
  })
  async listAllBids(@Query() query: ListBidsAdminQueryDto) {
    return this.biddingService.listAllBids(query);
  }
}
