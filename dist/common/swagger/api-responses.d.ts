import { ApiResponseOptions } from '@nestjs/swagger';
export declare const UserSchema: {
    type: string;
    properties: {
        id: {
            type: string;
            format: string;
            example: string;
        };
        name: {
            type: string;
            example: string;
        };
        email: {
            type: string;
            format: string;
            example: string;
        };
        role: {
            type: string;
            enum: string[];
            example: string;
        };
        isActive: {
            type: string;
            example: boolean;
        };
        isEmailVerified: {
            type: string;
            example: boolean;
        };
        createdAt: {
            type: string;
            format: string;
            example: string;
        };
        updatedAt: {
            type: string;
            format: string;
            example: string;
        };
        deletedAt: {
            type: string;
            format: string;
            nullable: boolean;
            example: null;
        };
    };
};
export declare const CategorySchema: {
    type: string;
    properties: {
        id: {
            type: string;
            format: string;
            example: string;
        };
        name: {
            type: string;
            example: string;
        };
        iconPath: {
            type: string;
            nullable: boolean;
            example: string;
        };
        displayOrder: {
            type: string;
            example: number;
        };
        isActive: {
            type: string;
            example: boolean;
        };
        createdAt: {
            type: string;
            format: string;
            example: string;
        };
        updatedAt: {
            type: string;
            format: string;
            example: string;
        };
    };
};
export declare const SubcategorySchema: {
    type: string;
    properties: {
        id: {
            type: string;
            format: string;
            example: string;
        };
        categoryId: {
            type: string;
            format: string;
            example: string;
        };
        name: {
            type: string;
            example: string;
        };
        iconPath: {
            type: string;
            nullable: boolean;
            example: string;
        };
        displayOrder: {
            type: string;
            example: number;
        };
        isActive: {
            type: string;
            example: boolean;
        };
        createdAt: {
            type: string;
            format: string;
            example: string;
        };
        updatedAt: {
            type: string;
            format: string;
            example: string;
        };
    };
};
export declare const R400: ApiResponseOptions;
export declare const R401: ApiResponseOptions;
export declare const R403: ApiResponseOptions;
export declare const R404: ApiResponseOptions;
export declare const R409: ApiResponseOptions;
export declare const R410: ApiResponseOptions;
export declare const R429: ApiResponseOptions;
export declare const MessageResponse: (message: string) => ApiResponseOptions;
export declare const AccessTokenResponse: ApiResponseOptions;
export declare const SuccessResponse: ApiResponseOptions;
