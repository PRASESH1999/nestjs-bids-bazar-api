import { ItemCondition } from "../../../common/enums/item-condition.enum";
export declare class CreateProductDto {
    title: string;
    description: string;
    specifications?: string;
    categoryId: string;
    subcategoryId: string;
    condition: ItemCondition;
    basePrice: number;
    biddingDurationHours?: number;
    previewImageIndex?: number;
}
