import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { RolePermissionsMap } from './role-permissions.map';
import { Role } from '@common/enums/role.enum';
import { User } from '@modules/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { MailService } from '@modules/mail/mail.service';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private authRepository: AuthRepository,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Partial<User> | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive && (await bcrypt.compare(pass, user.password))) {
      const { password: _, hashedRefreshToken: __, ...result } = user;
      return result;
    }
    return null;
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
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const { password, ...rest } = data;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({
      ...rest,
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
}
