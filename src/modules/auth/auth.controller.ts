import { Public } from '@common/decorators/public.decorator';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Response as NestResponse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AccessTokenResponse,
  MessageResponse,
  R400,
  R401,
  R404,
  R409,
  R410,
  R429,
} from '@common/swagger/api-responses';
import { Throttle } from '@nestjs/throttler';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailQueryDto } from './dto/verify-email-query.dto';
import type { User } from '../users/entities/user.entity';

interface DecodedJwtPayload {
  sub?: string;
}

interface RefreshRequest extends ExpressRequest {
  cookies: Record<string, string | undefined>;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'Account created — verification email sent.',
    ...MessageResponse(
      'Account created. Please check your email to verify your account before logging in.',
    ),
  })
  @ApiResponse(R400)
  @ApiResponse(R409)
  @ApiResponse(R429)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 attempts per hour
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description:
      'Login successful. Sets HttpOnly refreshToken cookie. Returns short-lived accessToken.',
    ...AccessTokenResponse,
  })
  @ApiResponse({ status: 400, description: 'Validation failed.', ...R400 })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account.',
    ...R401,
  })
  @ApiResponse({
    status: 403,
    description: 'Email not verified — send to /auth/resend-verification.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'null', example: null },
        meta: { type: 'null', example: null },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'EMAIL_NOT_VERIFIED' },
            message: {
              type: 'string',
              example: 'Please verify your email before logging in.',
            },
            statusCode: { type: 'number', example: 403 },
          },
        },
      },
    },
  })
  @ApiResponse(R429)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 mins
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Request()
    req: ExpressRequest & {
      user: Pick<User, 'id' | 'email' | 'role' | 'isEmailVerified'>;
    },
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
    );

    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
    ...MessageResponse('Email verified successfully. You can now log in.'),
  })
  @ApiResponse(R400)
  @ApiResponse(R404)
  @ApiResponse(R410)
  @Get('verify-email')
  async verifyEmail(@Query() query: VerifyEmailQueryDto) {
    await this.authService.verifyEmail(query.token);
    return { message: 'Email verified successfully. You can now log in.' };
  }

  @Public()
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description:
      'Response is always the same regardless of whether the email exists (prevents user enumeration).',
    ...MessageResponse(
      'If your email exists and is unverified, a new verification email has been sent.',
    ),
  })
  @ApiResponse(R400)
  @ApiResponse(R429)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour per IP
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return {
      message:
        'If your email exists and is unverified, a new verification email has been sent.',
    };
  }

  @Public()
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({
    status: 200,
    description:
      'New accessToken issued. The refreshToken cookie is rotated (old token invalidated).',
    ...AccessTokenResponse,
  })
  @ApiResponse({
    status: 401,
    description:
      'Missing refresh token cookie, missing/invalid access token, or refresh token mismatch (possible token theft).',
    ...R401,
  })
  @ApiResponse(R429)
  @Throttle({ default: { limit: 20, ttl: 900000 } }) // 20 attempts per 15 mins
  @Post('refresh')
  async refresh(
    @Request() req: RefreshRequest,
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token missing');
    }

    const accessToken = authHeader.slice(7);
    const decoded = this.jwtService.decode<DecodedJwtPayload | null>(
      accessToken,
    );
    const userId = decoded?.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const tokens = await this.authService.refresh(refreshToken, userId);

    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @ApiOperation({ summary: 'Logout and clear refresh token' })
  @ApiResponse({
    status: 200,
    description:
      'Logged out. refreshToken cookie cleared. Discard the accessToken client-side.',
    ...MessageResponse('Logged out successfully'),
  })
  @ApiResponse(R401)
  @Post('logout')
  async logout(
    @Request() req: RequestWithUser,
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.sub);
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'strict',
    });
    return { message: 'Logged out successfully' };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: nodeEnv === 'production' || nodeEnv === 'staging',
      sameSite: 'strict',
      maxAge: expiresIn,
    });
  }
}
