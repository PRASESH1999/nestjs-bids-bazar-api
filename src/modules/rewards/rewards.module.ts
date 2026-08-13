import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '@modules/payments/entities/payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { UserRewards } from './entities/user-rewards.entity';
import { PointsTransaction } from './entities/points-transaction.entity';
import { RewardsService } from './rewards.service';
import { AdminRewardsController } from './admin-rewards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRewards,
      PointsTransaction,
      Payment,
      Product,
    ]),
  ],
  controllers: [AdminRewardsController],
  providers: [RewardsService],
  // Exported so UsersModule can expose buyerPoints/sellerPoints/sellerTier on
  // GET /users/me without a circular import back into RewardsModule.
  exports: [RewardsService],
})
export class RewardsModule {}
