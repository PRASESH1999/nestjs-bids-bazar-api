# Swagger Standards Reference

> Read this before adding any Swagger decorator to any controller,
> DTO, entity, or endpoint.
> Swagger must always be in sync with the actual API behavior —
> never let them drift apart.
> Swagger is enabled in development and staging only — never production.

---

## Setup — Already Configured in main.ts

```typescript
// Already in main.ts — reference only
// See references/bootstrap.md for full implementation

if (env !== 'production') {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bids Bazzar')
    .setDescription('English auction platform REST API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer(`http://localhost:${port}`, 'Local')
    .addServer('https://staging.yourdomain.com', 'Staging')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
```

---

## Controller Decorators — Required on Every Controller

```typescript
// ✅ Every controller must have these two decorators
@ApiTags('bids')                    // Groups endpoints in Swagger UI
@Controller('bids')
export class BidsController {
  // ...
}

// ✅ Protected controllers must also have ApiBearerAuth
@ApiTags('bids')
@ApiBearerAuth('access-token')      // 'access-token' must match addBearerAuth name
@Controller('bids')
export class BidsController {
  // ...
}
```

---

## Endpoint Decorators — Required on Every Endpoint

```typescript
// ✅ Minimum required on every endpoint
@Get(':id')
@ApiOperation({ summary: 'Get bid by ID' })
@ApiResponse({ status: 200, description: 'Bid retrieved successfully' })
async findOne(@Param('id') id: string): Promise<BidResponseDto> {}

// ✅ Full decorator set for a protected endpoint
@Post()
@HttpCode(HttpStatus.CREATED)
@RequirePermissions(Permission.BID_CREATE)
@ApiBearerAuth('access-token')
@ApiOperation({
  summary: 'Place a bid on an auction',
  description: `
    Places a bid on an active auction.
    Bid must be strictly greater than the current highest bid.
    Bidder cannot be the auction owner.
    Bidder cannot already hold the highest bid.
  `,
})
@ApiBody({ type: CreateBidDto })
@ApiResponse({
  status: 201,
  description: 'Bid placed successfully',
  type: BidResponseDto,
})
@ApiResponse({
  status: 400,
  description: 'Validation failed — see fields array in error',
})
@ApiResponse({
  status: 403,
  description: 'Self-bidding not allowed OR insufficient permissions',
})
@ApiResponse({
  status: 409,
  description: 'Auction closed OR duplicate leading bid',
})
@ApiResponse({
  status: 422,
  description: 'Bid amount below minimum',
})
async placeBid(
  @Body() dto: CreateBidDto,
  @CurrentUser() user: JwtPayload,
): Promise<BidResponseDto> {}
```

---

## Required @ApiResponse Per Endpoint Type

### GET (single resource)
```typescript
@ApiResponse({ status: 200, description: 'Resource retrieved', type: ResponseDto })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: 'Resource not found' })
```

### GET (list / paginated)
```typescript
@ApiResponse({ status: 200, description: 'Resources retrieved', type: [ResponseDto] })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
```

### POST (create)
```typescript
@ApiResponse({ status: 201, description: 'Resource created', type: ResponseDto })
@ApiResponse({ status: 400, description: 'Validation failed' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 409, description: 'Conflict — describe specific case' })
```

### PATCH (update)
```typescript
@ApiResponse({ status: 200, description: 'Resource updated', type: ResponseDto })
@ApiResponse({ status: 400, description: 'Validation failed' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: 'Resource not found' })
```

### DELETE (soft delete)
```typescript
@ApiResponse({ status: 204, description: 'Resource deleted' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: 'Resource not found' })
```

---

## DTO Decorators — @ApiProperty Rules

### Every Field Must Have @ApiProperty
```typescript
// ✅ Required field
@ApiProperty({
  description: 'UUID of the auction to bid on',
  example: '550e8400-e29b-41d4-a716-446655440000',
})
@IsUUID()
auctionId: string;

// ✅ Optional field — use @ApiPropertyOptional
@ApiPropertyOptional({
  description: 'Filter by bid status',
  enum: BidStatus,
  example: BidStatus.ACCEPTED,
})
@IsOptional()
@IsEnum(BidStatus)
status?: BidStatus;

// ✅ Number field
@ApiProperty({
  description: 'Bid amount — must exceed current highest bid',
  example: 150.00,
  minimum: 0.01,
  type: Number,
})
@IsNumber({ maxDecimalPlaces: 2 })
@IsPositive()
amount: number;

// ✅ Enum field
@ApiProperty({
  description: 'Current bid status',
  enum: BidStatus,
  example: BidStatus.ACCEPTED,
})
status: BidStatus;

// ✅ Array field
@ApiProperty({
  description: 'User roles',
  enum: Role,
  isArray: true,
  example: [Role.BIDDER],
})
roles: Role[];

// ✅ Nested object field
@ApiProperty({
  description: 'Auction owner details',
  type: () => UserResponseDto,   // Use arrow function for circular refs
})
owner: UserResponseDto;

// ✅ Nullable field
@ApiProperty({
  description: 'Auction closing time — null until first bid placed',
  nullable: true,
  example: '2026-04-23T10:32:01.123Z',
})
closesAt: Date | null;

// ✅ Date field
@ApiProperty({
  description: 'Bid creation timestamp',
  example: '2026-04-23T10:32:01.123Z',
  type: String,
  format: 'date-time',
})
createdAt: Date;

