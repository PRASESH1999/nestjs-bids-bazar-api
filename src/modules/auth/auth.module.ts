import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PendingEmailChange } from './entities/pending-email-change.entity';
import { AuthRepository } from './auth.repository';
import { PasswordResetRepository } from './password-reset.repository';
import { PendingEmailChangeRepository } from './pending-email-change.repository';
import { AuthCleanupCron } from './cron/auth-cleanup.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailVerificationToken, PasswordResetToken, PendingEmailChange]),
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: configService
          .get<string>('JWT_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n'),
        publicKey: configService
          .get<string>('JWT_PUBLIC_KEY')
          ?.replace(/\\n/g, '\n'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '15m'),
          algorithm: 'RS256',
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    AuthRepository,
    PasswordResetRepository,
    PendingEmailChangeRepository,
    AuthCleanupCron,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
