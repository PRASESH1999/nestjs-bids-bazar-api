import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@modules/users/users.module';
import { Product } from '@modules/products/entities/product.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { Bid } from './entities/bid.entity';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './services/bidding.service';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { AuctionBroadcastService } from './services/auction-broadcast.service';
import { AuctionLifecycleCron } from './cron/auction-lifecycle.cron';
import { BidSubmittedHandler } from './handlers/bid-submitted.handler';
import { AuctionClosedHandler } from './handlers/auction-closed.handler';
import { AuctionSettledHandler } from './handlers/auction-settled.handler';

@Module({
  imports: [TypeOrmModule.forFeature([Bid, Product, Payment]), UsersModule],
  controllers: [BiddingController],
  providers: [
    BiddingService,
    AuctionLifecycleService,
    AuctionBroadcastService,
    AuctionLifecycleCron,
    // Event handlers — registered as providers to receive @OnEvent dispatches.
    BidSubmittedHandler,
    AuctionClosedHandler,
    AuctionSettledHandler,
  ],
  // Exported so ProductsModule can use them (lazy closure + top-bidders list).
  // AuctionBroadcastService exported so PaymentsModule can push payment SSE events.
  exports: [AuctionLifecycleService, BiddingService, AuctionBroadcastService],
})
export class BiddingModule {}
