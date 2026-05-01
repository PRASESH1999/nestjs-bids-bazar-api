import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycModule } from '@modules/kyc/kyc.module';
import { UsersModule } from '@modules/users/users.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { ProductStorageService } from './product-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage]),
    UsersModule,
    KycModule,
    CategoriesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, ProductStorageService],
  exports: [ProductsService],
})
export class ProductsModule {}
