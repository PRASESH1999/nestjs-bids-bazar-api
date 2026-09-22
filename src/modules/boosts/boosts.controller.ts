import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Permission } from '@common/enums/permission.enum';
import { OptionalJwtGuard } from '@common/guards/optional-jwt.guard';
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

  @Get('boosts/featured')
  @Public()
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Featured section: boosted products, latest boost first. A product ' +
      'stays featured until its boost window or its auction ends, whichever ' +
      'comes first.',
  })
  async getFeatured(@Query() query: PaginationDto) {
    return this.boostsService.listFeatured(query.page ?? 1, query.limit ?? 20);
  }

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
