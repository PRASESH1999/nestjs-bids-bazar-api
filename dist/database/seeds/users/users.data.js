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
exports.SEED_PASSWORD = 'Test@123';
exports.SEED_USERS = [
    {
        id: exports.SEED_USER_IDS.SUPERADMIN_1,
        email: 'superadmin1@test.com',
        name: 'Super Admin One',
        username: 'superadmin1',
        role: role_enum_1.Role.SUPERADMIN,
        isEmailVerified: true,
    },
    {
        id: exports.SEED_USER_IDS.SUPERADMIN_2,
        email: 'superadmin2@test.com',
        name: 'Super Admin Two',
        username: 'superadmin2',
        role: role_enum_1.Role.SUPERADMIN,
        isEmailVerified: true,
    },
    {
        id: exports.SEED_USER_IDS.ADMIN_1,
        email: 'admin1@test.com',
        name: 'Admin One',
        username: 'admin1',
        role: role_enum_1.Role.ADMIN,
        isEmailVerified: true,
    },
    {
        id: exports.SEED_USER_IDS.ADMIN_2,
        email: 'admin2@test.com',
        name: 'Admin Two',
        username: 'admin2',
        role: role_enum_1.Role.ADMIN,
        isEmailVerified: true,
    },
    {
        id: exports.SEED_USER_IDS.USER_1,
        email: 'user1@test.com',
        name: 'User One',
        username: 'testuser1',
        role: role_enum_1.Role.USER,
        isEmailVerified: true,
    },
    {
        id: exports.SEED_USER_IDS.USER_2,
        email: 'user2@test.com',
        name: 'User Two',
        username: 'testuser2',
        role: role_enum_1.Role.USER,
        isEmailVerified: true,
    },
];
//# sourceMappingURL=users.data.js.map