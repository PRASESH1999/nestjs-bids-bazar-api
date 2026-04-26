---
name: create-endpoint
description: >
  Use this skill when the user asks to add a new endpoint or route to an
  existing module. Triggers include: "add an endpoint for X", "create a
  GET route for Y", "add a POST endpoint to the bids module", "I need a
  new route that does Z", "add pagination to the auctions list endpoint",
  "create a PATCH route for closing an auction". Always read this skill
  before adding any new route, controller method, service method,
  repository method, or DTO.
---

# Skill: create-endpoint

## References — Read Before Starting
Always read these before generating any file:

- [SKILL.md] — project context, stack, open decisions
- [references/conventions.md] — naming rules
- [references/response-standards.md] — response envelope, status codes
- [references/swagger-standards.md] — required decorators
- [references/rbac.md] — permissions and guards
- [references/typeorm-patterns.md] — repository query patterns
- [references/error-handling.md] — domain exceptions
- [references/logging.md] — log statements
- [references/cls-context.md] — user context in services
- [references/testing-standards.md] — test patterns

---

## Step 0 — Extract Endpoint Details

Before writing any code extract and confirm:

| Detail | Extract From Request |
|---|---|
| Module | Which existing module does this belong to? |
| HTTP method | GET / POST / PATCH / PUT / DELETE |
| Route path | e.g. `/auctions/:id/close` |
| Purpose | What does this endpoint do? |
| Auth required | Protected or @Public()? |
| Permission | Which Permission enum value is needed? |
| Request input | Body DTO / Query DTO / Path param / None |
| Response shape | What does it return? |
| Domain rules | Any business rules to enforce? |

If any detail is ambiguous — ask before generating.
Never assume HTTP method or route path — these are critical decisions.

---

## Step 1 — Check Open Decisions

Check SKILL.md Section 7 before writing any domain logic.
If the endpoint touches an unresolved decision — surface it first.

---

## Step 2 — Determine What Needs to be Added

Every endpoint requires changes across multiple layers.
Always generate ALL of the following — never partial:
Layer           | What to Add
─────────────── | ──────────────────────────────────────────
Controller      | New method with full decorator set
Service         | New method with business logic
Repository      | New query method if DB access needed
DTOs            | Request DTO (if input) + Response DTO update
Tests           | Unit test cases for new service method
| E2E test cases for new endpoint

---

## Step 3 — Generate Each Layer

### Controller Method

```typescript
// Rules:
// - HTTP layer only — no business logic ever
// - Full decorator set on every method
// - @HttpCode(201) for POST, @HttpCode(204) for DELETE
// - @Public() for unauthenticated routes
// - @RequirePermissions() for protected routes
// - @ApiBearerAuth() on protected methods
// - Never catch exceptions — let GlobalExceptionFilter handle

// ── GET (single resource) ──────────────────────────────────────────────
@Get(':id')
@RequirePermissions(Permission.<MODULE>_VIEW)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Get <resource> by ID' })
@ApiParam({ name: 'id', type: String, format: 'uuid' })
@ApiResponse({ status: 200, type: <Resource>ResponseDto })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: '<Resource> not found' })
async findOne(
  @Param('id') id: string,
): Promise<<Resource>ResponseDto> {
  return this.<module>Service.findById(id);
}

// ── GET (paginated list) ───────────────────────────────────────────────
@Get()
@RequirePermissions(Permission.<MODULE>_VIEW)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'List <resource>s with pagination' })
@ApiResponse({ status: 200, type: [<Resource>ResponseDto] })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
async findAll(
  @Query() query: List<Resource>QueryDto,
): Promise<PaginatedResult<<Resource>ResponseDto>> {
  return this.<module>Service.findAll(query);
}

// ── POST (create) ──────────────────────────────────────────────────────
@Post()
@HttpCode(HttpStatus.CREATED)
@RequirePermissions(Permission.<MODULE>_CREATE)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Create a new <resource>' })
@ApiBody({ type: Create<Resource>Dto })
@ApiResponse({ status: 201, type: <Resource>ResponseDto })
@ApiResponse({ status: 400, description: 'Validation failed' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
async create(
  @Body() dto: Create<Resource>Dto,
  @CurrentUser() user: JwtPayload,
): Promise<<Resource>ResponseDto> {
  return this.<module>Service.create(dto, user.sub);
}

// ── PATCH (partial update) ─────────────────────────────────────────────
@Patch(':id')
@RequirePermissions(Permission.<MODULE>_UPDATE)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Update <resource>' })
@ApiParam({ name: 'id', type: String, format: 'uuid' })
@ApiBody({ type: Update<Resource>Dto })
@ApiResponse({ status: 200, type: <Resource>ResponseDto })
@ApiResponse({ status: 400, description: 'Validation failed' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: '<Resource> not found' })
async update(
  @Param('id') id: string,
  @Body() dto: Update<Resource>Dto,
  @CurrentUser() user: JwtPayload,
): Promise<<Resource>ResponseDto> {
  return this.<module>Service.update(id, dto, user.sub);
}

// ── PATCH (domain action — e.g. close auction) ─────────────────────────
@Patch(':id/close')
@RequirePermissions(Permission.AUCTION_CLOSE)
@ApiBearerAuth('access-token')
@ApiOperation({
  summary: 'Close an auction',
  description: 'Manually closes an auction. Owner or ADMIN only.',
})
@ApiParam({ name: 'id', type: String, format: 'uuid' })
@ApiResponse({ status: 200, type: AuctionResponseDto })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden — not owner or ADMIN' })
@ApiResponse({ status: 404, description: 'Auction not found' })
@ApiResponse({ status: 409, description: 'Invalid auction state' })
async closeAuction(
  @Param('id') id: string,
  @CurrentUser() user: JwtPayload,
): Promise<AuctionResponseDto> {
  return this.auctionsService.closeAuction(id, user.sub);
}

// ── DELETE (soft delete) ───────────────────────────────────────────────
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@RequirePermissions(Permission.<MODULE>_DELETE)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Soft delete <resource>' })
@ApiParam({ name: 'id', type: String, format: 'uuid' })
@ApiResponse({ status: 204, description: '<Resource> deleted' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiResponse({ status: 404, description: '<Resource> not found' })
async remove(
  @Param('id') id: string,
  @CurrentUser() user: JwtPayload,
): Promise<void> {
  return this.<module>Service.remove(id, user.sub);
}

// ── Public GET ─────────────────────────────────────────────────────────
@Get()
@Public()
@ApiOperation({ summary: 'List all active auctions — public' })
@ApiResponse({ status: 200, type: [AuctionResponseDto] })
async findAll(
  @Query() query: ListAuctionsQueryDto,
): Promise<PaginatedResult<AuctionResponseDto>> {
  return this.auctionsService.findAll(query);
}
```

