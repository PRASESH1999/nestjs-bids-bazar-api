import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@modules/users/entities/user.entity';
import { UsersRepository } from '@modules/users/users.repository';
import { Role } from '@common/enums/role.enum';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(
    pagination: PaginationDto,
    requesterRole: Role,
  ): Promise<[User[], number]> {
    const { page = 1, limit = 20 } = pagination;
    let rolesToInclude: Role[] | undefined;

    if (requesterRole === Role.ADMIN) {
      rolesToInclude = [Role.USER];
    } else if (requesterRole === Role.SUPERADMIN) {
      // Superadmin sees all roles
      rolesToInclude = [Role.SUPERADMIN, Role.ADMIN, Role.USER];
    } else {
      // Regular user should not be able to list users (handled by permissions, but safe fallback)
      rolesToInclude = [];
    }

    return this.usersRepository.findAllPaginated(page, limit, rolesToInclude);
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.createEntity(data);
    return this.usersRepository.saveUser(user);
  }

  async createAdmin(data: CreateAdminDto): Promise<User> {
    const { password, ...rest } = data;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = this.usersRepository.createEntity({
      ...rest,
      password: hashedPassword,
      isActive: true,
    });
    return this.usersRepository.saveUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, data);
    return this.usersRepository.saveUser(user);
  }

  async suspendUser(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.isActive = false;
    return this.usersRepository.saveUser(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.softDeleteUser(user);
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    if (refreshToken) {
      const hashedToken = await bcrypt.hash(refreshToken, 12);
      await this.usersRepository.updateUser(id, {
        hashedRefreshToken: hashedToken,
      });
    } else {
      await this.usersRepository.updateUser(id, { hashedRefreshToken: null });
    }
  }
}
