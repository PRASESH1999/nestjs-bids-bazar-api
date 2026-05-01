import { ProductStatus } from "../../../common/enums/product-status.enum";
import { ListProductsQueryDto } from './list-products-query.dto';
export declare class AdminListProductsQueryDto extends ListProductsQueryDto {
    status?: ProductStatus;
    ownerId?: string;
}
