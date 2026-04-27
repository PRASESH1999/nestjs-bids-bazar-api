import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@common/common.module';
import { BankDetail } from './entities/bank-detail.entity';
import { KycVerification } from './entities/kyc-verification.entity';
import { KycController } from './kyc.controller';
import { KycRepository } from './kyc.repository';
import { KycService } from './kyc.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycVerification, BankDetail]),
    CommonModule,
    UsersModule,
  ],
  controllers: [KycController],
  providers: [KycService, KycRepository],
  exports: [KycService],
})
export class KycModule {}
