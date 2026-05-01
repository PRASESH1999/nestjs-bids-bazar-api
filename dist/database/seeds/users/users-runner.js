"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_config_1 = __importDefault(require("../../../config/typeorm.config"));
const users_seed_1 = require("./users.seed");
async function run() {
    console.log('Starting users seeding...');
    try {
        if (!typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.initialize();
            console.log('Database connected.');
        }
        await (0, users_seed_1.seedUsers)(typeorm_config_1.default);
        console.log('Users seeding completed successfully.');
    }
    catch (error) {
        console.error('Users seeding failed:', error);
        process.exit(1);
    }
    finally {
        if (typeorm_config_1.default.isInitialized) {
            await typeorm_config_1.default.destroy();
        }
    }
}
void run();
//# sourceMappingURL=users-runner.js.map