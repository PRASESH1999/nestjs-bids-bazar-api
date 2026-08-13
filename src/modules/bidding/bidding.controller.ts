import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Observable, concat, defer, from, map } from 'rxjs';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PUBLICLY_VISIBLE_STATUSES } from '@common/enums/product-status.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Product } from '@modules/products/entities/product.entity';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { AuctionBroadcastService } from './services/auction-broadcast.service';
import { BiddingService } from './services/bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ListBidsAdminQueryDto } from './dto/list-bids-admin.query.dto';
import { ConfirmPaymentManualDto } from './dto/confirm-payment-manual.dto';

@ApiTags('bidding')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class BiddingController {
  private readonly logger = new Logger(BiddingController.name);

  constructor(
    private readonly biddingService: BiddingService,
    private readonly auctionLifecycleService: AuctionLifecycleService,
    private readonly auctionBroadcastService: AuctionBroadcastService,
    private readonly dataSource: DataSource,
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

  // ─── USER: instant buy ────────────────────────────────────────────────────

  @Post('products/:id/instant-buy')
  @RequirePermissions(Permission.BID_PLACE)
  @ApiOperation({
    summary:
      'Instant Buy: immediately purchase at instantBuyPrice, closing the auction. No fallback to other bidders under any circumstance.',
  })
  async instantBuy(
    @Param('id') productId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.auctionLifecycleService.executeInstantBuy(
      productId,
      req.user.sub,
    );
  }

  // ─── PUBLIC: SSE live-update stream for the product detail page ──────────

  @Sse('products/:id/events')
  @Public()
  @ApiOperation({
    summary:
      'Server-Sent Events stream of live auction updates for the product detail page (public; unauthenticated visitors may connect).',
  })
  async streamProductEvents(
    @Param('id') productId: string,
  ): Promise<Observable<MessageEvent>> {
    // Visibility guard: never open a stream for a non-publicly-visible product.
    // Query the Product repo directly via DataSource to match the existing
    // pattern in this module (bidding services already read Product this way),
    // avoiding a circular ProductsModule ↔ BiddingModule import.
    const product = await this.dataSource
      .getRepository(Product)
      .findOne({ where: { id: productId } });

    if (!product || !PUBLICLY_VISIBLE_STATUSES.includes(product.status)) {
      throw new NotFoundException('Product not found');
    }

    // Initial snapshot — emitted once on connect so a freshly-connected client
    // is never blank until the next event fires. `defer` keeps the build lazy
    // per-subscriber, then `concat` continues with the live stream.
    const initial$ = defer(() =>
      from(this.auctionBroadcastService.buildPayload(productId)).pipe(
        map((payload): MessageEvent => ({ data: payload })),
      ),
    );

    return concat(initial$, this.auctionBroadcastService.streamFor(productId));
  }

  // ─── USER: bid history for a product ─────────────────────────────────────

  @Get('products/:id/bids')
  @RequirePermissions(Permission.BID_VIEW_OWN, Permission.BID_VIEW_ALL)
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
    @Body() dto: ConfirmPaymentManualDto,
    @Request() req: RequestWithUser,
  ) {
    return this.auctionLifecycleService.confirmPaymentManual(
      req.user.sub,
      productId,
      dto.deliveryZone,
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
