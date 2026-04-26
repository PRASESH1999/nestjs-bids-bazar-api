# Auth Reference

> Read this before touching anything related to authentication —
> JWT strategy, token generation, refresh rotation, auth controller,
> auth service, or any auth-related decorator.
> All auth logic lives exclusively in src/modules/auth/

---

## Module Structure
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.service.spec.ts
├── strategies/
│   └── jwt.strategy.ts
└── dto/
├── login.dto.ts
├── register.dto.ts
├── refresh-token.dto.ts
└── auth-response.dto.ts

---

## auth.module.ts

```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '@modules/users/users.module';
import { UserEntity } from '@modules/users/entities/user.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiry', '15m'),
          algorithm: 'HS256',  // Use RS256 in staging/production
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

---

## JWT Strategy

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { UsersService } from '@modules/users/users.service';
import { JwtPayload } from '@common/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly cls: ClsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify user still exists and is not locked
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.isLocked) {
      throw new UnauthorizedException('User account is invalid or locked.');
    }

    // Attach user context to CLS store — available everywhere via ClsService
    // See references/cls-context.md for full usage
    this.cls.set('userId', payload.sub);
    this.cls.set('userEmail', payload.email);
    this.cls.set('userRoles', payload.roles);
    this.cls.set('userPermissions', payload.permissions);

    return payload;
  }
}
```

---

## JWT Payload Type

```typescript
// src/common/types/jwt-payload.type.ts
export interface JwtPayload {
  sub: string;              // User UUID — always use sub, never userId
  email: string;
  roles: string[];          // e.g. ['BIDDER', 'AUCTIONEER']
  permissions: string[];    // e.g. ['bid:create', 'auction:view']
  iat?: number;             // Issued at — set by JWT library
  exp?: number;             // Expiry — set by JWT library
}
```

---

## Auth Service

```typescript
// src/modules/auth/auth.service.ts
import {
  Injectable, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '@modules/users/users.service';
import { UserEntity } from '@modules/users/entities/user.entity';
import { JwtPayload } from '@common/types/jwt-payload.type';
import { InvalidCredentialsException } from '@common/exceptions/invalid-credentials.exception';
import { AccountLockedException } from '@common/exceptions/account-locked.exception';
import { RefreshTokenReusedException } from '@common/exceptions/refresh-token-reused.exception';
import { TokenExpiredException } from '@common/exceptions/token-expired.exception';
import { ROLE_PERMISSIONS } from '@common/auth/role-permissions.map';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    this.logger.log('User registered', {
      userId: user.id,
      email: user.email,
    });

    return this.generateAuthResponse(user);
  }

  // ── Login ──────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );

    // Always validate user exists and is not locked
    if (!user) {
      // Use same error for both invalid email and password
      // Never reveal which field is wrong — security best practice
      throw new InvalidCredentialsException();
    }

    if (user.isLocked) {
      this.logger.warn('Login attempt on locked account', {
        userId: user.id,
        email: user.email,
      });
      throw new AccountLockedException();
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.handleFailedLoginAttempt(user);
      throw new InvalidCredentialsException();
    }

    // Reset failed attempts on successful login
    await this.usersRepo.update(user.id, {
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
    });

    this.logger.log('User logged in', { userId: user.id });

    return this.generateAuthResponse(user);
  }

  // ── Refresh Token ──────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    // Verify the refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new TokenExpiredException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.isLocked) {
      throw new InvalidCredentialsException();
    }

    // Verify stored refresh token hash matches
    const isTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash ?? '',
    );
    if (!isTokenValid) {
      // Token reuse detected — invalidate all tokens immediately
      await this.usersRepo.update(user.id, { refreshTokenHash: null });
      this.logger.warn('Refresh token reuse detected — all tokens invalidated', {
        userId: user.id,
      });
      throw new RefreshTokenReusedException();
    }

    // Rotate — issue new tokens, invalidate old refresh token
    this.logger.log('Tokens refreshed', { userId: user.id });
    return this.generateAuthResponse(user);
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    // Invalidate refresh token by clearing stored hash
    await this.usersRepo.update(userId, { refreshTokenHash: null });
    this.logger.log('User logged out', { userId });
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private async generateAuthResponse(
    user: UserEntity,
  ): Promise<AuthResponseDto> {
    const permissions = this.resolvePermissions(user.roles);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions,
    };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiry', '15m'),
    });

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiry', '7d'),
    });

    // Store hashed refresh token — never store raw token
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.usersRepo.update(user.id, { refreshTokenHash });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions,
      },
    };
  }

  private async handleFailedLoginAttempt(user: UserEntity): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const isLocked = attempts >= MAX_FAILED_ATTEMPTS;

    await this.usersRepo.update(user.id, {
      failedLoginAttempts: attempts,
      isLocked,
    });

    if (isLocked) {
      this.logger.warn('Account locked after failed attempts', {
        userId: user.id,
        attempts,
      });
    }
  }

  private resolvePermissions(roles: string[]): string[] {
    // Derive permissions from roles — never assigned individually
    // See references/rbac.md for full mapping
    const permissions = new Set<string>();
    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role] ?? [];
      rolePerms.forEach((p) => permissions.add(p));
    }
    return Array.from(permissions);
  }
}
```

