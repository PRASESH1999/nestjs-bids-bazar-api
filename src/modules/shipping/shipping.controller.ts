import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { R400, R401, R404 } from '@common/swagger/api-responses';
import { MAX_SHIPPING_ADDRESSES } from './entities/shipping-address.entity';
import {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/shipping-address.dto';
import { ShippingService } from './shipping.service';

/**
 * Saved delivery addresses, always scoped to the caller.
 *
 * No permission decorator and no `:userId` anywhere: every route reads the id
 * from the JWT, so there is no shape of request that reaches another person's
 * addresses.
 */
@ApiTags('shipping')
@ApiBearerAuth()
@Controller('users/me/shipping-addresses')
@UseGuards(PermissionsGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({
    summary: 'List your saved delivery addresses (default first)',
  })
  @ApiResponse(R401)
  async list(@Request() req: RequestWithUser) {
    return this.shippingService.list(req.user.sub);
  }

  @Post()
  @ApiOperation({
    summary: `Save a delivery address (max ${MAX_SHIPPING_ADDRESSES} per account)`,
  })
  @ApiResponse({ status: 201, description: 'The saved address.' })
  @ApiResponse({
    status: 400,
    description: `Refused when the account already has ${MAX_SHIPPING_ADDRESSES}.`,
  })
  @ApiResponse(R401)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateShippingAddressDto,
  ) {
    return this.shippingService.create(req.user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one of your saved delivery addresses' })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R404)
  async update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateShippingAddressDto,
  ) {
    return this.shippingService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete one of your saved delivery addresses. Past orders keep the address they were shipped to.',
  })
  @ApiResponse(R401)
  @ApiResponse(R404)
  async remove(@Request() req: RequestWithUser, @Param('id') id: string) {
    await this.shippingService.remove(req.user.sub, id);
    return { success: true };
  }
}
