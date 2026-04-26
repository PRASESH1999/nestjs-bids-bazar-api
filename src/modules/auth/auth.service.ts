import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/users.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { RolePermissionsMap } from './role-permissions.map';
import { randomBytes } from 'crypto';
import { Role } from '@common/enums/role.enum';
import { User } from '@modules/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
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

  async login(user: User) {
    const permissions = RolePermissionsMap[user.role] || [];
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(data: RegisterDto) {
    const { password, ...rest } = data;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({
      ...rest,
      password: hashedPassword,
      role: Role.USER, // Force USER role for public registration
    });

    // Automatically login after registration
    return this.login(user);
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
    const newRefreshToken = randomBytes(64).toString('hex');
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
