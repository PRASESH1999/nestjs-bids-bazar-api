import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ProductDelivery } from './entities/product-delivery.entity';
import { PathaoAuthService } from './services/pathao-auth.service';
import { PathaoClientService } from './services/pathao-client.service';
import { ProductDeliveriesService } from './services/product-deliveries.service';
import { ProductDeliveriesCron } from './cron/product-deliveries.cron';
import { PathaoController } from './pathao.controller';

@Module({
  imports: [
    HttpModule,
    // Buyer notification when a courier order is cancelled (A57).
    NotificationsModule,
    TypeOrmModule.forFeature([
      ProductDelivery,
      ShippingAddress,
      ProductPayment,
      Product,
      User,
    ]),
  ],
  controllers: [PathaoController],
  providers: [
    PathaoAuthService,
    PathaoClientService,
    ProductDeliveriesService,
    ProductDeliveriesCron,
  ],
  // PathaoClientService: PaymentsModule/BiddingModule need it for the
  // inside-valley checkout gate. ProductDeliveriesService: exported for
  // symmetry, though nothing outside this module calls it directly today.
  exports: [PathaoClientService, ProductDeliveriesService],
})
export class PathaoModule {}
