import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@modules/products/entities/product.entity';
import { ProductReport } from './entities/product-report.entity';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

@Module({
  // Product is registered here (not imported from ProductsModule) so this
  // module can query it directly without depending on ProductsModule —
  // mirrors FavoritesModule's reasoning for the same import.
  imports: [TypeOrmModule.forFeature([ProductReport, Product])],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