---

### Service Method

```typescript
// Rules:
// - Business logic only — no HTTP concerns, no raw DB queries
// - Read userId from CLS — never pass as method arg unless needed
//   for ownership checks that come from controller context
// - Throw domain exceptions for business rule violations
// - Log critical operations at log (info) level
// - Map entities to response DTOs before returning
// - Never return raw entities from public service methods

// ── Standard findAll (paginated) ──────────────────────────────────────
async findAll(
  query: List<Resource>QueryDto,
): Promise<PaginatedResult<<Resource>ResponseDto>> {
  const [items, total] = await this.<module>Repository
    .findAllPaginated(query);

  const mapped = items.map((e) => this.mapToResponse(e));
  return buildPaginatedResult(mapped, total, query.page, query.limit);
}

// ── Standard findById ─────────────────────────────────────────────────
async findById(id: string): Promise<<Resource>ResponseDto> {
  const entity = await this.<module>Repository.findById(id);
  if (!entity) throw new ResourceNotFoundException('<Resource>');
  return this.mapToResponse(entity);
}

// ── Standard create ───────────────────────────────────────────────────
async create(
  dto: Create<Resource>Dto,
): Promise<<Resource>ResponseDto> {
  const requestId = this.cls.get<string>('requestId');
  const userId = this.cls.get<string>('userId');

  const entity = await this.<module>Repository.create({ ...dto });

  this.logger.log('<Resource> created', {
    requestId,
    userId,
    <resource>Id: entity.id,
  });

  return this.mapToResponse(entity);
}

// ── Domain action with ownership check ────────────────────────────────
async closeAuction(
  auctionId: string,
  requestingUserId: string,
): Promise<AuctionResponseDto> {
  const requestId = this.cls.get<string>('requestId');
  const userRoles = this.cls.get<string[]>('userRoles') ?? [];

  const auction = await this.auctionsRepository.findById(auctionId);
  if (!auction) throw new AuctionNotFoundException();

  // Ownership check — ADMIN bypasses
  const isAdmin = userRoles.includes(Role.ADMIN);
  if (!isAdmin && auction.owner.id !== requestingUserId) {
    throw new AuctionOwnershipException();
  }

  // State transition validation
  const validNext = VALID_AUCTION_TRANSITIONS[auction.status];
  if (!validNext.includes(AuctionStatus.CLOSED)) {
    throw new InvalidAuctionStateException(
      auction.status,
      AuctionStatus.CLOSED,
    );
  }

  const updated = await this.auctionsRepository.update(
    auctionId,
    { status: AuctionStatus.CLOSED },
  );

  this.logger.log('Auction closed manually', {
    requestId,
    requestingUserId,
    auctionId,
  });

  this.eventEmitter.emit(EventNames.AUCTION_CLOSED, {
    auctionId,
    closedAt: new Date(),
    winnerId: auction.currentWinnerId,
    winningAmount: auction.currentHighestBid
      ? parseFloat(auction.currentHighestBid)
      : null,
    totalBids: 0,
  });

  return this.mapToResponse(updated!);
}

// ── Private mapToResponse — always present ─────────────────────────────
private mapToResponse(
  entity: <Resource>Entity,
): <Resource>ResponseDto {
  return {
    id: entity.id,
    // Map domain-specific fields
    // Never include: deletedAt, password, tokens, hashes
    // Parse decimal strings to numbers for monetary fields
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
```

