---
name: create-auth-guard
description: >
  Use this skill when the user asks to create a new guard, add a new
  protection mechanism, or extend the existing auth/permissions system.
  Triggers include: "create a new guard for X", "add a guard that checks
  Y", "protect this route with Z", "add an ownership guard", "create a
  rate limit guard", "add a guard that verifies X before allowing access",
  "I need a guard that checks if the user owns the resource". Always read
  this skill before writing any guard file.
---

# Skill: create-auth-guard

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/rbac.md] — existing guards, roles, permissions,
  how guards are registered globally
- [references/auth.md] — JwtAuthGuard, JWT strategy, decorators
- [references/cls-context.md] — reading user context from CLS
- [references/error-handling.md] — exceptions to throw from guards
- [references/conventions.md] — naming rules
- [references/testing-standards.md] — how to test guards

---

## Step 0 — Extract Guard Details

Before writing any code confirm:

| Detail | Extract From Request |
|---|---|
| Guard name | What does it protect against? |
| Guard type | Global / Route-level / Controller-level |
| Check logic | What condition must pass? |
| Failure exception | Which exception to throw on failure? |
| Decorator needed | Does it need a custom metadata decorator? |
| Existing guard | Can this extend an existing guard? |

Never create a new guard if an existing one covers the use case.
Check references/rbac.md for existing guards first.

---

## Step 1 — Existing Guards — Check Before Creating

common/guards/jwt-auth.guard.ts      ← Global — validates JWT on all routes
common/guards/permissions.guard.ts   ← Global — checks @RequirePermissions()

Only create a new guard when:
- The check is not covered by JwtAuthGuard or PermissionsGuard
- The check requires dynamic data (e.g. DB lookup for ownership)
- The check is reusable across multiple routes

For simple permission checks — use @RequirePermissions() decorator.
For ownership checks — enforce in service layer, not a guard.

---

## Step 2 — Guard File Location & Naming

src/common/guards/<kebab-case-name>.guard.ts
Examples:
src/common/guards/throttle-auth.guard.ts
src/common/guards/resource-owner.guard.ts
src/common/guards/active-auction.guard.ts

---

## Step 3 — Standard Guard Templates

### Simple Metadata-Based Guard
```typescript
// src/common/guards/<name>.guard.ts
import {
  Injectable, CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { <FailureException> } from '@common/exceptions/<failure>.exception';

// Metadata key — used by decorator
export const <NAME>_KEY = '<name>Key';

@Injectable()
export class <Name>Guard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Read metadata set by decorator
    const required = this.reflector.getAllAndOverride<<MetadataType>>(
      <NAME>_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No metadata — allow through
    if (!required) return true;

    // Read user context from CLS
    const userId = this.cls.get<string>('userId');
    const userRoles = this.cls.get<string[]>('userRoles') ?? [];

    // Perform check
    const passes = this.checkCondition(required, userId, userRoles);

    if (!passes) {
      throw new <FailureException>();
    }

    return true;
  }

  private checkCondition(
    required: <MetadataType>,
    userId: string | null,
    userRoles: string[],
  ): boolean {
    // Implement guard-specific logic here
    return true;
  }
}
```

### Async Guard (with DB lookup)
```typescript
// src/common/guards/resource-owner.guard.ts
// Use when ownership must be verified against DB
import {
  Injectable, CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Request } from 'express';
import { AuctionOwnershipException } from '@common/exceptions/auction-ownership.exception';
import { AuctionsRepository } from '@modules/auctions/auctions.repository';
import { Role } from '@common/enums/role.enum';

export const RESOURCE_OWNER_KEY = 'resourceOwner';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly auctionsRepository: AuctionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceType = this.reflector.getAllAndOverride<string>(
      RESOURCE_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No ownership check required
    if (!resourceType) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const resourceId = request.params.id;
    const userId = this.cls.get<string>('userId');
    const userRoles = this.cls.get<string[]>('userRoles') ?? [];

    // ADMIN always bypasses ownership checks
    if (userRoles.includes(Role.ADMIN)) return true;

    if (!userId || !resourceId) {
      throw new AuctionOwnershipException();
    }

    // DB lookup — verify ownership
    const isOwner = await this.verifyOwnership(
      resourceType,
      resourceId,
      userId,
    );

    if (!isOwner) {
      throw new AuctionOwnershipException();
    }

    return true;
  }

  private async verifyOwnership(
    resourceType: string,
    resourceId: string,
    userId: string,
  ): Promise<boolean> {
    switch (resourceType) {
      case 'auction': {
        const auction = await this.auctionsRepository.findById(resourceId);
        return auction?.owner?.id === userId;
      }
      default:
        return false;
    }
  }
}
```

### Existing Guards — Full Implementation Reference

```typescript
// src/common/guards/jwt-auth.guard.ts
import {
  Injectable, ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { TokenExpiredException } from '@common/exceptions/token-expired.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw new TokenExpiredException();
    }
    return user;
  }
}

// src/common/guards/permissions.guard.ts
import {
  Injectable, CanActivate, ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { PERMISSIONS_KEY } from '@common/decorators/require-permissions.decorator';
import { InsufficientPermissionsException } from '@common/exceptions/insufficient-permissions.exception';
import { Permission } from '@common/enums/permission.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const userPermissions =
      this.cls.get<string[]>('userPermissions') ?? [];

    const hasAll = required.every((p) =>
      userPermissions.includes(p),
    );

    if (!hasAll) throw new InsufficientPermissionsException();

    return true;
  }
}
```

