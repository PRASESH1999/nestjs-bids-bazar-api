import { FonepayModule } from '@modules/fonepay/fonepay.module';
import { Product } from '@modules/products/entities/product.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoostsController } from './boosts.controller';
import { BoostsCron } from './cron/boosts.cron';
import { BoostItem } from './entities/boost-item.entity';
import { BoostPayment } from './entities/boost-payment.entity';
import { BoostsService } from './services/boosts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BoostItem, BoostPayment, Product]),
    // FonepayModule exports FonepayClientService
    FonepayModule,
  ],
  controllers: [BoostsController],
  providers: [BoostsService, BoostsCron],
  exports: [BoostsService],
})
export class BoostsModule {}
