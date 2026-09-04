import {
  Controller,
  Delete,
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
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { R401, R403, R404, R409 } from '@common/swagger/api-responses';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(PermissionsGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @RequirePermissions(Permission.FAVORITE_MANAGE)
  @ApiOperation({
    summary:
      "List the authenticated user's favorited products (active listings only)",
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  async listMyFavorites(
    @Request() req: RequestWithUser,
    @Query() query: PaginationDto,
  ) {
    return this.favoritesService.listActiveFavorites(req.user.sub, query);
  }

  @Post(':productId')
  @RequirePermissions(Permission.FAVORITE_MANAGE)
  @ApiOperation({
    summary: "Add a product to the authenticated user's favorites",
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  async addFavorite(
    @Request() req: RequestWithUser,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addFavorite(req.user.sub, productId);
  }

  @Delete(':productId')
  @RequirePermissions(Permission.FAVORITE_MANAGE)
  @ApiOperation({
    summary: "Remove a product from the authenticated user's favorites",
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  async removeFavorite(
    @Request() req: RequestWithUser,
    @Param('productId') productId: string,
  ) {
    await this.favoritesService.removeFavorite(req.user.sub, productId);
    return { message: 'Product removed from favorites' };
  }
}
