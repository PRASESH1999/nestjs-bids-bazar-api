import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';

export type CategoryResponse = Omit<Category, 'iconPath' | 'subcategories'> & {
  iconUrl: string | null;
};

export type SubcategoryResponse = Omit<Subcategory, 'iconPath' | 'category'> & {
  iconUrl: string | null;
};

export function mapCategory(category: Category): CategoryResponse {
  const {
    iconPath: _iconPath,
    subcategories: _subcategories,
    ...rest
  } = category;
  return {
    ...rest,
    iconUrl: category.iconPath
      ? `/api/v1/categories/${category.id}/icon`
      : null,
  };
}

export function mapSubcategory(subcategory: Subcategory): SubcategoryResponse {
  const { iconPath: _iconPath, category: _category, ...rest } = subcategory;
  return {
    ...rest,
    iconUrl: subcategory.iconPath
      ? `/api/v1/subcategories/${subcategory.id}/icon`
      : null,
  };
}
