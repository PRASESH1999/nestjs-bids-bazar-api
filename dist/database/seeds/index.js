"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_config_1 = __importDefault(require("../../config/typeorm.config"));
const users_seed_1 = require("./users/users.seed");
const categories_seed_1 = require("./categories/categories.seed");
async function runSeeds() {
    console.log('Starting database seeding...');
    try {
        if (!typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.initialize();
            console.log('Database connected.');
        }
        await (0, users_seed_1.seedUsers)(typeorm_config_1.default);
        await (0, categories_seed_1.seedCategories)(typeorm_config_1.default);
        console.log('Seeding completed successfully.');
    }
    catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
    finally {
        if (typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.destroy();
        }
    }
}
runSeeds();
//# sourceMappingURL=index.js.map