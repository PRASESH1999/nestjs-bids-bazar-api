import { Public } from '@common/decorators/public.decorator';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import {
  Body,
  Controller,
  Response as NestResponse,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 attempts per hour
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.register(registerDto);

    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 mins
  @Post('login')
  async login(
    @Request() req: RequestWithUser,
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user as any, // req.user from LocalAuthGuard might differ slightly from RequestWithUser before login
    );

    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @Throttle({ default: { limit: 20, ttl: 900000 } }) // 20 attempts per 15 mins
  @Post('refresh')
  async refresh(
    @Request() req: any, // req.cookies not on RequestWithUser
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token missing');
    }

    const accessToken = authHeader.split(' ')[1];
    const decoded = this.jwtService.decode(accessToken);
    if (!decoded || !decoded.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    const tokens = await this.authService.refresh(
      refreshToken,
      decoded.sub as string,
    );

    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @ApiOperation({ summary: 'Logout and clear refresh token' })
  @Post('logout')
  async logout(
    @Request() req: RequestWithUser,
    @NestResponse({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.sub);
    const nodeEnv = this.configService.get('NODE_ENV');
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'strict',
    });
    return { message: 'Logged out successfully' };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    const nodeEnv = this.configService.get('NODE_ENV');
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: nodeEnv === 'production' || nodeEnv === 'staging',
      sameSite: 'strict',
      maxAge: expiresIn,
    });
  }
}
