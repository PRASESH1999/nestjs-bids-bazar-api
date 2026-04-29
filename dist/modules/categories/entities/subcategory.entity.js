"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subcategory = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("../../../common/entities/base.entity");
const category_entity_1 = require("./category.entity");
let Subcategory = class Subcategory extends base_entity_1.BaseEntity {
    categoryId;
    category;
    name;
    iconPath;
    displayOrder;
    isActive;
};
exports.Subcategory = Subcategory;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Subcategory.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => category_entity_1.Category, (category) => category.subcategories),
    (0, typeorm_1.JoinColumn)({ name: 'categoryId' }),
    __metadata("design:type", category_entity_1.Category)
], Subcategory.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], Subcategory.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Subcategory.prototype, "iconPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Subcategory.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Subcategory.prototype, "isActive", void 0);
exports.Subcategory = Subcategory = __decorate([
    (0, typeorm_1.Entity)('subcategories'),
    (0, typeorm_1.Index)(['categoryId', 'name'], { unique: true })
], Subcategory);
//# sourceMappingURL=subcategory.entity.js.map