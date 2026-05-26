import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Permission } from '@common/enums/permission.enum';
import { HierarchyGuard } from '@common/guards/hierarchy.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  R400,
  R401,
  R403,
  R404,
  R409,
  SuccessResponse,
  UserSchema,
} from '@common/swagger/api-responses';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('admin')
  @ApiOperation({
    summary: 'Create a new Admin or SuperAdmin (SuperAdmin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin/SuperAdmin account created.',
    schema: UserSchema,
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R409)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    const user = await this.usersService.createAdmin(createAdminDto);
    const { password: _, hashedRefreshToken: __, ...result } = user;
    return result;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile with KYC summary and pending email-change info' })
  @ApiResponse({
    status: 200,
    description: 'Rich own-profile including KYC summary and pending email change (if any).',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.PROFILE_VIEW)
  async getProfile(@Request() req: RequestWithUser) {
    return this.usersService.getOwnProfile(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Change display name (one-time only)' })
  @ApiResponse({
    status: 200,
    description: 'Name updated. This can only be done once.',
    schema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Display name updated successfully.' } },
    },
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.PROFILE_EDIT)
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateSelfDto,
  ) {
    await this.usersService.updateSelfName(req.user.sub, dto.name);
    return { message: 'Display name updated successfully.' };
  }

  @Patch('me/email')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hour per IP
  @ApiOperation({ summary: 'Request an email address change (sends verification to new address)' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent to the new address.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'A verification link has been sent to your new email address.',
        },
      },
    },
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R409)
  @RequirePermissions(Permission.PROFILE_EDIT)
  async requestEmailChange(
    @Request() req: RequestWithUser,
    @Body() dto: ChangeEmailDto,
  ) {
    await this.usersService.requestEmailChange(
      req.user.sub,
      dto.newEmail,
      dto.currentPassword,
    );
    return {
      message: 'A verification link has been sent to your new email address.',
    };
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change own password (authenticated users)' })
  @ApiResponse({
    status: 200,
    description:
      'Password changed. All sessions invalidated — user must log in again.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password changed successfully. Please log in again.',
        },
      },
    },
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.PROFILE_EDIT)
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully. Please log in again.' };
  }

  @Get()
  @ApiOperation({ summary: 'List all users (Admin/SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: UserSchema },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 100 },
          },
        },
      },
    },
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.USER_VIEW)
  async findAll(
    @Request() req: RequestWithUser,
    @Query() pagination: PaginationDto,
  ) {
    const requesterRole = req.user.role;
    const [users, total] = await this.usersService.findAll(
      pagination,
      requesterRole,
    );

    // Map users to remove sensitive data
    const data = users.map((user) => {
      const { password: _, hashedRefreshToken: __, ...result } = user;
      return result;
    });

    return {
      data,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiResponse({
    status: 200,
    description: 'Suspended user object (isActive: false).',
    schema: UserSchema,
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.USER_MANAGE)
  @UseGuards(HierarchyGuard)
  async suspendUser(@Param('id') id: string) {
    const user = await this.usersService.suspendUser(id);
    const { password: _, hashedRefreshToken: __, ...result } = user;
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user account' })
  @ApiResponse({
    status: 200,
    description:
      'User soft-deleted (deletedAt is set, record still exists in DB).',
    ...SuccessResponse,
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.USER_MANAGE)
  @UseGuards(HierarchyGuard)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return { success: true };
  }

  @Post(':id/role')
  @ApiOperation({ summary: 'Assign a new role to a user' })
  @ApiResponse({
    status: 201,
    description: 'Updated user object with new role.',
    schema: UserSchema,
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  @UseGuards(HierarchyGuard)
  async assignRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    const user = await this.usersService.updateUser(id, {
      role: assignRoleDto.role,
    });
    const { password: _, hashedRefreshToken: __, ...result } = user;
    return result;
  }
}
