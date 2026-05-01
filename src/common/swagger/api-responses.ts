import { ApiResponseOptions } from '@nestjs/swagger';

// ─── Schema Factories ─────────────────────────────────────────────────────────

const err = (
  code: string,
  message: string,
  statusCode: number,
  withFields = false,
) => ({
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

// ─── Shared Object Schemas ────────────────────────────────────────────────────

export const UserSchema = {
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

export const CategorySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      example: '11000000-0000-0000-0000-000000000001',
    },
    name: { type: 'string', example: 'Electronics' },
    iconPath: {
      type: 'string',
      nullable: true,
      example: '/category-icons/electronics.png',
    },
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

export const SubcategorySchema = {
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
    iconPath: {
      type: 'string',
      nullable: true,
      example: '/category-icons/mobile.png',
    },
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

// ─── Common Error Responses ───────────────────────────────────────────────────

export const R400: ApiResponseOptions = {
  status: 400,
  description: 'Validation failed — one or more request fields are invalid.',
  schema: err('VALIDATION_FAILED', 'Request validation failed.', 400, true),
};

export const R401: ApiResponseOptions = {
  status: 401,
  description: 'Unauthorized — missing, expired, or invalid JWT access token.',
  schema: err('UNAUTHORIZED', 'Unauthorized', 401),
};

export const R403: ApiResponseOptions = {
  status: 403,
  description: 'Forbidden — insufficient permissions for this action.',
  schema: err('FORBIDDEN', 'Forbidden resource', 403),
};

export const R404: ApiResponseOptions = {
  status: 404,
  description: 'Not found — the requested resource does not exist.',
  schema: err('NOT_FOUND', 'Resource not found', 404),
};

export const R409: ApiResponseOptions = {
  status: 409,
  description:
    'Conflict — a resource with the same unique value already exists.',
  schema: err('CONFLICT', 'Resource already exists', 409),
};

export const R410: ApiResponseOptions = {
  status: 410,
  description:
    'Gone — the resource existed but is no longer available (e.g. expired token).',
  schema: err(
    'GONE',
    'Verification link has expired. Please request a new one.',
    410,
  ),
};

export const R429: ApiResponseOptions = {
  status: 429,
  description:
    'Too many requests — rate limit exceeded. Retry after some time.',
  schema: err(
    'TOO_MANY_REQUESTS',
    'Too many requests. Please try again later.',
    429,
  ),
};

// ─── Shared Success Responses ─────────────────────────────────────────────────

export const MessageResponse = (message: string): ApiResponseOptions => ({
  schema: {
    type: 'object',
    properties: {
      message: { type: 'string', example: message },
    },
  },
});

export const AccessTokenResponse: ApiResponseOptions = {
  schema: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description:
          'Short-lived JWT. Send as Authorization: Bearer <token> on protected routes.',
      },
    },
  },
};

export const SuccessResponse: ApiResponseOptions = {
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
    },
  },
};
