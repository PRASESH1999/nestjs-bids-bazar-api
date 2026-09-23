import { Module } from '@nestjs/common';
import { ShippingModule } from '@modules/shipping/shipping.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiddingModule } from '@modules/bidding/bidding.module';
import { FonepayModule } from '@modules/fonepay/fonepay.module';
import { PathaoModule } from '@modules/pathao/pathao.module';
import { Bid } from '@modules/bidding/entities/bid.entity';
import { ProductSettlement } from '@modules/bidding/entities/product-settlement.entity';
import { Product } from '@modules/products/entities/product.entity';
import { ProductPayment } from './entities/product-payment.entity';
import { PaymentsService } from './services/payments.service';
import { PaymentEventsHandler } from './handlers/payment-events.handler';
import { PaymentsCron } from './cron/payments.cron';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductPayment, Bid, Product, ProductSettlement]),
    // Resolves and snapshots the buyer's chosen delivery address at checkout.
    ShippingModule,
    // BiddingModule exports AuctionLifecycleService + AuctionBroadcastService
    BiddingModule,
    // FonepayModule exports FonepayClientService
    FonepayModule,
    // Exports PathaoClientService (inside-valley check) + ProductDeliveriesService
    PathaoModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentEventsHandler, PaymentsCron],
  exports: [PaymentsService],
})
export class PaymentsModule {}
