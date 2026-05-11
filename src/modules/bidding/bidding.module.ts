import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@modules/users/users.module';
import { Product } from '@modules/products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './services/bidding.service';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { AuctionLifecycleCron } from './cron/auction-lifecycle.cron';

@Module({
  imports: [TypeOrmModule.forFeature([Bid, Product]), UsersModule],
  controllers: [BiddingController],
  providers: [BiddingService, AuctionLifecycleService, AuctionLifecycleCron],
  // AuctionLifecycleService exported so ProductsModule can use it for lazy closure
  exports: [AuctionLifecycleService],
})
export class BiddingModule {}
