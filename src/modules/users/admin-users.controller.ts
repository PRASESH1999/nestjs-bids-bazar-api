import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  R401,
  R403,
  R404,
  SuccessResponse,
} from '@common/swagger/api-responses';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { UsersService } from './users.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('users/:id/reset-name-change')
  @ApiOperation({
    summary: "Reset a user's one-time name-change quota (SuperAdmin only)",
  })
  @ApiResponse({
    status: 200,
    description:
      'Name-change quota reset. The user can change their name once more.',
    ...SuccessResponse,
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.NAME_CHANGE_RESET)
  @HttpCode(HttpStatus.OK)
  async resetNameChange(@Param('id') id: string) {
    await this.usersService.resetNameChangeQuota(id);
    return { success: true };
  }
}