---

## Step 4 — Companion Decorator Template

Every new guard that uses metadata needs a companion decorator:

```typescript
// src/common/decorators/<name>.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const <NAME>_KEY = '<name>Key';

export const <DecoratorName> = (
  metadata: <MetadataType>,
): MethodDecorator & ClassDecorator =>
  SetMetadata(<NAME>_KEY, metadata);
```

### Existing Decorators Reference
```typescript
// src/common/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

// src/common/decorators/require-permissions.decorator.ts
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// src/common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
```

---

## Step 5 — Register Guard

### Global Guard (applies to all routes)
```typescript
// src/app.module.ts — add to providers array
import { APP_GUARD } from '@nestjs/core';

providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },        // runs first
  { provide: APP_GUARD, useClass: PermissionsGuard },    // runs second
  { provide: APP_GUARD, useClass: <NewGuard> },          // runs third
],
```

### Route-Level Guard (applies to specific routes)
```typescript
// Apply directly to controller or method
@UseGuards(<NewGuard>)
@Controller('auctions')
export class AuctionsController {}

// Or on a specific method
@UseGuards(<NewGuard>)
@Patch(':id/close')
async closeAuction() {}
```

### Guard Execution Order
Guards run in this order — always:

1. JwtAuthGuard     ← validates token, sets user in CLS
2. PermissionsGuard ← checks @RequirePermissions()
3. <NewGuard>       ← runs after auth is confirmed

Never register a new guard before JwtAuthGuard.
New guards can safely read CLS context — JwtAuthGuard sets it first.

---

## Step 6 — Unit Test for Guard

```typescript
// src/common/guards/<name>.guard.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { <Name>Guard } from './<name>.guard';
import { ClsService } from 'nestjs-cls';
import { <FailureException> } from '@common/exceptions/<failure>.exception';

// ── Mocks — module scope ───────────────────────────────────────────────
const mockReflector = {
  getAllAndOverride: jest.fn(),
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => ({
    userId:          'test-user-id',
    userRoles:       ['BIDDER'],
    userPermissions: ['bid:create', 'bid:view'],
  }[key] ?? null)),
};

// ── Mock ExecutionContext ──────────────────────────────────────────────
const mockExecutionContext = (
  handlerMetadata?: unknown,
  classMetadata?: unknown,
): ExecutionContext =>
  ({
    getHandler:  () => ({ metadata: handlerMetadata }),
    getClass:    () => ({ metadata: classMetadata }),
    switchToHttp: () => ({
      getRequest: () => ({
        params: { id: 'test-resource-id' },
        user:   { sub: 'test-user-id' },
      }),
    }),
  } as unknown as ExecutionContext);

describe('<Name>Guard', () => {
  let guard: <Name>Guard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Name>Guard,
        { provide: Reflector,   useValue: mockReflector },
        { provide: ClsService,  useValue: mockClsService },
      ],
    }).compile();

    guard = module.get<<Name>Guard>(<Name>Guard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('should return true when no metadata set', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = mockExecutionContext();

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when condition passes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(<valid metadata>);
      const ctx = mockExecutionContext();

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should throw <FailureException> when condition fails', () => {
      mockReflector.getAllAndOverride.mockReturnValue(<invalid metadata>);
      mockClsService.get.mockImplementation((key: string) => ({
        userId:    'user-without-access',
        userRoles: [],
      }[key] ?? null));
      const ctx = mockExecutionContext();

      expect(() => guard.canActivate(ctx))
        .toThrow(<FailureException>);
    });

    it('should allow ADMIN to bypass ownership check', () => {
      mockReflector.getAllAndOverride.mockReturnValue(<metadata>);
      mockClsService.get.mockImplementation((key: string) => ({
        userId:    'admin-user-id',
        userRoles: ['ADMIN'],
      }[key] ?? null));
      const ctx = mockExecutionContext();

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });
});
```

---

## Step 7 — Guard Rules

```typescript
// ✅ Guards must always:
// - Read user context from CLS — never from request directly
// - Allow ADMIN to bypass all ownership checks
// - Use existing exception classes — never raw HttpException
// - Be stateless — no instance variables holding request data
// - Work with both handler and class-level metadata

// ❌ Guards must never:
// - Contain business logic (belongs in service)
// - Modify request/response objects
// - Be the only place ownership is enforced
//   (service must also validate — defense in depth)
// - Access DB without caching consideration on hot routes
// - Throw raw HTTP exceptions — use domain exceptions
```

---

## Step 8 — Final Checklist

  ✅ Checked existing guards — new guard genuinely needed
  ✅ File saved to: src/common/guards/<name>.guard.ts
  ✅ Class named: <Name>Guard
  ✅ Implements CanActivate interface
  ✅ No metadata found → returns true (allow through)
  ✅ ADMIN bypasses ownership checks
  ✅ Reads user context from ClsService — not request object
  ✅ Throws domain exception — never raw HttpException
  ✅ Companion decorator created if metadata needed
  ✅ Guard registered in AppModule (global) or via @UseGuards()
  ✅ Registration order maintained: JWT → Permissions → New
  ✅ Unit test covers: no metadata, pass, fail, admin bypass
  ✅ npm run lint — zero errors
  ✅ npm run build — zero TypeScript errors
  ✅ npm run test — all guard tests pass