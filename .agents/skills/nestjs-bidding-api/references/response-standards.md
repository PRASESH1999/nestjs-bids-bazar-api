# Response Standards Reference

> Read this before writing any controller response, interceptor,
> pagination logic, or any endpoint that returns data to the client.
> Every response — success or error — must follow the standard envelope.
> No raw returns from controllers ever.

---

## Standard Response Envelope

Every API response must follow this exact shape — no exceptions:

### Success Response
```typescript
{
  "data": { ... },          // The resource or array of resources
  "meta": null,             // null unless paginated
  "error": null             // Always null on success
}
```

### Success Response — Paginated
```typescript
{
  "data": [ ... ],          // Array of resources
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "error": null
}
```

### Error Response
```typescript
{
  "data": null,
  "meta": null,
  "error": {
    "code": "AUCTION_CLOSED",
    "message": "This auction is no longer accepting bids.",
    "statusCode": 409,

    // Only present for VALIDATION_FAILED
    "fields": [
      { "field": "amount", "message": "amount must be a positive number" }
    ]
  }
}
```

---

## TypeScript Types

```typescript
// src/common/types/api-response.type.ts

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  fields?: ApiErrorDetail[];   // Only for VALIDATION_FAILED
}

export interface ApiResponse<T> {
  data: T | null;
  meta: PaginationMeta | null;
  error: ApiError | null;
}

// Paginated service return shape
// Used to signal ResponseInterceptor to extract meta
export interface PaginatedResult<T> {
  __paginated: true;
  items: T[];
  meta: PaginationMeta;
}
```

---

## Response Interceptor — Full Implementation

```typescript
// src/common/interceptors/response.interceptor.ts
import {
  Injectable, NestInterceptor,
  ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  PaginatedResult,
} from '@common/types/api-response.type';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>> {

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T | PaginatedResult<T>) => {
        // Detect paginated result from service
        if (
          data &&
          typeof data === 'object' &&
          '__paginated' in data &&
          (data as PaginatedResult<T>).__paginated === true
        ) {
          const paginated = data as PaginatedResult<T>;
          return {
            data: paginated.items,
            meta: paginated.meta,
            error: null,
          };
        }

        // Standard single resource or array response
        return {
          data: data ?? null,
          meta: null,
          error: null,
        };
      }),
    );
  }
}
```

---

## Pagination Utilities

