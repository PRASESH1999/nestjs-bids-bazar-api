import { Role } from '@common/enums/role.enum';
import { MailService } from '@modules/mail/mail.service';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetRepository } from './password-reset.repository';
import { PendingEmailChangeRepository } from './pending-email-change.repository';
import { RolePermissionsMap } from './role-permissions.map';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private authRepository: AuthRepository,
    private passwordResetRepository: PasswordResetRepository,
    private pendingEmailChangeRepository: PendingEmailChangeRepository,
    private dataSource: DataSource,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Partial<User> | null> {
    const user = await this.usersService.findByEmailIncludingDeleted(email);
    if (!user) return null;

    if (user.deletedAt !== null) {
      throw new ForbiddenException(
        'This account has been deleted. Please contact support for account recovery.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    if (!(await bcrypt.compare(pass, user.password))) return null;

    const { password: _, hashedRefreshToken: __, ...result } = user;
    return result;
  }

  async login(user: Pick<User, 'id' | 'email' | 'role' | 'isEmailVerified'>) {
    if (!user.isEmailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message:
          'Please verify your email before logging in. Check your inbox or request a new verification email.',
      });
    }

    const permissions = RolePermissionsMap[user.role] || [];
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(data: RegisterDto) {
    const email = data.email.toLowerCase();

    // Check if user already exists (including soft-deleted accounts)
    const existingUser =
      await this.usersService.findByEmailIncludingDeleted(email);
    if (existingUser) {
      if (existingUser.deletedAt !== null) {
        throw new ForbiddenException(
          'This account has been deleted. Please contact support for account recovery.',
        );
      }
      throw new ConflictException('User with this email already exists');
    }

    // Parallel username-duplicate check (case-insensitive, incl. soft-deleted
    // rows since the DB unique constraint covers them too).
    const existingUsername =
      await this.usersService.findByUsernameIncludingDeleted(data.username);
    if (existingUsername) {
      throw new ConflictException({
        statusCode: 409,
        code: 'USERNAME_TAKEN',
        message: 'This username is already taken.',
      });
    }

    const { password, ...rest } = data;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({
      ...rest,
      email,
      username: data.username.trim(), // store as-typed, sans surrounding whitespace
      password: hashedPassword,
      role: Role.USER, // Force USER role for public registration
    });

    // Send verification email
    await this.sendVerificationEmail(user.id, user.email);

    return {
      message:
        'Account created. Please check your email to verify your account before logging in.',
    };
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    // Invalidate existing tokens
    await this.authRepository.deleteTokensByUserId(userId);

    // Generate raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash it for DB storage
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Set expiry (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save hashed token
    await this.authRepository.saveToken(userId, tokenHash, expiresAt);

    // Dispatch email
    await this.mailService.sendVerificationEmail(email, rawToken);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const tokenRecord = await this.authRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      throw new NotFoundException('Invalid verification link');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new GoneException(
        'Verification link has expired. Please request a new one.',
      );
    }

    // Update user
    await this.usersService.updateUser(tokenRecord.userId, {
      isEmailVerified: true,
    });

    // Clean up token
    await this.authRepository.deleteById(tokenRecord.id);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Return silently if user doesn't exist to prevent email enumeration
    if (!user) return;

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Rate limit: max 3 attempts per hour per user
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const count = await this.authRepository.countTokensSince(
      user.id,
      oneHourAgo,
    );

    if (count >= 3) {
      throw new ForbiddenException(
        'Too many resend attempts. Try again later.',
      );
    }

    await this.sendVerificationEmail(user.id, user.email);
  }

  async refresh(refreshToken: string, userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!refreshTokenMatches) {
      // Security measure: if refresh token is reused/compromised, clear it
      await this.usersService.updateRefreshToken(user.id, null);
      throw new UnauthorizedException('Refresh token reused or invalid');
    }

    // Generate new tokens (Rotation)
    const permissions = RolePermissionsMap[user.role] || [];
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    await this.usersService.updateRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  /**
   * Initiate a password reset for the given email address.
   * Always returns silently — never reveals whether the email exists or is active.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    // Silent return: unknown email or inactive account
    if (!user || !user.isActive) return;

    // Per-email rate limit: max 3 requests per hour (counts incl. invalidated tokens)
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const count = await this.passwordResetRepository.countRequestsSince(
      user.id,
      oneHourAgo,
    );
    if (count >= 3) return;

    // Invalidate any existing reset token for this user
    await this.passwordResetRepository.softDeleteByUserId(user.id);

    // Generate raw token — stored only in the email link, NEVER in DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 3_600_000); // 1 hour

    await this.passwordResetRepository.saveToken(user.id, tokenHash, expiresAt);

    // Send after DB write — email failure is logged but does not propagate
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        rawToken,
        user.name,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[requestPasswordReset] Failed to dispatch reset email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Complete a password reset using the raw token from the email link.
   * On success: re-hashes the password, invalidates all sessions, verifies email
   * (if unverified), and sends a confirmation email.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const tokenRecord =
      await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      throw new NotFoundException('Invalid or expired link');
    }

    if (tokenRecord.expiresAt < new Date()) {
      // Delete the stale row as a side effect; use generic message
      await this.passwordResetRepository.deleteById(tokenRecord.id);
      throw new NotFoundException('Invalid or expired link');
    }

    const user = await this.usersService.findById(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('Invalid or expired link');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updates: Partial<User> = {
      password: hashedPassword,
      hashedRefreshToken: null,
    };
    if (!user.isEmailVerified) {
      updates.isEmailVerified = true;
    }

    // Atomic transaction: update user + delete token
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.usersService.updateUserInTransaction(
        user.id,
        updates,
        queryRunner,
      );
      await this.passwordResetRepository.deleteById(
        tokenRecord.id,
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Send after commit — failure is logged but does not propagate
    try {
      await this.mailService.sendPasswordChangedConfirmation(
        user.email,
        user.name,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[resetPassword] Failed to dispatch confirmation email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Delete all password_reset_tokens whose expiresAt is older than 7 days.
   * Called by the daily cleanup cron (includes soft-deleted rows).
   */
  async cleanupExpiredResetTokens(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000);
    const deleted =
      await this.passwordResetRepository.deleteExpiredBefore(cutoff);
    return { deleted };
  }

  // ─── Email change ─────────────────────────────────────────────────────────

  /**
   * Complete an email-address change using the raw token from the verification link.
   * On success: swaps email, sets isEmailVerified=true, invalidates all sessions,
   * hard-deletes the pending record, and dispatches notifications to both addresses.
   */
  async verifyEmailChange(rawToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const pending =
      await this.pendingEmailChangeRepository.findByTokenHash(tokenHash);

    if (!pending) {
      throw new NotFoundException('Invalid or expired link');
    }

    if (pending.expiresAt < new Date()) {
      await this.pendingEmailChangeRepository.deleteById(pending.id);
      throw new NotFoundException('Invalid or expired link');
    }

    const user = await this.usersService.findById(pending.userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('Invalid or expired link');
    }

    const oldEmail = user.email;
    const newEmail = pending.newEmail;

    // Atomic: update email + invalidate sessions + delete pending record
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.usersService.updateUserInTransaction(
        user.id,
        { email: newEmail, isEmailVerified: true, hashedRefreshToken: null },
        queryRunner,
      );
      await this.pendingEmailChangeRepository.deleteById(
        pending.id,
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Send both notifications after commit — failures are logged but not re-thrown
    try {
      await this.mailService.sendEmailChangedNotificationToOld(
        oldEmail,
        user.name,
        newEmail,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[verifyEmailChange] Failed to dispatch old-address notification',
        err instanceof Error ? err.stack : String(err),
      );
    }

    try {
      await this.mailService.sendEmailChangedNotificationToNew(
        newEmail,
        user.name,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[verifyEmailChange] Failed to dispatch new-address confirmation',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Delete all pending_email_changes whose expiresAt is in the past.
   * Called by the daily cleanup cron.
   */
  async cleanupExpiredPendingEmailChanges(): Promise<{ deleted: number }> {
    const deleted = await this.pendingEmailChangeRepository.deleteExpiredBefore(
      new Date(),
    );
    return { deleted };
  }
}