---

### Repository Method

```typescript
// Rules:
// - DB access only — no business logic
// - Always parameterized queries — never string interpolation
// - Always accept optional QueryRunner for transaction support
// - Soft deletes only — never hard delete
// - Select only needed columns — never SELECT *
// - Always paginate list queries

// ── Paginated list query ───────────────────────────────────────────────
async findAllPaginated(
  query: List<Resource>QueryDto,
): Promise<[<Resource>Entity[], number]> {
  const qb = this.repo
    .createQueryBuilder('<resource>')
    .where('<resource>.deleted_at IS NULL');

  // Apply filters
  if (query.status) {
    qb.andWhere('<resource>.status = :status', {
      status: query.status,
    });
  }

  // Apply sorting
  const sortField = this.resolveSortField(query.sortBy);
  qb.orderBy(`<resource>.${sortField}`, query.order.toUpperCase() as 'ASC' | 'DESC');

  // Apply pagination
  qb.skip((query.page - 1) * query.limit).take(query.limit);

  return qb.getManyAndCount();
}

// ── Find with relation ─────────────────────────────────────────────────
async findByIdWithRelations(id: string): Promise<<Resource>Entity | null> {
  return this.repo.findOne({
    where: { id },
    relations: ['owner', 'bids'],    // Only load what is needed
  });
}

// ── Domain-specific query ──────────────────────────────────────────────
async findActiveByOwner(
  ownerId: string,
): Promise<<Resource>Entity[]> {
  return this.repo
    .createQueryBuilder('<resource>')
    .where('<resource>.owner_id = :ownerId', { ownerId })
    .andWhere('<resource>.status = :status', {
      status: <Resource>Status.ACTIVE,
    })
    .andWhere('<resource>.deleted_at IS NULL')
    .orderBy('<resource>.created_at', 'DESC')
    .getMany();
}

private resolveSortField(sortBy: string): string {
  // Whitelist sortable fields — prevent injection
  const allowedFields: Record<string, string> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    // Add domain-specific sortable fields here
  };
  return allowedFields[sortBy] ?? 'createdAt';
}
```

---

### Request DTOs

```typescript
// ── Body DTO (POST/PATCH) ──────────────────────────────────────────────
import {
  IsString, IsNotEmpty, IsNumber,
  IsPositive, IsUUID, IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class Create<Resource>Dto {
  // Every field: @ApiProperty first, then validators
  @ApiProperty({
    description: 'Field description',
    example: 'example value',
  })
  @IsString()
  @IsNotEmpty()
  fieldName: string;

  @ApiProperty({
    description: 'Amount field',
    example: 150.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

// ── Query DTO (GET list) ───────────────────────────────────────────────
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';

export class List<Resource>QueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: <Resource>Status,
  })
  @IsOptional()
  @IsEnum(<Resource>Status)
  status?: <Resource>Status;

  @ApiPropertyOptional({
    description: 'Filter by owner ID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
```

---

### Unit Test Cases — New Service Method

