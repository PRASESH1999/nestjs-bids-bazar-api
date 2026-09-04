import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '@modules/payments/entities/payment.entity';
import { User } from '@modules/users/entities/user.entity';
import { SellerRating } from './entities/seller-rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsRepository } from './ratings.repository';
import { RatingsService } from './ratings.service';

@Module({
  // Payment and User are registered here directly (not imported from their
  // modules) so this module can query/join and update them without taking a
  // dependency on PaymentsModule/UsersModule.
  imports: [TypeOrmModule.forFeature([SellerRating, Payment, User])],
  controllers: [RatingsController],
  providers: [RatingsService, RatingsRepository],
  exports: [RatingsService],
})
export class RatingsModule {}
