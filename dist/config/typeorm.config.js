"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceOptions = void 0;
const typeorm_1 = require("typeorm");
const dotenv_1 = require("dotenv");
const user_entity_1 = require("../modules/users/entities/user.entity");
const category_entity_1 = require("../modules/categories/entities/category.entity");
const subcategory_entity_1 = require("../modules/categories/entities/subcategory.entity");
(0, dotenv_1.config)({ path: '.env.development' });
exports.dataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
    entities: [user_entity_1.User, category_entity_1.Category, subcategory_entity_1.Subcategory],
    migrations: ['src/migrations/*.ts'],
    synchronize: true,
};
const dataSource = new typeorm_1.DataSource(exports.dataSourceOptions);
exports.default = dataSource;
//# sourceMappingURL=typeorm.config.js.map