// ✅ Boolean field
@ApiProperty({
  description: 'Whether the account is locked',
  example: false,
  default: false,
})
isLocked: boolean;
```

### @ApiProperty Field Type Reference
| TypeScript Type | @ApiProperty Config |
|---|---|
| `string` | `type: String` (default) |
| `number` | `type: Number` |
| `boolean` | `type: Boolean` |
| `Date` | `type: String, format: 'date-time'` |
| `string[]` | `type: [String]` or `isArray: true` |
| `enum` | `enum: EnumName` |
| `enum[]` | `enum: EnumName, isArray: true` |
| `DTO` | `type: () => DtoName` |
| `DTO[]` | `type: () => DtoName, isArray: true` |
| nullable | add `nullable: true` |

---

## Complete Controller Example

```typescript
// src/modules/bids/bids.controller.ts
import {
  Controller, Get, Post, Delete,
  Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiBearerAuth, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { BidResponseDto } from './dto/bid-response.dto';
import { ListBidsQueryDto } from './dto/list-bids-query.dto';
import { PaginatedResult } from '@common/types/api-response.type';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/types/jwt-payload.type';

@ApiTags('bids')
@ApiBearerAuth('access-token')
@Controller('bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  // ── GET /bids ──────────────────────────────────────────────────────────
  @Get()
  @RequirePermissions(Permission.BID_VIEW)
  @ApiOperation({ summary: 'List all bids with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Bids retrieved successfully',
    type: [BidResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @Query() query: ListBidsQueryDto,
  ): Promise<PaginatedResult<BidResponseDto>> {
    return this.bidsService.findAll(query);
  }

  // ── GET /bids/:id ──────────────────────────────────────────────────────
  @Get(':id')
  @RequirePermissions(Permission.BID_VIEW)
  @ApiOperation({ summary: 'Get a bid by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Bid UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Bid retrieved successfully',
    type: BidResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Bid not found' })
  async findOne(
    @Param('id') id: string,
  ): Promise<BidResponseDto> {
    return this.bidsService.findById(id);
  }

  // ── POST /bids ─────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.BID_CREATE)
  @ApiOperation({
    summary: 'Place a bid on an auction',
    description: `
      Places a bid on an active auction.
      Requirements:
      - Auction must be ACTIVE or PENDING (first bid activates it)
      - Bid must be strictly greater than current highest bid
      - Bidder cannot be the auction owner
      - Bidder cannot already hold the highest bid
    `,
  })
  @ApiBody({ type: CreateBidDto })
  @ApiResponse({
    status: 201,
    description: 'Bid placed successfully',
    type: BidResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Self-bidding not allowed OR insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'Auction closed OR already leading bidder',
  })
  @ApiResponse({
    status: 422,
    description: 'Bid amount below minimum or increment violation',
  })
  async placeBid(
    @Body() dto: CreateBidDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BidResponseDto> {
    return this.bidsService.placeBid(dto, user.sub);
  }

  // ── DELETE /bids/:id ───────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.BID_VIEW_OWN)
  @ApiOperation({ summary: 'Soft delete a bid (DRAFT status only)' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Bid UUID',
  })
  @ApiResponse({ status: 204, description: 'Bid deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Bid not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete bid — already submitted',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.bidsService.remove(id, user.sub);
  }
}
```

---

## Public Endpoint Swagger Pattern

```typescript
// ✅ Public endpoints — no @ApiBearerAuth on the method
// Remove @ApiBearerAuth from controller level if most routes are public
@Get('auctions')
@Public()
@ApiOperation({ summary: 'List all active auctions — no auth required' })
@ApiResponse({
  status: 200,
  description: 'Auctions retrieved successfully',
  type: [AuctionResponseDto],
})
async findAll(): Promise<AuctionResponseDto[]> {}
```

---

## Query Parameter Swagger Pattern

```typescript
// src/modules/bids/dto/list-bids-query.dto.ts
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { BidStatus } from '@common/enums/bid-status.enum';

export class ListBidsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by bid status',
    enum: BidStatus,
    example: BidStatus.ACCEPTED,
  })
  @IsOptional()
  @IsEnum(BidStatus)
  status?: BidStatus;

  @ApiPropertyOptional({
    description: 'Filter by auction ID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  auctionId?: string;
}
```

---

## Swagger Tags Reference

Use these exact tag names — keeps Swagger UI organized:

| Tag | Controller |
|---|---|
| `auth` | AuthController |
| `bids` | BidsController |
| `auctions` | AuctionsController |
| `users` | UsersController |
| `health` | AppController |

---

## Swagger Checklist

Before marking any controller or endpoint done verify:

  ✅ Controller has @ApiTags() with correct tag name
  ✅ Protected controller has @ApiBearerAuth('access-token')
  ✅ Every endpoint has @ApiOperation() with summary
  ✅ Every endpoint has @ApiResponse() for every possible status code
  ✅ Every DTO field has @ApiProperty() or @ApiPropertyOptional()
  ✅ Every @ApiProperty() has description and example
  ✅ Enum fields use enum: EnumName in @ApiProperty()
  ✅ Nullable fields have nullable: true in @ApiProperty()
  ✅ Date fields have type: String, format: 'date-time'
  ✅ Path params have @ApiParam() with format: 'uuid' for IDs
  ✅ POST endpoints have @ApiBody()
  ✅ Public endpoints do NOT have @ApiBearerAuth()
  ✅ Swagger UI accessible at /api/v1/docs in dev and staging
  ✅ Swagger NOT accessible in production