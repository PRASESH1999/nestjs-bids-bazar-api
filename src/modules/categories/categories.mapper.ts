import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';

export type CategoryResponse = Omit<Category, 'iconPath' | 'subcategories'> & {
  iconUrl: string | null;
  /*
   * How many subcategories hang off this category. Null when the caller did not
   * ask for counts.
   *
   * "How many subcategories does this have?" is the first question an admin
   * taxonomy screen has to answer for every row, and without this it could only
   * be answered by firing one `GET /admin/subcategories?categoryId=…` per
   * category — N requests to render one list. See OPEN-ITEMS A18.
   */
  subcategoryCount: number | null;
};

export type SubcategoryResponse = Omit<Subcategory, 'iconPath' | 'category'> & {
  iconUrl: string | null;
};

export function mapCategory(
  category: Category,
  subcategoryCount: number | null = null,
): CategoryResponse {
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
    subcategoryCount,
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
