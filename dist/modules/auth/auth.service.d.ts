import { JwtService } from '@nestjs/jwt';
import { UsersService } from "../users/users.service";
import { ConfigService } from '@nestjs/config';
import { User } from "../users/entities/user.entity";
import { RegisterDto } from './dto/register.dto';
import { MailService } from "../mail/mail.service";
import { AuthRepository } from './auth.repository';
export declare class AuthService {
    private usersService;
    private jwtService;
    private configService;
    private mailService;
    private authRepository;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService, mailService: MailService, authRepository: AuthRepository);
    validateUser(email: string, pass: string): Promise<Partial<User> | null>;
    login(user: Pick<User, 'id' | 'email' | 'role' | 'isEmailVerified'>): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    register(data: RegisterDto): Promise<{
        message: string;
    }>;
    sendVerificationEmail(userId: string, email: string): Promise<void>;
    verifyEmail(rawToken: string): Promise<void>;
    resendVerification(email: string): Promise<void>;
    refresh(refreshToken: string, userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: string): Promise<void>;
}
