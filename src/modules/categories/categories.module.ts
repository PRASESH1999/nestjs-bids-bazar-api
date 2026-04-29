import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { SubcategoriesController } from './subcategories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { IconStorageService } from './icon-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory])],
  controllers: [
    CategoriesController,
    SubcategoriesController,
    AdminCategoriesController,
  ],
  providers: [CategoriesService, IconStorageService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
