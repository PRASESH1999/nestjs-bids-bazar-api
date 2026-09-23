import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InitiateBoostDto } from './dto/boost.dto';
import { ListBoostItemsAdminQueryDto } from './dto/list-boost-items-admin.query.dto';
import { ListBoostPaymentsAdminQueryDto } from './dto/list-boost-payments-admin.query.dto';
import { BoostsService } from './services/boosts.service';

@ApiTags('boosts')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class BoostsController {
  constructor(private readonly boostsService: BoostsService) {}

  // ─── Public endpoints ───────────────────────────────────────────────────

  @Get('boosts/plans')
  @Public()
  @ApiOperation({ summary: 'List available boost plans (scheme, days, price)' })
  getPlans() {
    return this.boostsService.getPlans();
  }

  // Featured-section listing lives on ProductsController
  // (GET /products/home/featured) so it renders through the same home-page
  // product-card pipeline as trending/new-arrivals/rare-items — see
  // BoostsService.getFeaturedProductIds for the underlying query.

  // ─── Seller endpoints ─────────────────────────────────────────────────────

  @Post('boosts/:productId/initiate')
  @RequirePermissions(Permission.BOOST_MANAGE_OWN)
  @ApiOperation({
    summary: 'Purchase a boost for own product (generates a Fonepay QR)',
  })
  async initiateBoost(
    @Param('productId') productId: string,
    @Body() dto: InitiateBoostDto,
    @Request() req: RequestWithUser,
  ) {
    return this.boostsService.initiateBoost(
      productId,
      req.user.sub,
      dto.scheme,
    );
  }

  /*
   * The seller's own boost history, every status.
   *
   * `GET /boosts/:productId/status` only ever answers "the latest boost on this
   * one lot", so there was no way for a seller to see what they had bought or
   * spent across their listings. This is the admin list with the seller forced
   * to the caller — the same filters and sort, and no way to aim it at anyone
   * else's boosts, because `sellerId` is overwritten rather than trusted.
   *
   * Declared before `boosts/:productId/status`. The segment counts differ so
   * there is no ambiguity today, but keeping static routes above parameterised
   * ones means a later `boosts/:productId` cannot swallow "me".
   */
  @Get('boosts/me')
  @RequirePermissions(Permission.BOOST_MANAGE_OWN)
  @ApiOperation({
    summary: "List the calling seller's boosts (all statuses, paginated)",
  })
  async listMyBoosts(
    @Query() query: ListBoostItemsAdminQueryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.boostsService.listAllBoostItems({
      ...query,
      sellerId: req.user.sub,
    });
  }

  @Get('boosts/:productId/status')
  @RequirePermissions(Permission.BOOST_MANAGE_OWN)
  @ApiOperation({
    summary:
      "Get the calling seller's latest boost payment status for a product " +
      '(reconciles with Fonepay if PENDING)',
  })
  async getStatus(
    @Param('productId') productId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.boostsService.getStatus(productId, req.user.sub);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/boosts')
  @RequirePermissions(Permission.BOOST_VIEW_ALL)
  @ApiOperation({
    summary: 'Admin: list all boost items with optional filters and pagination',
  })
  async listAllBoosts(@Query() query: ListBoostItemsAdminQueryDto) {
    return this.boostsService.listAllBoostItems(query);
  }

  @Get('admin/boosts/payments')
  @RequirePermissions(Permission.BOOST_VIEW_ALL)
  @ApiOperation({
    summary:
      'Admin: list all boost payment records (includes failed/expired attempts)',
  })
  async listAllBoostPayments(@Query() query: ListBoostPaymentsAdminQueryDto) {
    return this.boostsService.listAllBoostPayments(query);
  }
}
