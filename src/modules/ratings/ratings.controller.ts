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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { R401, R403, R404, R409 } from '@common/swagger/api-responses';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller()
@UseGuards(PermissionsGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post('ratings/payments/:paymentId')
  @ApiBearerAuth()
  @RequirePermissions(Permission.RATING_SUBMIT)
  @ApiOperation({
    summary: 'Rate the seller for a completed transaction',
    description:
      'Only the buyer on a SUCCESS payment may rate it, and only once. Ratings are immutable — there is no edit or delete route.',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  async rateSeller(
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRatingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.ratingsService.rateSeller(
      req.user.sub,
      paymentId,
      dto.rating,
      dto.remarks,
    );
  }

  @Get('sellers/:sellerId/ratings')
  @Public()
  @ApiOperation({ summary: "List a seller's ratings" })
  async listSellerRatings(
    @Param('sellerId') sellerId: string,
    @Query() query: PaginationDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.ratingsService.listSellerRatings(sellerId, page, limit);
  }
}
