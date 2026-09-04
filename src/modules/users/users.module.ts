import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsModule } from '@modules/rewards/rewards.module';
import { Product } from '@modules/products/entities/product.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { PendingEmailChangeRepository } from '@modules/auth/pending-email-change.repository';

@Module({
  // Product is registered here directly (not imported from ProductsModule)
  // so UsersRepository can compute a seller's listing/sales counts without
  // depending on ProductsModule — ProductsModule already depends on
  // UsersModule (for seller summaries), so the reverse would be circular.
  imports: [TypeOrmModule.forFeature([User, Product]), RewardsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, PendingEmailChangeRepository],
  exports: [UsersService],
})
export class UsersModule {}
