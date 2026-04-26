"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_USER_IDS = void 0;
exports.seedUsers = seedUsers;
const bcrypt = __importStar(require("bcrypt"));
const user_entity_1 = require("../../modules/users/entities/user.entity");
const role_enum_1 = require("../../common/enums/role.enum");
exports.SEED_USER_IDS = {
    SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
    SUPERADMIN_2: '00000000-0000-0000-0000-000000000002',
    ADMIN_1: '00000000-0000-0000-0000-000000000003',
    ADMIN_2: '00000000-0000-0000-0000-000000000004',
    USER_1: '00000000-0000-0000-0000-000000000005',
    USER_2: '00000000-0000-0000-0000-000000000006',
};
const SEED_PASSWORD = 'Seed123!Password';
const SEED_USERS = [
    {
        id: exports.SEED_USER_IDS.SUPERADMIN_1,
        email: 'superadmin1@test.com',
        name: 'Super Admin One',
        role: role_enum_1.Role.SUPERADMIN,
    },
    {
        id: exports.SEED_USER_IDS.SUPERADMIN_2,
        email: 'superadmin2@test.com',
        name: 'Super Admin Two',
        role: role_enum_1.Role.SUPERADMIN,
    },
    {
        id: exports.SEED_USER_IDS.ADMIN_1,
        email: 'admin1@test.com',
        name: 'Admin One',
        role: role_enum_1.Role.ADMIN,
    },
    {
        id: exports.SEED_USER_IDS.ADMIN_2,
        email: 'admin2@test.com',
        name: 'Admin Two',
        role: role_enum_1.Role.ADMIN,
    },
    {
        id: exports.SEED_USER_IDS.USER_1,
        email: 'user1@test.com',
        name: 'User One',
        role: role_enum_1.Role.USER,
    },
    {
        id: exports.SEED_USER_IDS.USER_2,
        email: 'user2@test.com',
        name: 'User Two',
        role: role_enum_1.Role.USER,
    },
];
async function seedUsers(dataSource) {
    const repo = dataSource.getRepository(user_entity_1.User);
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);
    let created = 0;
    let skipped = 0;
    for (const user of SEED_USERS) {
        const existing = await repo.findOne({ where: { email: user.email } });
        if (existing) {
            skipped++;
            continue;
        }
        await repo.save(repo.create({
            id: user.id,
            email: user.email,
            password: hashedPassword,
            name: user.name,
            role: user.role,
            isActive: true,
        }));
        created++;
    }
    console.log(`  [users.seed] Created: ${created}, Skipped: ${skipped}`);
}
//# sourceMappingURL=users.seed.js.map