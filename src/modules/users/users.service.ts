import { PaginationDto } from '@common/dto/pagination.dto';
import { Role } from '@common/enums/role.enum';
import { PendingEmailChange } from '@modules/auth/entities/pending-email-change.entity';
import { PendingEmailChangeRepository } from '@modules/auth/pending-email-change.repository';
import { KycVerification } from '@modules/kyc/entities/kyc-verification.entity';
import { MailService } from '@modules/mail/mail.service';
import { SellerTier } from '@common/enums/seller-tier.enum';
import { RewardsService } from '@modules/rewards/rewards.service';
import { User } from '@modules/users/entities/user.entity';
import { UsersRepository } from '@modules/users/users.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import { CreateAdminDto } from './dto/create-admin.dto';
import type {
  KycSummary,
  OwnProfileResponse,
  PendingEmailChangeSummary,
  RewardsSummary,
} from './interfaces/own-profile.interface';
import {
  UsernameValidationError,
  validateUsernameFormat,
} from './username.validator';

export interface UsernameAvailabilityResult {
  available: boolean;
  reason?: UsernameValidationError | 'TAKEN';
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly pendingEmailChangeRepository: PendingEmailChangeRepository,
    private readonly rewardsService: RewardsService,
  ) {}

  async findAll(
    pagination: PaginationDto,
    requesterRole: Role,
  ): Promise<[User[], number]> {
    const { page = 1, limit = 20 } = pagination;
    let rolesToInclude: Role[] | undefined;

    if (requesterRole === Role.ADMIN) {
      rolesToInclude = [Role.USER];
    } else if (requesterRole === Role.SUPERADMIN) {
      rolesToInclude = [Role.SUPERADMIN, Role.ADMIN, Role.USER];
    } else {
      rolesToInclude = [];
    }

    return this.usersRepository.findAllPaginated(page, limit, rolesToInclude);
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.createEntity(data);
    return this.usersRepository.saveUser(user);
  }

  async createAdmin(data: CreateAdminDto): Promise<User> {
    const { password, email, username, ...rest } = data;
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.trim();

    const existing = await this.usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const usernameTaken =
      await this.usersRepository.findByUsernameIncludingDeleted(
        normalizedUsername,
      );
    if (usernameTaken) {
      throw new ConflictException({
        statusCode: 409,
        code: 'USERNAME_TAKEN',
        message: 'This username is already taken.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = this.usersRepository.createEntity({
      ...rest,
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      isActive: true,
    });
    return this.usersRepository.saveUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailIncludingDeleted(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async findByUsername(
    username: string,
    excludeUserId?: string,
  ): Promise<User | null> {
    return this.usersRepository.findByUsername(username, excludeUserId);
  }

  async findByUsernameIncludingDeleted(username: string): Promise<User | null> {
    return this.usersRepository.findByUsernameIncludingDeleted(username);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (
      data.role !== undefined &&
      user.role === Role.SUPERADMIN &&
      data.role !== Role.SUPERADMIN
    ) {
      throw new ForbiddenException('SUPERADMIN role cannot be downgraded');
    }
    if (data.email) {
      data.email = data.email.toLowerCase();
    }
    Object.assign(user, data);
    return this.usersRepository.saveUser(user);
  }

  async suspendUser(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.isActive = false;
    user.hashedRefreshToken = null;
    return this.usersRepository.saveUser(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.softDeleteUser(user);
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    if (refreshToken) {
      const hashedToken = await bcrypt.hash(refreshToken, 12);
      await this.usersRepository.updateUser(id, {
        hashedRefreshToken: hashedToken,
      });
    } else {
      await this.usersRepository.updateUser(id, { hashedRefreshToken: null });
    }
  }

  /**
   * Update a user's fields within an existing transaction.
   * Called by AuthService.resetPassword / verifyEmailChange to keep DB mutations atomic.
   */
  async updateUserInTransaction(
    id: string,
    data: Partial<User>,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.usersRepository.updateUser(id, data, queryRunner);
  }

  /**
   * Change password for an authenticated user (in-app flow).
   * Validates currentPassword, enforces newPassword !== currentPassword,
   * re-hashes, invalidates all sessions, and sends a confirmation email.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.usersRepository.updateUser(
        userId,
        { password: hashedPassword, hashedRefreshToken: null },
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.mailService.sendPasswordChangedConfirmation(
        user.email,
        user.name,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[changePassword] Failed to dispatch confirmation email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─── Own-profile ──────────────────────────────────────────────────────────

  /**
   * Return the rich own-profile for the authenticated user, including a KYC
   * summary (if submitted) and any pending email-change request.
   */
  async getOwnProfile(userId: string): Promise<OwnProfileResponse> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const kycRepo = this.dataSource.getRepository(KycVerification);
    const kyc = await kycRepo.findOne({ where: { userId } });

    const pending = await this.dataSource
      .getRepository(PendingEmailChange)
      .findOne({ where: { userId } });

    const kycSummary: KycSummary | null = kyc
      ? {
          status: kyc.status,
          submittedAt: kyc.createdAt,
          reviewedAt: kyc.reviewedAt,
          rejectionReason: kyc.rejectionReason,
        }
      : null;

    const pendingEmailChangeSummary: PendingEmailChangeSummary | null = pending
      ? { newEmail: pending.newEmail, expiresAt: pending.expiresAt }
      : null;

    // No UserRewards row yet = zeros/BRONZE, not an error (Rule 16).
    const rewards = await this.rewardsService.getOwnRewards(userId);
    const rewardsSummary: RewardsSummary = {
      buyerPoints: rewards?.buyerPoints ?? 0,
      sellerPoints: rewards?.sellerPoints ?? 0,
      sellerTier: rewards?.sellerTier ?? SellerTier.BRONZE,
    };

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      nameChangedAt: user.nameChangedAt,
      usernameChangedAt: user.usernameChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      kyc: kycSummary,
      pendingEmailChange: pendingEmailChangeSummary,
      rewards: rewardsSummary,
    };
  }

  /**
   * One-time display name change.
   * nameChangedAt null = available; non-null = already used.
   * Sends a confirmation email after the DB update.
   */
  async updateSelfName(userId: string, newName: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.nameChangedAt !== null) {
      throw new ForbiddenException(
        'Display name can only be changed once. Please contact support.',
      );
    }

    if (newName.trim() === user.name.trim()) {
      throw new BadRequestException(
        'New display name must be different from your current name.',
      );
    }

    const now = new Date();
    await this.usersRepository.updateUser(userId, {
      name: newName,
      nameChangedAt: now,
    });

    try {
      await this.mailService.sendNameChangedConfirmation(user.email, newName);
    } catch (err: unknown) {
      this.logger.error(
        '[updateSelfName] Failed to dispatch name-changed email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Public availability check for a username. Never reserves and never throws —
   * always resolves to an availability result. Format + reserved-list rules are
   * evaluated first (single source of truth in username.validator.ts), then a
   * case-insensitive existence check against the DB.
   */
  async checkUsernameAvailability(
    username: string,
  ): Promise<UsernameAvailabilityResult> {
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      return { available: false, reason: formatError };
    }

    const existing = await this.usersRepository.findByUsername(username);
    if (existing) {
      return { available: false, reason: 'TAKEN' };
    }

    return { available: true };
  }

  /**
   * One-time username change.
   * usernameChangedAt null = available; non-null = already used.
   * The same-value guard runs BEFORE the quota guard so a no-op attempt never
   * consumes the quota. Sends a confirmation email after the DB update.
   */
  async updateSelfUsername(userId: string, newUsername: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Same-value guard FIRST — a no-op must not consume the one-time quota.
    if (
      newUsername.trim().toLowerCase() === user.username.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'New username must be different from your current username.',
      );
    }

    if (user.usernameChangedAt !== null) {
      throw new ForbiddenException(
        'Username can only be changed once. Please contact support.',
      );
    }

    // Store as-typed but without surrounding whitespace.
    const normalizedUsername = newUsername.trim();

    // Case-insensitive uniqueness check against other users.
    const taken = await this.usersRepository.findByUsername(
      normalizedUsername,
      userId,
    );
    if (taken) {
      throw new ConflictException('USERNAME_TAKEN');
    }

    const now = new Date();
    await this.usersRepository.updateUser(userId, {
      username: normalizedUsername,
      usernameChangedAt: now,
    });

    try {
      await this.mailService.sendUsernameChangedConfirmation(
        user.email,
        normalizedUsername,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[updateSelfUsername] Failed to dispatch username-changed email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Initiate an email-address change.
   * Re-authenticates with currentPassword, rejects if newEmail is already taken,
   * creates a pending-email-change record, and sends a verification link to newEmail.
   */
  async requestEmailChange(
    userId: string,
    newEmail: string,
    currentPassword: string,
  ): Promise<void> {
    const normalizedNew = newEmail.toLowerCase();
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (normalizedNew === user.email.toLowerCase()) {
      throw new BadRequestException(
        'New email must be different from your current email',
      );
    }

    const taken = await this.usersRepository.findByEmail(normalizedNew);
    if (taken) {
      throw new ConflictException('Email address is already in use');
    }

    // Delete any previous pending request for this user
    await this.pendingEmailChangeRepository.deleteByUserId(userId);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 3_600_000); // 1 hour

    await this.pendingEmailChangeRepository.saveRecord(
      userId,
      normalizedNew,
      tokenHash,
      expiresAt,
    );

    try {
      await this.mailService.sendEmailChangeVerification(
        normalizedNew,
        user.name,
        rawToken,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[requestEmailChange] Failed to dispatch verification email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * SUPERADMIN: reset a user's one-time name-change quota by setting nameChangedAt back to null.
   */
  async resetNameChangeQuota(targetUserId: string): Promise<void> {
    const user = await this.findById(targetUserId);
    if (!user) throw new NotFoundException('User not found');

    await this.usersRepository.updateUser(targetUserId, {
      nameChangedAt: null,
    });
  }

  /**
   * SUPERADMIN: reset a user's one-time username-change quota by setting
   * usernameChangedAt back to null.
   */
  async resetUsernameChangeQuota(targetUserId: string): Promise<void> {
    const user = await this.findById(targetUserId);
    if (!user) throw new NotFoundException('User not found');

    await this.usersRepository.updateUser(targetUserId, {
      usernameChangedAt: null,
    });
  }
}
