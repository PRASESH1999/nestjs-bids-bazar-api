import { JwtService } from '@nestjs/jwt';
import { UsersService } from "../users/users.service";
import { ConfigService } from '@nestjs/config';
import { User } from "../users/entities/user.entity";
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    private configService;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    validateUser(email: string, pass: string): Promise<Partial<User> | null>;
    login(user: User): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    register(data: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    refresh(refreshToken: string, userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: string): Promise<void>;
}
