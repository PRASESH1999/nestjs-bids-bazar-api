import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private authService;
    private jwtService;
    private configService;
    constructor(authService: AuthService, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto, res: Response): Promise<{
        accessToken: string;
    }>;
    login(req: RequestWithUser, res: Response): Promise<{
        accessToken: string;
    }>;
    refresh(req: any, res: Response): Promise<{
        accessToken: string;
    }>;
    logout(req: RequestWithUser, res: Response): Promise<{
        message: string;
    }>;
    private setRefreshTokenCookie;
}