```typescript
// Add these test cases to the existing <module>.service.spec.ts
// Follow the standard mock pattern from references/testing-standards.md

describe('<newMethodName>', () => {
  // ── Happy path ─────────────────────────────────────────────────────
  it('should <expected result> when <condition>', async () => {
    // Arrange
    const entity = create<Resource>Entity({ /* relevant overrides */ });
    mock<Resource>Repository.<method>.mockResolvedValue(entity);

    // Act
    const result = await service.<newMethodName>(/* args */);

    // Assert
    expect(result).toMatchObject({ id: entity.id });
  });

  // ── Not found ──────────────────────────────────────────────────────
  it('should throw ResourceNotFoundException when <resource> not found', async () => {
    mock<Resource>Repository.findById.mockResolvedValue(null);

    await expect(service.<newMethodName>('non-existent-id'))
      .rejects.toThrow(ResourceNotFoundException);
  });

  // ── Ownership violation ────────────────────────────────────────────
  it('should throw OwnershipException when user does not own resource', async () => {
    const entity = create<Resource>Entity({
      owner: { id: 'other-user-id' } as any,
    });
    mock<Resource>Repository.findById.mockResolvedValue(entity);

    await expect(
      service.<newMethodName>('resource-id', 'requesting-user-id'),
    ).rejects.toThrow(<Resource>OwnershipException);
  });

  // ── State violation ────────────────────────────────────────────────
  it('should throw InvalidStateException when in wrong state', async () => {
    const entity = create<Resource>Entity({
      status: <Resource>Status.CLOSED,  // Wrong state for this operation
    });
    mock<Resource>Repository.findById.mockResolvedValue(entity);

    await expect(service.<newMethodName>('resource-id', 'user-id'))
      .rejects.toThrow(Invalid<Resource>StateException);
  });

  // ── Event emission ─────────────────────────────────────────────────
  it('should emit correct event on success', async () => {
    const entity = create<Resource>Entity();
    mock<Resource>Repository.findById.mockResolvedValue(entity);
    mock<Resource>Repository.update.mockResolvedValue(entity);

    await service.<newMethodName>('resource-id', 'user-id');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      EventNames.<EVENT_NAME>,
      expect.objectContaining({ <resource>Id: entity.id }),
    );
  });
});
```

---

### E2E Test Cases — New Endpoint

```typescript
// Add these to the existing <module>.e2e.spec.ts
// Always test the full HTTP cycle including envelope shape

describe('<HTTP_METHOD> /api/v1/<route>', () => {
  it('should return <status> with correct response shape', async () => {
    const res = await request(app.getHttpServer())
      .<method>('/api/v1/<route>')
      .set('Authorization', `Bearer ${<role>Token}`)
      .send(/* dto if needed */)
      .expect(<statusCode>);

    // Always verify envelope
    expect(res.body).toMatchObject({
      data: expect.objectContaining({
        id: expect.any(String),
      }),
      meta: null,
      error: null,
    });
  });

  it('should return 401 when no token provided', async () => {
    const res = await request(app.getHttpServer())
      .<method>('/api/v1/<route>')
      .expect(401);

    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('should return 403 when insufficient permissions', async () => {
    const res = await request(app.getHttpServer())
      .<method>('/api/v1/<route>')
      .set('Authorization', `Bearer ${wrongRoleToken}`)
      .expect(403);

    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should return 400 with field errors on invalid input', async () => {
    const res = await request(app.getHttpServer())
      .<method>('/api/v1/<route>')
      .set('Authorization', `Bearer ${<role>Token}`)
      .send({ /* invalid body */ })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields).toBeInstanceOf(Array);
  });

  it('should return 404 when resource not found', async () => {
    const res = await request(app.getHttpServer())
      .<method>('/api/v1/<route>/non-existent-id')
      .set('Authorization', `Bearer ${<role>Token}`)
      .expect(404);

    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});
```

---

## Step 4 — Endpoint-Specific Checklist

### For POST endpoints additionally verify:
  ✅ @HttpCode(HttpStatus.CREATED) present
  ✅ @ApiBody() decorator present
  ✅ Returns 201 not 200
  ✅ Resource returned in response body

### For DELETE endpoints additionally verify:
  ✅ @HttpCode(HttpStatus.NO_CONTENT) present
  ✅ Returns void
  ✅ Soft delete used — never hard delete

### For domain action endpoints (e.g. /close, /cancel) additionally verify:
  ✅ State machine transition validated in service
  ✅ Ownership check in service — never controller
  ✅ Domain event emitted after successful transition
  ✅ Correct domain exception thrown on state violation

### For paginated GET endpoints additionally verify:
  ✅ Extends PaginationQueryDto
  ✅ Returns PaginatedResult with __paginated flag
  ✅ Default page=1, limit=20, max limit=100
  ✅ Sort field whitelisted in repository

---

## Step 5 — Final Checklist

  ✅ Controller method has full decorator set
  ✅ Service method has no DB queries — uses repository
  ✅ Repository method uses parameterized queries
  ✅ Request DTO has @ApiProperty on every field
  ✅ Response DTO has @ApiProperty on every field
  ✅ No sensitive fields in response (password, tokens, deletedAt)
  ✅ Monetary amounts are numbers in response — never strings
  ✅ Domain exceptions used — never raw HttpException
  ✅ Ownership checks in service — never controller
  ✅ Logger called for critical operations
  ✅ CLS used for userId/requestId — not method args
  ✅ Unit tests cover happy path + all exception cases
  ✅ E2E tests cover 200/201, 400, 401, 403, 404 cases
  ✅ E2E tests verify { data, meta, error } envelope shape
  ✅ npm run lint — zero errors
  ✅ npm run build — zero TypeScript errors
  ✅ npm run test — all tests pass