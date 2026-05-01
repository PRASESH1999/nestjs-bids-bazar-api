import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailQueryDto } from './dto/verify-email-query.dto';
import type { User } from '../users/entities/user.entity';
interface RefreshRequest extends ExpressRequest {
    cookies: Record<string, string | undefined>;
}
export declare class AuthController {
    private authService;
    private jwtService;
    private configService;
    constructor(authService: AuthService, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<{
        message: string;
    }>;
    login(req: ExpressRequest & {
        user: Pick<User, 'id' | 'email' | 'role' | 'isEmailVerified'>;
    }, res: Response): Promise<{
        accessToken: string;
    }>;
    verifyEmail(query: VerifyEmailQueryDto): Promise<{
        message: string;
    }>;
    resendVerification(dto: ResendVerificationDto): Promise<{
        message: string;
    }>;
    refresh(req: RefreshRequest, res: Response): Promise<{
        accessToken: string;
    }>;
    logout(req: RequestWithUser, res: Response): Promise<{
        message: string;
    }>;
    private setRefreshTokenCookie;
}
export {};
