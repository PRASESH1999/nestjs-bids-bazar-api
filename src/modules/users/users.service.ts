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
import { UpdateSelfDto } from './dto/update-self.dto';
import { computeMissingProfileFields } from './profile-completion';
import type {
  KycSummary,
  OwnProfileResponse,
  PendingEmailChangeSummary,
  RewardsSummary,
} from './interfaces/own-profile.interface';
import type { SellerProfileResponse } from './interfaces/seller-profile.interface';
import { SellerRating } from '@modules/ratings/entities/seller-rating.entity';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { formatGeneratedUsername } from './username-generator';

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
    const { password, email, ...rest } = data;
    const normalizedEmail = email.toLowerCase();

    const existing = await this.usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const username = await this.generateNextUsername();
    const user = this.usersRepository.createEntity({
      ...rest,
      email: normalizedEmail,
      username,
      password: hashedPassword,
      isActive: true,
    });
    return this.usersRepository.saveUser(user);
  }

  /**
   * Generates the next system-assigned username (e.g. BB000001-2026) from
   * `username_seq`. `nextval()` is atomic across concurrent sessions, so two
   * simultaneous callers can never receive the same value.
   */
  async generateNextUsername(): Promise<string> {
    const seq = await this.usersRepository.nextUsernameSequenceValue();
    return formatGeneratedUsername(seq, new Date().getFullYear());
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailIncludingDeleted(email);
  }

  /** Batch lookup — used where a list needs one user per row. */
  async findByIds(ids: string[]): Promise<User[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    return this.usersRepository.findByIds(unique);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findByGoogleId(googleId);
  }

  async findByFacebookId(facebookId: string): Promise<User | null> {
    return this.usersRepository.findByFacebookId(facebookId);
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

  /**
   * Rejects a number that is already some other account's verified phone.
   * An unverified claim (another account's `pendingPhone`) doesn't block —
   * whoever verifies first keeps the number.
   */
  async assertPhoneNotTaken(phone: string, excludeUserId?: string) {
    if (await this.usersRepository.isPhoneTaken(phone, excludeUserId)) {
      throw new ConflictException(
        'That number is already registered to another account',
      );
    }
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

    if (!user.password) {
      throw new BadRequestException(
        'This account has no password set. It was created via social login.',
      );
    }

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
        user.username,
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
  /**
   * A seller's public profile — the read behind `GET /sellers/:id`.
   *
   * Public, so the shape is an allowlist rather than an entity: this returns a
   * hand-built object and never a `User`, because the difference between the
   * two is an email address and a phone number. `SellerProfileResponse` says
   * what is on it and what must never join it.
   *
   * A soft-deleted account is treated as absent. `findById` already scopes to
   * live rows, and a profile page for a deleted seller would be a page about
   * somebody who asked to be gone.
   */
  async getSellerProfile(sellerId: string): Promise<SellerProfileResponse> {
    const user = await this.findById(sellerId);
    if (!user) throw new NotFoundException('Seller not found');

    const [counts, kyc, rewards, breakdown] = await Promise.all([
      this.usersRepository.countListingsAndSalesBySeller([sellerId]),
      this.dataSource
        .getRepository(KycVerification)
        .findOne({ where: { userId: sellerId } }),
      this.rewardsService.getOwnRewards(sellerId),
      this.countRatingsByStar(sellerId),
    ]);

    const sellerCounts = counts.get(sellerId) ?? {
      totalListings: 0,
      totalSold: 0,
    };

    return {
      id: user.id,
      username: user.username,
      /*
       * `averageRating` is a decimal column, so pg hands it back as a string.
       * Sending it on as one would make every client decide whether "0.00"
       * means unrated, so it is a number here and `ratingCount` is what says
       * whether it means anything.
       */
      averageRating: Number(user.averageRating),
      ratingCount: user.ratingCount,
      totalListings: sellerCounts.totalListings,
      totalSold: sellerCounts.totalSold,
      createdAt: user.createdAt,
      // The badge, and nothing behind it. A pending or rejected submission is
      // not a verified identity, so only APPROVED counts.
      isIdentityVerified: kyc?.status === KycStatus.APPROVED,
      // No rewards row yet = BRONZE, not an error (Rule 16).
      sellerTier: rewards?.sellerTier ?? SellerTier.BRONZE,
      ratingBreakdown: breakdown,
    };
  }

  /**
   * How many of a seller's ratings gave each star.
   *
   * Every bucket is present even at zero, so a client can render five bars
   * without deciding what a missing key means.
   */
  private async countRatingsByStar(
    sellerId: string,
  ): Promise<Record<string, number>> {
    const rows = await this.dataSource
      .getRepository(SellerRating)
      .createQueryBuilder('rating')
      .select('rating.rating', 'star')
      .addSelect('COUNT(*)', 'count')
      .where('rating.sellerId = :sellerId', { sellerId })
      .groupBy('rating.rating')
      .getRawMany<{ star: number; count: string }>();

    const breakdown: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const row of rows) {
      breakdown[String(row.star)] = Number(row.count);
    }
    return breakdown;
  }

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
          fullName: kyc.fullName,
          submittedAt: kyc.createdAt,
          reviewedAt: kyc.reviewedAt,
          rejectionReason: kyc.rejectionReason,
          rejectedFields: kyc.rejectedFields ?? [],
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
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      /*
       * Self-declared until a KYC reviewer has checked it against the
       * document. Approval locks the name, so the approved snapshot and the
       * account's name can't drift apart afterwards.
       */
      isNameVerified: kycSummary?.status === KycStatus.APPROVED,
      canEditName:
        kycSummary?.status !== KycStatus.PENDING &&
        kycSummary?.status !== KycStatus.APPROVED,
      missingProfileFields: computeMissingProfileFields(user),
      phone: user.phone,
      isPhoneVerified: user.phoneVerifiedAt !== null,
      phoneVerifiedAt: user.phoneVerifiedAt,
      pendingPhone: user.pendingPhone,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      kyc: kycSummary,
      pendingEmailChange: pendingEmailChangeSummary,
      rewards: rewardsSummary,
    };
  }

  /**
   * PATCH /users/me — set or correct the account's full name and phone.
   *
   * Name: free to change until KYC is submitted, and again after a rejection
   * (that is how a reviewer-flagged name is fixed before resubmitting). Locked
   * while a submission is PENDING — the reviewer is checking the snapshot taken
   * at submission — and once APPROVED, when it has been verified.
   *
   * Phone: never written to `phone` directly. It becomes the pending number,
   * and any outstanding code is discarded — that code went to a different
   * number, and letting it confirm this one would verify a number nobody
   * proved. Sending the already-verified number cancels a pending change.
   */
  async updateOwnProfile(
    userId: string,
    dto: UpdateSelfDto,
  ): Promise<OwnProfileResponse> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.fullName !== undefined && dto.fullName !== user.fullName) {
      const kyc = await this.dataSource
        .getRepository(KycVerification)
        .findOne({ where: { userId }, select: { id: true, status: true } });
      if (kyc?.status === KycStatus.PENDING) {
        throw new ConflictException(
          'Your name cannot be changed while your KYC is under review',
        );
      }
      if (kyc?.status === KycStatus.APPROVED) {
        throw new ConflictException(
          'Your name has been verified through KYC and can no longer be changed. Please contact support.',
        );
      }
      user.fullName = dto.fullName;
    }

    if (dto.phone !== undefined && dto.phone !== user.pendingPhone) {
      const isOwnVerified =
        user.phoneVerifiedAt !== null && dto.phone === user.phone;
      if (!isOwnVerified) {
        await this.assertPhoneNotTaken(dto.phone, userId);
      }
      user.pendingPhone = isOwnVerified ? null : dto.phone;
      user.phoneOtpHash = null;
      user.phoneOtpExpiresAt = null;
      user.phoneOtpAttempts = 0;
    }

    await this.usersRepository.saveUser(user);
    return this.getOwnProfile(userId);
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

    if (!user.password) {
      throw new BadRequestException(
        'This account has no password set. It was created via social login.',
      );
    }

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
        user.username,
        rawToken,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[requestEmailChange] Failed to dispatch verification email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─── Public seller info ──────────────────────────────────────────────────

  /**
   * Batched lookup of public seller info (username, rating aggregates, and
   * listing/sales counts) for a set of owner ids, keyed by user id. Used by
   * ProductsService (and FavoritesService) to attach `seller` to every
   * product it returns without a per-product query.
   */
  async getPublicSellerSummaries(sellerIds: string[]): Promise<
    Map<
      string,
      {
        id: string;
        username: string;
        averageRating: number;
        ratingCount: number;
        totalListings: number;
        totalSold: number;
      }
    >
  > {
    const uniqueIds = Array.from(new Set(sellerIds));
    if (uniqueIds.length === 0) return new Map();

    const [users, listingsAndSales] = await Promise.all([
      this.usersRepository.findByIds(uniqueIds),
      this.usersRepository.countListingsAndSalesBySeller(uniqueIds),
    ]);

    return new Map(
      users.map((u) => {
        const counts = listingsAndSales.get(u.id) ?? {
          totalListings: 0,
          totalSold: 0,
        };
        return [
          u.id,
          {
            id: u.id,
            username: u.username,
            averageRating: Number(u.averageRating),
            ratingCount: u.ratingCount,
            totalListings: counts.totalListings,
            totalSold: counts.totalSold,
          },
        ];
      }),
    );
  }
}
