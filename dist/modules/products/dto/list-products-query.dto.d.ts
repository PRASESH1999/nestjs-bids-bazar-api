import { ItemCondition } from "../../../common/enums/item-condition.enum";
import { PaginationDto } from "../../../common/dto/pagination.dto";
export declare class ListProductsQueryDto extends PaginationDto {
    categoryId?: string;
    subcategoryId?: string;
    condition?: ItemCondition;
    keyword?: string;
}
