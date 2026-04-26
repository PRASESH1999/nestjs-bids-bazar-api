# RBAC Reference

> Read this before adding any guard, role, permission,
> protected route, or ownership check.
> Roles and permissions are the single source of truth
> for all access control in the Bids Bazzar.

---

## Role Definitions

```typescript
// src/common/enums/role.enum.ts
export enum Role {
  BIDDER      = 'BIDDER',       // Can place bids, view auctions
  AUCTIONEER  = 'AUCTIONEER',   // Can create and manage auctions
  ADMIN       = 'ADMIN',        // Full system access
}
```

### Role Rules
- A user can hold multiple roles simultaneously
- Roles are stored as a string array on UserEntity
- Roles are embedded in JWT payload on every login
- Role assignment is managed by ADMIN only
- Default role on registration: `[Role.BIDDER]`

---

## Permission Definitions

```typescript
// src/common/enums/permission.enum.ts
export enum Permission {
  // ── Bid Permissions ──────────────────────────────────────────────────
  BID_CREATE          = 'bid:create',
  BID_VIEW            = 'bid:view',
  BID_VIEW_OWN        = 'bid:view:own',

  // ── Auction Permissions ──────────────────────────────────────────────
  AUCTION_CREATE      = 'auction:create',
  AUCTION_VIEW        = 'auction:view',
  AUCTION_UPDATE      = 'auction:update',
  AUCTION_CLOSE       = 'auction:close',
  AUCTION_CANCEL      = 'auction:cancel',

  // ── User Permissions ─────────────────────────────────────────────────
  USER_VIEW_OWN       = 'user:view:own',
  USER_UPDATE_OWN     = 'user:update:own',

  // ── Admin Permissions ────────────────────────────────────────────────
  USER_MANAGE         = 'user:manage',
  ROLE_ASSIGN         = 'role:assign',
  SYSTEM_CONFIG       = 'system:config',
  AUCTION_MANAGE_ALL  = 'auction:manage:all',
  BID_VIEW_ALL        = 'bid:view:all',
}
```

---

## Role → Permission Mapping

```typescript
// src/common/auth/role-permissions.map.ts
import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.BIDDER]: [
    Permission.BID_CREATE,
    Permission.BID_VIEW,
    Permission.BID_VIEW_OWN,
    Permission.AUCTION_VIEW,
    Permission.USER_VIEW_OWN,
    Permission.USER_UPDATE_OWN,
  ],

  [Role.AUCTIONEER]: [
    Permission.AUCTION_CREATE,
    Permission.AUCTION_VIEW,
    Permission.AUCTION_UPDATE,
    Permission.AUCTION_CLOSE,
    Permission.AUCTION_CANCEL,
    Permission.BID_VIEW,
    Permission.USER_VIEW_OWN,
    Permission.USER_UPDATE_OWN,
  ],

  [Role.ADMIN]: [
    // Admin gets all permissions
    ...Object.values(Permission),
  ],
};

// Helper — resolve permissions for a set of roles
export function resolvePermissions(roles: Role[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    rolePerms.forEach((p) => permissions.add(p));
  }
  return Array.from(permissions);
}
```

---

## Permissions Guard

```typescript
// src/common/guards/permissions.guard.ts
import {
  Injectable, CanActivate,
  ExecutionContext,
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
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required — allow through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user permissions from CLS store (set by JwtStrategy)
    const userPermissions = this.cls.get<string[]>('userPermissions') ?? [];

    // Check all required permissions are present
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new InsufficientPermissionsException();
    }

    return true;
  }
}
```

---

## RequirePermissions Decorator

```typescript
// src/common/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '@common/enums/permission.enum';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

---

## Registering Guards Globally

```typescript
// Register both guards globally in AppModule
// src/app.module.ts — add to providers array

import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';

providers: [
  // Global guards — applied to every route automatically
  // Order matters: JWT first, then permissions
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: PermissionsGuard,
  },
  // ... other providers
],
```

---

## Controller Usage Patterns

```typescript
// ── Public Route ─────────────────────────────────────────────────────────
@Public()
@Get('auctions')
@ApiOperation({ summary: 'List all active auctions — public' })
async findAll(): Promise<AuctionEntity[]> {
  return this.auctionsService.findAll();
}

// ── Protected Route — Single Permission ──────────────────────────────────
@RequirePermissions(Permission.BID_CREATE)
@Post('bids')
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Place a bid — BIDDER only' })
async placeBid(@Body() dto: CreateBidDto): Promise<BidEntity> {
  return this.bidsService.placeBid(dto);
}

