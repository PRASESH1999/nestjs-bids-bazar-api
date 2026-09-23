import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Permission } from '@common/enums/permission.enum';
import { HierarchyGuard } from '@common/guards/hierarchy.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import {
  R400,
  R401,
  R403,
  R404,
  R409,
  SuccessResponse,
  UserSchema,
} from '@common/swagger/api-responses';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
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
import { Throttle } from '@nestjs/throttler';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UsersService } from './users.service';
import { PhoneVerificationService } from './services/phone-verification.service';
import { SendPhoneOtpDto, VerifyPhoneOtpDto } from './dto/phone.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

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
    return this.usersService.createAdmin(createAdminDto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get own profile with KYC summary and pending email-change info',
  })
  @ApiResponse({
    status: 200,
    description:
      'Rich own-profile including KYC summary and pending email change (if any).',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.PROFILE_VIEW)
  async getProfile(@Request() req: RequestWithUser) {
    return this.usersService.getOwnProfile(req.user.sub);
  }

  /*
   * PATCH /users/me (display-name change) is gone, along with its one-change
   * quota. A person's name now comes from their approved KYC document, so it is
   * corrected by resubmitting KYC rather than edited on a profile; `username`
   * is the public identity and does not change. See the User entity's note.
   */

  // ─── Phone verification ───────────────────────────────────────────────────
  //
  // Moved here from KYC. Verifying a number is a property of the account, and
  // it now has to happen *before* KYC — submitKyc refuses an account whose
  // phone is unverified, so these cannot hang off a submission that does not
  // exist yet.

  @Get('me/phone')
  @ApiOperation({ summary: 'Your phone number and its verification state' })
  @ApiResponse(R401)
  @RequirePermissions(Permission.PROFILE_EDIT)
  async getPhoneStatus(@Request() req: RequestWithUser) {
    return this.phoneVerificationService.getStatus(req.user.sub);
  }

  @Post('me/phone/send-otp')
  // Same budget the KYC version had. Sparrow costs money per message and an
  // unthrottled endpoint is an SMS-bombing tool pointed at any number.
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hour per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send (or resend) an SMS code to verify a phone number',
    description:
      'The number is held as pending until the code is confirmed, so requesting a code for a new number never costs you the one you already verified.',
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse({
    status: 409,
    description: 'That number is already registered to another account.',
  })
  @RequirePermissions(Permission.PROFILE_EDIT)
  async sendPhoneOtp(
    @Request() req: RequestWithUser,
    @Body() dto: SendPhoneOtpDto,
  ) {
    return this.phoneVerificationService.sendOtp(req.user.sub, dto);
  }

  @Post('me/phone/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10/hour per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the SMS code and verify the number' })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @RequirePermissions(Permission.PROFILE_EDIT)
  async verifyPhoneOtp(
    @Request() req: RequestWithUser,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    return this.phoneVerificationService.verifyOtp(req.user.sub, dto);
  }

  @Patch('me/email')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hour per IP
  @ApiOperation({
    summary:
      'Request an email address change (sends verification to new address)',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent to the new address.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'A verification link has been sent to your new email address.',
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
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
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

    /*
     * Returned as User instances on purpose — see `findOne` below. Spreading
     * them into plain objects is what used to leak the OTP columns.
     */
    const data = users;

    return {
      data,
      meta: {
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        total,
      },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single user by ID (Admin/SuperAdmin only)',
    description:
      'Without this, an admin user-detail screen had to page GET /users and find the row client-side — capped at the maximum page size, so any account past the first page could not be opened at all. See OPEN-ITEMS A9.',
  })
  @ApiResponse({ status: 200, description: 'User object.', schema: UserSchema })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.USER_VIEW)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    /*
     * Returned as the entity, deliberately.
     *
     * This used to spread it into a plain object to strip `password` and
     * `hashedRefreshToken` by hand — which was described as "redundant since
     * User marks both @Exclude()" and was in fact the opposite. Spreading
     * discards the prototype, ClassSerializerInterceptor only transforms class
     * *instances*, so the hand-written pick silently disabled every other
     * @Exclude() on the entity. That shipped `phoneOtpHash` — the verifier for
     * the SMS code that gates KYC submission — on every one of these handlers.
     *
     * Handing the interceptor a real User is what makes the entity the single
     * place that decides what is public, including for the next column someone
     * adds. See OPEN-ITEMS A35.
     */
    return user;
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
    return this.usersService.suspendUser(id);
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
    return this.usersService.updateUser(id, {
      role: assignRoleDto.role,
    });
  }
}
