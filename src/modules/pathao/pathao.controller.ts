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
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PathaoClientService } from './services/pathao-client.service';
import { ProductDeliveriesService } from './services/product-deliveries.service';
import { DispatchDeliveryDto } from './dto/pathao.dto';

@ApiTags('pathao')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class PathaoController {
  constructor(
    private readonly pathaoClientService: PathaoClientService,
    private readonly productDeliveriesService: ProductDeliveriesService,
  ) {}

  // ─── Location lookups (proxied — credentials never reach the frontend) ────
  // No special permission: same trust level as reaching checkout/address
  // screens (just the default JWT auth every route already requires).

  @Get('pathao/cities')
  @ApiOperation({ summary: 'List Pathao cities (for the address picker)' })
  async getCities() {
    return this.pathaoClientService.getCities();
  }

  @Get('pathao/cities/:cityId/zones')
  @ApiOperation({ summary: 'List Pathao zones within a city' })
  async getZones(@Param('cityId') cityId: string) {
    return this.pathaoClientService.getZones(Number(cityId));
  }

  @Get('pathao/zones/:zoneId/areas')
  @ApiOperation({ summary: 'List Pathao areas within a zone' })
  async getAreas(@Param('zoneId') zoneId: string) {
    return this.pathaoClientService.getAreas(Number(zoneId));
  }

  // ─── Admin: delivery lifecycle ─────────────────────────────────────────

  @Get('admin/deliveries')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: 'Admin: list deliveries, paginated' })
  async listAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.productDeliveriesService.listAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('admin/deliveries/:id')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: 'Admin: get one delivery' })
  async getOne(@Param('id') id: string) {
    return this.productDeliveriesService.getOne(id);
  }

  @Post('admin/deliveries/:id/received')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: 'Admin: mark an item received at the warehouse' })
  async markReceived(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.productDeliveriesService.markReceivedAtWarehouse(
      id,
      req.user.sub,
    );
  }

  @Post('admin/deliveries/:id/dispatch')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({
    summary: 'Admin: create the Pathao order (warehouse -> buyer)',
  })
  async dispatch(
    @Param('id') id: string,
    @Body() dto: DispatchDeliveryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.productDeliveriesService.dispatch(id, req.user.sub, dto);
  }

  @Post('admin/deliveries/:id/sync')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: "Admin: refresh a delivery's status from Pathao" })
  async sync(@Param('id') id: string) {
    return this.productDeliveriesService.syncStatus(id);
  }
}
