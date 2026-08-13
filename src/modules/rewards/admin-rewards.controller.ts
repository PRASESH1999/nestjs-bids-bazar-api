import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { RewardsService } from './rewards.service';
import { AdjustPointsDto } from './dto/adjust-points.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminRewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('payments/pending-settlement')
  @RequirePermissions(Permission.SETTLEMENT_MANAGE)
  @ApiOperation({
    summary:
      'List successfully-paid sales where the seller has not yet been marked paid',
  })
  async listPendingSettlements() {
    return this.rewardsService.listPendingSettlements();
  }

  @Post('payments/:id/mark-seller-paid')
  @RequirePermissions(Permission.SETTLEMENT_MANAGE)
  @ApiOperation({
    summary:
      'Admin: flag that the seller has been paid offline for this sale — the sole trigger for buyer/seller points and commission',
  })
  async markSellerPaid(
    @Param('id') paymentId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.rewardsService.markSellerPaid(paymentId, req.user.sub);
  }

  @Post('users/:userId/points/adjust')
  @RequirePermissions(Permission.POINTS_ADJUST)
  @ApiOperation({
    summary:
      "Admin: manually credit/debit a user's buyer or seller points, with a required reason",
  })
  async adjustPoints(
    @Param('userId') userId: string,
    @Body() dto: AdjustPointsDto,
  ) {
    return this.rewardsService.adjustPoints(
      userId,
      dto.type,
      dto.delta,
      dto.reason,
    );
  }
}
