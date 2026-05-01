"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const kyc_module_1 = require("../kyc/kyc.module");
const users_module_1 = require("../users/users.module");
const categories_module_1 = require("../categories/categories.module");
const product_entity_1 = require("./entities/product.entity");
const product_image_entity_1 = require("./entities/product-image.entity");
const products_controller_1 = require("./products.controller");
const products_service_1 = require("./products.service");
const products_repository_1 = require("./products.repository");
const product_storage_service_1 = require("./product-storage.service");
let ProductsModule = class ProductsModule {
};
exports.ProductsModule = ProductsModule;
exports.ProductsModule = ProductsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([product_entity_1.Product, product_image_entity_1.ProductImage]),
            users_module_1.UsersModule,
            kyc_module_1.KycModule,
            categories_module_1.CategoriesModule,
        ],
        controllers: [products_controller_1.ProductsController],
        providers: [products_service_1.ProductsService, products_repository_1.ProductsRepository, product_storage_service_1.ProductStorageService],
        exports: [products_service_1.ProductsService],
    })
], ProductsModule);
//# sourceMappingURL=products.module.js.map