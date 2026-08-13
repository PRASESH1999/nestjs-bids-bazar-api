import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsModule } from '@modules/rewards/rewards.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { PendingEmailChangeRepository } from '@modules/auth/pending-email-change.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RewardsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, PendingEmailChangeRepository],
  exports: [UsersService],
})
export class UsersModule {}
