"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCategories = seedCategories;
const category_entity_1 = require("../../../modules/categories/entities/category.entity");
const subcategory_entity_1 = require("../../../modules/categories/entities/subcategory.entity");
const categories_data_1 = require("./categories.data");
async function seedCategories(dataSource) {
    let createdCategories = 0;
    let createdSubcategories = 0;
    let skipped = 0;
    await dataSource.transaction(async (manager) => {
        const catRepo = manager.getRepository(category_entity_1.Category);
        const subRepo = manager.getRepository(subcategory_entity_1.Subcategory);
        for (let displayOrder = 0; displayOrder < categories_data_1.CATEGORIES_SEED.length; displayOrder++) {
            const { name, subcategories } = categories_data_1.CATEGORIES_SEED[displayOrder];
            let category = await catRepo.findOne({ where: { name } });
            if (!category) {
                category = await catRepo.save(catRepo.create({ name, displayOrder, isActive: true }));
                createdCategories++;
            }
            else {
                skipped++;
            }
            for (let subOrder = 0; subOrder < subcategories.length; subOrder++) {
                const subName = subcategories[subOrder];
                const existingSub = await subRepo.findOne({
                    where: { categoryId: category.id, name: subName },
                });
                if (!existingSub) {
                    await subRepo.save(subRepo.create({
                        categoryId: category.id,
                        name: subName,
                        displayOrder: subOrder,
                        isActive: true,
                    }));
                    createdSubcategories++;
                }
                else {
                    skipped++;
                }
            }
        }
    });
    console.log(`  [categories.seed] Created: ${createdCategories} categories, ${createdSubcategories} subcategories, Skipped: ${skipped}`);
}
//# sourceMappingURL=categories.seed.js.map