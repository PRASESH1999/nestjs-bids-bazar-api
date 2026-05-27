import { ItemCondition } from "../../../common/enums/item-condition.enum";
import { PaginationDto } from "../../../common/dto/pagination.dto";
export declare enum ProductSortBy {
    PRICE = "price",
    ENDING_SOON = "endingSoon",
    NEWEST = "newest"
}
export declare enum ProductSortOrder {
    ASC = "asc",
    DESC = "desc"
}
export declare class ListProductsQueryDto extends PaginationDto {
    categoryId?: string;
    subcategoryId?: string;
    condition?: ItemCondition;
    keyword?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: ProductSortBy;
    order?: ProductSortOrder;
}
