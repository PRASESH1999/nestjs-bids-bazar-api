import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiddingModule } from '@modules/bidding/bidding.module';
import { FonepayModule } from '@modules/fonepay/fonepay.module';
import { Bid } from '@modules/bidding/entities/bid.entity';
import { Product } from '@modules/products/entities/product.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './services/payments.service';
import { PaymentEventsHandler } from './handlers/payment-events.handler';
import { PaymentsCron } from './cron/payments.cron';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Bid, Product]),
    // BiddingModule exports AuctionLifecycleService + AuctionBroadcastService
    BiddingModule,
    // FonepayModule exports FonepayClientService
    FonepayModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentEventsHandler, PaymentsCron],
  exports: [PaymentsService],
})
export class PaymentsModule {}