```typescript
// src/common/utils/pagination.util.ts
import {
  PaginationMeta,
  PaginatedResult,
} from '@common/types/api-response.type';

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    __paginated: true,
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

```typescript
// src/common/dto/pagination-query.dto.ts
import {
  IsOptional, IsInt, Min, Max,
  IsString, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';
}
```

---

## Controller Patterns

### Single Resource Response
```typescript
// ✅ Service returns raw entity/DTO
// ResponseInterceptor wraps it automatically
@Get(':id')
@ApiOperation({ summary: 'Get bid by ID' })
@ApiResponse({ status: 200, description: 'Bid retrieved successfully' })
async findOne(
  @Param('id') id: string,
): Promise<BidEntity> {
  // Service returns raw entity — interceptor wraps in { data, meta, error }
  return this.bidsService.findById(id);
}
```

### Paginated Response
```typescript
// ✅ Service returns PaginatedResult — interceptor extracts meta
@Get()
@ApiOperation({ summary: 'List bids with pagination' })
@ApiResponse({ status: 200, description: 'Bids retrieved successfully' })
async findAll(
  @Query() query: ListBidsQueryDto,
): Promise<PaginatedResult<BidEntity>> {
  return this.bidsService.findAll(query);
}
```

### Service — Paginated Return
```typescript
// ✅ Service builds PaginatedResult using utility
async findAll(query: ListBidsQueryDto): Promise<PaginatedResult<BidEntity>> {
  const [items, total] = await this.bidsRepository.findAllPaginated(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}
```

### 201 Created Response
```typescript
// ✅ Always use @HttpCode(HttpStatus.CREATED) for POST endpoints
@Post()
@HttpCode(HttpStatus.CREATED)
@RequirePermissions(Permission.BID_CREATE)
@ApiOperation({ summary: 'Place a bid' })
@ApiResponse({ status: 201, description: 'Bid placed successfully' })
async placeBid(
  @Body() dto: CreateBidDto,
  @CurrentUser() user: JwtPayload,
): Promise<BidEntity> {
  return this.bidsService.placeBid(dto, user.sub);
}
```

### 204 No Content Response
```typescript
// ✅ Use @HttpCode(204) for delete operations
// Return void — ResponseInterceptor will return { data: null, meta: null, error: null }
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@RequirePermissions(Permission.BID_DELETE)
@ApiOperation({ summary: 'Soft delete a bid' })
@ApiResponse({ status: 204, description: 'Bid deleted successfully' })
async remove(@Param('id') id: string): Promise<void> {
  return this.bidsService.remove(id);
}
```

---

## Response Mapping Rules

### Never Expose Raw Entities
```typescript
// ❌ Never return raw TypeORM entity with all fields exposed
async findById(id: string): Promise<BidEntity> {
  return this.bidsRepository.findById(id);  // Exposes password, internal fields
}

// ✅ Always map to a response DTO before returning
async findById(id: string): Promise<BidResponseDto> {
  const bid = await this.bidsRepository.findById(id);
  if (!bid) throw new ResourceNotFoundException('Bid');
  return this.mapToResponse(bid);
}

private mapToResponse(bid: BidEntity): BidResponseDto {
  return {
    id: bid.id,
    amount: parseFloat(bid.amount),     // Parse decimal string to number
    status: bid.status,
    auctionId: bid.auction.id,
    bidderId: bid.bidder.id,
    createdAt: bid.createdAt,
  };
}
```

### Fields to Always Exclude from Responses
- `password`
- `refreshTokenHash`
- `failedLoginAttempts`
- `deletedAt` (internal soft delete field)
- Any internal system fields not meant for consumers

---

## Response DTOs

```typescript
// src/modules/bids/dto/bid-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { BidStatus } from '@common/enums/bid-status.enum';

export class BidResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;               // Always number in response — never string

  @ApiProperty({ enum: BidStatus })
  status: BidStatus;

  @ApiProperty()
  auctionId: string;

  @ApiProperty()
  bidderId: string;

  @ApiProperty()
  createdAt: Date;
}

// src/modules/auctions/dto/auction-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { AuctionStatus } from '@common/enums/auction-status.enum';

export class AuctionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  startingPrice: number;         // Always number — never string

  @ApiProperty()
  currentHighestBid: number | null;

  @ApiProperty({ enum: AuctionStatus })
  status: AuctionStatus;

  @ApiProperty()
  ownerId: string;

  @ApiProperty({ nullable: true })
  closesAt: Date | null;

  @ApiProperty({ nullable: true })
  paymentDeadline: Date | null;

  @ApiProperty()
  createdAt: Date;
}
```

---

## HTTP Method → Status Code Matrix

| Method | Success Code | Notes |
|---|---|---|
| GET | 200 | Always |
| POST | 201 | Created resource |
| PATCH | 200 | Updated resource returned |
| PUT | 200 | Replaced resource returned |
| DELETE | 204 | No body returned |

---

## Query Parameter Standards

```typescript
// All list endpoints must support these standard query params
// Always extend PaginationQueryDto for list endpoints

// ✅ Pagination
GET /api/v1/bids?page=1&limit=20

// ✅ Sorting
GET /api/v1/bids?sortBy=createdAt&order=asc

// ✅ Filtering (domain-specific)
GET /api/v1/bids?status=ACCEPTED&auctionId=uuid

// ✅ Combined
GET /api/v1/bids?page=2&limit=10&sortBy=amount&order=desc&status=ACCEPTED

// ❌ Never use offset/cursor directly as query params
GET /api/v1/bids?offset=20       // Wrong — use page
GET /api/v1/bids?cursor=xxx      // Wrong — use page for now
```

---

## Response Rules Checklist

Before returning from any controller method verify:

  ✅ Service returns raw typed data — never pre-wrapped
  ✅ ResponseInterceptor handles wrapping automatically
  ✅ Monetary amounts are numbers in responses — never strings
  ✅ No sensitive fields in any response (password, tokens, hashes)
  ✅ List endpoints return PaginatedResult with meta
  ✅ POST endpoints use @HttpCode(201)
  ✅ DELETE endpoints use @HttpCode(204) and return void
  ✅ All response DTOs have @ApiProperty() on every field
  ✅ Raw entities mapped to response DTOs before returning
  ✅ deletedAt never included in any response