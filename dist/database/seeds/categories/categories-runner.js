"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_config_1 = __importDefault(require("../../../config/typeorm.config"));
const categories_seed_1 = require("./categories.seed");
async function run() {
    console.log('Starting categories seeding...');
    try {
        if (!typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.initialize();
            console.log('Database connected.');
        }
        await (0, categories_seed_1.seedCategories)(typeorm_config_1.default);
        console.log('Categories seeding completed successfully.');
    }
    catch (error) {
        console.error('Categories seeding failed:', error);
        process.exit(1);
    }
    finally {
        if (typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.destroy();
        }
    }
}
run();
//# sourceMappingURL=categories-runner.js.map