"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_USERS = exports.SEED_PASSWORD = exports.SEED_USER_IDS = void 0;
const role_enum_1 = require("../../../common/enums/role.enum");
exports.SEED_USER_IDS = {
    SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
    SUPERADMIN_2: '00000000-0000-0000-0000-000000000002',
    ADMIN_1: '00000000-0000-0000-0000-000000000003',
    ADMIN_2: '00000000-0000-0000-0000-000000000004',
    USER_1: '00000000-0000-0000-0000-000000000005',
    USER_2: '00000000-0000-0000-0000-000000000006',
};
exports.SEED_PASSWORD = 'Seed123!Password';
exports.SEED_USERS = [
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
//# sourceMappingURL=users.data.js.map