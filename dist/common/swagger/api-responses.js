"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuccessResponse = exports.AccessTokenResponse = exports.MessageResponse = exports.R429 = exports.R410 = exports.R409 = exports.R404 = exports.R403 = exports.R401 = exports.R400 = exports.SubcategorySchema = exports.CategorySchema = exports.UserSchema = void 0;
const err = (code, message, statusCode, withFields = false) => ({
    type: 'object',
    properties: {
        data: { type: 'null', example: null },
        meta: { type: 'null', example: null },
        error: {
            type: 'object',
            properties: {
                code: { type: 'string', example: code },
                message: { type: 'string', example: message },
                statusCode: { type: 'number', example: statusCode },
                ...(withFields
                    ? {
                        fields: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field: { type: 'string', example: 'email' },
                                    message: {
                                        type: 'string',
                                        example: 'email must be an email',
                                    },
                                },
                            },
                        },
                    }
                    : {}),
            },
        },
    },
});
exports.UserSchema = {
    type: 'object',
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            example: '00000000-0000-0000-0000-000000000005',
        },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', format: 'email', example: 'john@example.com' },
        role: {
            type: 'string',
            enum: ['USER', 'ADMIN', 'SUPERADMIN'],
            example: 'USER',
        },
        isActive: { type: 'boolean', example: true },
        isEmailVerified: { type: 'boolean', example: true },
        createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
        deletedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: null,
        },
    },
};
exports.CategorySchema = {
    type: 'object',
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            example: '11000000-0000-0000-0000-000000000001',
        },
        name: { type: 'string', example: 'Electronics' },
        iconPath: { type: 'string', nullable: true, example: '/category-icons/electronics.png' },
        displayOrder: { type: 'number', example: 0 },
        isActive: { type: 'boolean', example: true },
        createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
    },
};
exports.SubcategorySchema = {
    type: 'object',
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            example: '22000000-0000-0000-0000-000000000001',
        },
        categoryId: {
            type: 'string',
            format: 'uuid',
            example: '11000000-0000-0000-0000-000000000001',
        },
        name: { type: 'string', example: 'Mobile Phones' },
        iconPath: { type: 'string', nullable: true, example: '/category-icons/mobile.png' },
        displayOrder: { type: 'number', example: 0 },
        isActive: { type: 'boolean', example: true },
        createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
        },
    },
};
exports.R400 = {
    status: 400,
    description: 'Validation failed — one or more request fields are invalid.',
    schema: err('VALIDATION_FAILED', 'Request validation failed.', 400, true),
};
exports.R401 = {
    status: 401,
    description: 'Unauthorized — missing, expired, or invalid JWT access token.',
    schema: err('UNAUTHORIZED', 'Unauthorized', 401),
};
exports.R403 = {
    status: 403,
    description: 'Forbidden — insufficient permissions for this action.',
    schema: err('FORBIDDEN', 'Forbidden resource', 403),
};
exports.R404 = {
    status: 404,
    description: 'Not found — the requested resource does not exist.',
    schema: err('NOT_FOUND', 'Resource not found', 404),
};
exports.R409 = {
    status: 409,
    description: 'Conflict — a resource with the same unique value already exists.',
    schema: err('CONFLICT', 'Resource already exists', 409),
};
exports.R410 = {
    status: 410,
    description: 'Gone — the resource existed but is no longer available (e.g. expired token).',
    schema: err('GONE', 'Verification link has expired. Please request a new one.', 410),
};
exports.R429 = {
    status: 429,
    description: 'Too many requests — rate limit exceeded. Retry after some time.',
    schema: err('TOO_MANY_REQUESTS', 'Too many requests. Please try again later.', 429),
};
const MessageResponse = (message) => ({
    schema: {
        type: 'object',
        properties: {
            message: { type: 'string', example: message },
        },
    },
});
exports.MessageResponse = MessageResponse;
exports.AccessTokenResponse = {
    schema: {
        type: 'object',
        properties: {
            accessToken: {
                type: 'string',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                description: 'Short-lived JWT. Send as Authorization: Bearer <token> on protected routes.',
            },
        },
    },
};
exports.SuccessResponse = {
    schema: {
        type: 'object',
        properties: {
            success: { type: 'boolean', example: true },
        },
    },
};
//# sourceMappingURL=api-responses.js.map