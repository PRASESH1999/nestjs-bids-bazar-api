import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingAddress } from './entities/shipping-address.entity';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShippingAddress])],
  controllers: [ShippingController],
  providers: [ShippingService],
  // PaymentsModule resolves and snapshots the chosen address at checkout.
  exports: [ShippingService],
})
export class ShippingModule {}
