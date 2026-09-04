import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@modules/products/entities/product.entity';
import { UsersModule } from '@modules/users/users.module';
import { Favorite } from './entities/favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { FavoritesRepository } from './favorites.repository';

@Module({
  // Product is registered here (not imported from ProductsModule) so this
  // module can query/join it directly without depending on ProductsModule —
  // ProductsModule depends on FavoritesModule (to flag isFavorited on every
  // product it returns), so the reverse dependency would be circular.
  // UsersModule is safe to import directly (no cycle) — used to attach seller
  // rating summaries to favorited products, same as ProductsService does.
  imports: [TypeOrmModule.forFeature([Favorite, Product]), UsersModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
  exports: [FavoritesService],
})
export class FavoritesModule {}
