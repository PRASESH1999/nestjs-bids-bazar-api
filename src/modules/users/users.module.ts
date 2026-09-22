import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsModule } from '@modules/rewards/rewards.module';
import { SmsModule } from '@modules/sms/sms.module';
import { Product } from '@modules/products/entities/product.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PhoneVerificationService } from './services/phone-verification.service';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { PendingEmailChangeRepository } from '@modules/auth/pending-email-change.repository';

@Module({
  // Product is registered here directly (not imported from ProductsModule)
  // so UsersRepository can compute a seller's listing/sales counts without
  // depending on ProductsModule — ProductsModule already depends on
  // UsersModule (for seller summaries), so the reverse would be circular.
  //
  // SmsModule is for phone verification, which moved here from KYC: a phone
  // belongs to the account and is now verified before any KYC submission.
  imports: [
    TypeOrmModule.forFeature([User, Product]),
    RewardsModule,
    SmsModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    PendingEmailChangeRepository,
    PhoneVerificationService,
  ],
  exports: [UsersService, PhoneVerificationService],
})
export class UsersModule {}