// ── Protected Route — Multiple Permissions ────────────────────────────────
@RequirePermissions(Permission.AUCTION_CLOSE, Permission.AUCTION_UPDATE)
@Patch('auctions/:id/close')
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Close auction — AUCTIONEER or ADMIN' })
async closeAuction(@Param('id') id: string): Promise<AuctionEntity> {
  return this.auctionsService.closeAuction(id);
}

// ── Protected Route — Ownership Check ─────────────────────────────────────
// Permission check at guard level, ownership check at service level
@RequirePermissions(Permission.AUCTION_CLOSE)
@Patch('auctions/:id/close')
async closeAuction(
  @Param('id') id: string,
  @CurrentUser() user: JwtPayload,
): Promise<AuctionEntity> {
  // Ownership enforced in service — not controller
  return this.auctionsService.closeAuction(id, user.sub);
}
```

---

## Ownership Rules — Service Layer

```typescript
// src/modules/auctions/auctions.service.ts

// ✅ Ownership checks always in service — never controller
async closeAuction(
  auctionId: string,
  requestingUserId: string,
): Promise<AuctionEntity> {
  const auction = await this.auctionsRepository.findById(auctionId);
  if (!auction) throw new AuctionNotFoundException();

  // Ownership check — AUCTIONEER can only close their own auctions
  const userRoles = this.cls.get<string[]>('userRoles') ?? [];
  const isAdmin = userRoles.includes(Role.ADMIN);

  if (!isAdmin && auction.owner.id !== requestingUserId) {
    throw new AuctionOwnershipException();
  }

  // Proceed with closing
  return this.transitionAuctionState(auction, AuctionStatus.CLOSED);
}

// ── Ownership Pattern Rules ───────────────────────────────────────────────
// 1. Check permission via guard (@RequirePermissions)
// 2. Check ownership in service using requestingUserId from CurrentUser
// 3. ADMIN always bypasses ownership checks
// 4. Use cls.get('userRoles') to check if user is ADMIN
// 5. Never check ownership in controller or repository
```

---

## Full Endpoint Access Matrix

| Endpoint | Public | BIDDER | AUCTIONEER | ADMIN |
|---|---|---|---|---|
| `GET /auctions` | ✅ | ✅ | ✅ | ✅ |
| `GET /auctions/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /auctions` | ❌ | ❌ | ✅ | ✅ |
| `PATCH /auctions/:id` | ❌ | ❌ | ✅ (own) | ✅ |
| `PATCH /auctions/:id/close` | ❌ | ❌ | ✅ (own) | ✅ |
| `PATCH /auctions/:id/cancel` | ❌ | ❌ | ✅ (own) | ✅ |
| `GET /bids` | ❌ | ✅ (own) | ✅ | ✅ |
| `GET /bids/:id` | ❌ | ✅ (own) | ✅ | ✅ |
| `POST /bids` | ❌ | ✅ | ❌ | ✅ |
| `GET /users/me` | ❌ | ✅ | ✅ | ✅ |
| `PATCH /users/me` | ❌ | ✅ | ✅ | ✅ |
| `GET /users` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /users/:id/roles` | ❌ | ❌ | ❌ | ✅ |
| `POST /auth/register` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/refresh` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/logout` | ❌ | ✅ | ✅ | ✅ |
| `GET /health` | ✅ | ✅ | ✅ | ✅ |

---

## RBAC Seeder

```typescript
// src/database/seeds/admin.seed.ts
// Creates the default ADMIN user on first deployment
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const usersRepo = dataSource.getRepository(UserEntity);

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@bidsbazarapi.com';
  const existing = await usersRepo.findOne({
    where: { email: adminEmail },
  });

  // Idempotent — never create duplicate admin
  if (existing) {
    console.log('Admin user already exists — skipping seed.');
    return;
  }

  const hashedPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
    12,
  );

  await usersRepo.save(
    usersRepo.create({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      roles: [Role.ADMIN],
    }),
  );

  console.log(`Admin user created: ${adminEmail}`);
}
```

---

## Adding a New Permission — Checklist

When adding any new permission, always do ALL of the following:

  ✅ Add to Permission enum in `common/enums/permission.enum.ts`
  ✅ Add to relevant role(s) in `role-permissions.map.ts`
  ✅ Add @RequirePermissions() to the relevant controller route
  ✅ Update the endpoint access matrix in this reference file
  ✅ Update Swagger @ApiBearerAuth() on the protected route
  ✅ Add ownership check in service if needed
  ✅ Update e2e tests for the affected endpoint

## Adding a New Role — Checklist

  ✅ Add to Role enum in `common/enums/role.enum.ts`
  ✅ Add role → permissions mapping in `role-permissions.map.ts`
  ✅ Update endpoint access matrix in this reference file
  ✅ Update admin.seed.ts if new role needs a seeded user
  ✅ Update JWT payload type if role has special properties
  ✅ Update e2e tests for all affected endpoints