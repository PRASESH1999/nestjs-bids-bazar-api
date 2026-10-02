import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { R404 } from '@common/swagger/api-responses';
import { UsersService } from './users.service';

/**
 * The public face of an account.
 *
 * Separate from `UsersController` rather than another route on it, and that is
 * the point rather than tidiness: everything under `/users` is authenticated
 * and permission-gated, and this is `@Public()` — anybody may call it with
 * anybody's id. Keeping the two apart means a route cannot be added to the
 * private controller and quietly inherit a public decorator, or the reverse.
 *
 * Mounted at `/sellers/:id` to sit beside `/sellers/:sellerId/ratings`, which
 * the ratings module already serves.
 */
@ApiTags('sellers')
@Controller()
@UseGuards(PermissionsGuard)
export class SellersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('sellers/:id')
  @Public()
  @ApiOperation({
    summary: "A seller's public profile",
    description:
      'Username, rating aggregate, listing and sale counts, member-since, the identity badge and the seller tier. Everything here was already computed but only ever left the API attached to a product, as `product.seller` — which a profile page has no way to obtain. Carries no email, phone or legal name by design. See OPEN-ITEMS A32.',
  })
  @ApiResponse({ status: 200, description: 'The seller profile.' })
  @ApiResponse(R404)
  async getSellerProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getSellerProfile(id);
  }
}
