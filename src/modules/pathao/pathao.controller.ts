import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { ListDeliveriesQueryDto } from './dto/delivery-view.dto';

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

  @Get('deliveries/quote')
  @ApiOperation({
    summary:
      'Delivery fee and the Pathao city ids we deliver to — shown at checkout before an address is chosen',
  })
  quote() {
    return this.productDeliveriesService.quote();
  }

  @Get('pathao/cities')
  @ApiOperation({ summary: 'List Pathao cities (for the address picker)' })
  async getCities() {
    return this.pathaoClientService.getCities();
  }

  @Get('pathao/cities/:cityId/zones')
  @ApiOperation({ summary: 'List Pathao zones within a city' })
  async getZones(@Param('cityId', ParseIntPipe) cityId: number) {
    return this.pathaoClientService.getZones(cityId);
  }

  @Get('pathao/zones/:zoneId/areas')
  @ApiOperation({ summary: 'List Pathao areas within a zone' })
  async getAreas(@Param('zoneId', ParseIntPipe) zoneId: number) {
    return this.pathaoClientService.getAreas(zoneId);
  }

  // ─── Admin: delivery lifecycle ─────────────────────────────────────────

  @Get('admin/deliveries')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({
    summary: 'Admin: list deliveries, newest first, optionally by stage',
  })
  async listAll(@Query() query: ListDeliveriesQueryDto) {
    return this.productDeliveriesService.listAll(query);
  }

  @Get('admin/deliveries/:id')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: 'Admin: get one delivery' })
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productDeliveriesService.getOne(id);
  }

  @Post('admin/deliveries/:id/received')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: 'Admin: mark an item received at the warehouse' })
  async markReceived(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchDeliveryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.productDeliveriesService.dispatch(id, req.user.sub, dto);
  }

  @Post('admin/deliveries/:id/sync')
  @RequirePermissions(Permission.SHIPMENT_MANAGE)
  @ApiOperation({ summary: "Admin: refresh a delivery's status from Pathao" })
  async sync(@Param('id', ParseUUIDPipe) id: string) {
    return this.productDeliveriesService.syncStatus(id);
  }
}