---

## Auth Controller

```typescript
// src/modules/auth/auth.controller.ts
import {
  Controller, Post, Body,
  HttpCode, HttpStatus, Res, Req,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation,
  ApiResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtPayload } from '@common/types/jwt-payload.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })   // 10/hr per IP
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    // Never return refreshToken in body — HttpOnly cookie only
    return this.sanitizeAuthResponse(result);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })     // 5/15min per IP
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return this.sanitizeAuthResponse(result);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900000 } })    // 20/15min per IP
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    // Extract refresh token from HttpOnly cookie — never from body
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new TokenExpiredException();
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return this.sanitizeAuthResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.sub);
    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully.' };
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,                           // Never accessible via JS
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,         // 7 days in ms
      path: '/api/v1/auth/refresh',             // Scoped to refresh endpoint only
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      path: '/api/v1/auth/refresh',
    });
  }

  private sanitizeAuthResponse(result: AuthResponseDto): AuthResponseDto {
    // Strip refreshToken from response body — it lives in cookie only
    const { refreshToken: _, ...safe } = result;
    return safe as AuthResponseDto;
  }
}
```

---

## Auth DTOs

```typescript
// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

// src/modules/auth/dto/register.dto.ts
import {
  IsEmail, IsString, IsNotEmpty,
  MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)             // bcrypt max input length
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}

// src/modules/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles: string[];

  @ApiProperty({ isArray: true })
  permissions: string[];
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  // refreshToken intentionally omitted from Swagger
  // It is set via HttpOnly cookie — never in response body
  refreshToken?: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
```

---

## Guards

```typescript
// src/common/guards/jwt-auth.guard.ts
import {
  Injectable, ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { TokenExpiredException } from '@common/exceptions/token-expired.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Check if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw new TokenExpiredException();
    }
    return user;
  }
}
```

---

## Decorators

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtPayload } from '@common/types/jwt-payload.type';

// Extracts current user from CLS store (set by JwtStrategy.validate)
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
```

---

## User Entity Auth Fields

```typescript
// Add these fields to UserEntity for auth support
@Column({ name: 'password', type: 'varchar', length: 255 })
password: string;

@Column({
  name: 'refresh_token_hash',
  type: 'varchar',
  length: 255,
  nullable: true,
})
refreshTokenHash: string | null;

@Column({
  name: 'failed_login_attempts',
  type: 'int',
  default: 0,
})
failedLoginAttempts: number;

@Column({
  name: 'is_locked',
  type: 'boolean',
  default: false,
})
isLocked: boolean;

@Column({
  name: 'last_login_at',
  type: 'timestamptz',
  nullable: true,
})
lastLoginAt: Date | null;
```

---

## Auth Security Rules Summary

| Rule | Value |
|---|---|
| Password hashing | bcrypt, 12 rounds |
| Access token expiry | 15 minutes |
| Refresh token expiry | 7 days |
| Refresh token storage | Hashed in DB — never raw |
| Refresh token transport | HttpOnly cookie only |
| Access token transport | Authorization header only |
| Max failed login attempts | 10 → account locked |
| Login rate limit | 5 attempts / 15 minutes / IP |
| Register rate limit | 10 attempts / hour / IP |
| Refresh rate limit | 20 attempts / 15 minutes / IP |
| Token reuse detection | Invalidate all tokens immediately |
| Error message strategy | Same error for wrong email or password |
| Logs | Never log tokens, passwords, or hashes |

---

## Social Login — Future Proofing

- Use strategy pattern — each provider is a separate Passport strategy
- All strategies live in `auth/strategies/`
- All strategies must ultimately call `generateAuthResponse()` — same
  token flow as in-house login
- Map provider identity to internal user on first login (auto-register)
- Store provider ID and provider name on UserEntity:
    `oauth_provider` varchar (e.g. 'google', 'github')
    `oauth_provider_id` varchar (provider's user ID)
- [DECISION NEEDED]: Which OAuth2 providers to support first?