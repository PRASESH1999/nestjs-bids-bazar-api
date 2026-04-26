# CLS Context Reference

> Read this before using request context, correlation ID,
> user identity, or any request-scoped data anywhere in the stack.
> nestjs-cls is the single mechanism for propagating request
> context — never pass userId or requestId as method arguments
> through layers.

---

## What is nestjs-cls?

nestjs-cls provides a request-scoped storage (like a per-request
global) using Node.js AsyncLocalStorage under the hood.
It allows any service deep in the call stack to access request
context without it being passed as a function argument.

This solves two problems for the Bids Bazzar:
1. Correlation ID — every log entry automatically includes requestId
2. User context — userId/roles/permissions available in any service
   without threading them through every method signature

---

## CLS Store Shape

```typescript
// src/common/types/cls-store.type.ts
// Defines the shape of the CLS store for the entire application.
// Every property stored in CLS must be defined here.

export interface ClsStore {
  requestId: string;           // UUID — generated per request
  userId: string | null;       // Set by JwtStrategy after auth
  userEmail: string | null;    // Set by JwtStrategy after auth
  userRoles: string[];         // Set by JwtStrategy after auth
  userPermissions: string[];   // Set by JwtStrategy after auth
}
```

---

## Setup — AppModule

```typescript
// Already configured in app.module.ts — reference only
// See references/bootstrap.md for full AppModule

ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,                    // Auto-mount on every HTTP request
    generateId: true,               // Auto-generate correlation ID
    idGenerator: (req: Request) => {
      // Use X-Request-Id header if provided by upstream proxy
      // Otherwise generate a fresh UUID
      return (req.headers['x-request-id'] as string) ?? uuidv4();
    },
  },
}),
```

---

## Setting Context — JwtStrategy

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
// CLS store is populated here after token validation
// Everything downstream can read from CLS without arguments

async validate(payload: JwtPayload): Promise<JwtPayload> {
  const user = await this.usersService.findById(payload.sub);
  if (!user || user.isLocked) {
    throw new UnauthorizedException();
  }

  // Populate CLS store — available everywhere for this request
  this.cls.set('userId', payload.sub);
  this.cls.set('userEmail', payload.email);
  this.cls.set('userRoles', payload.roles);
  this.cls.set('userPermissions', payload.permissions);

  return payload;
}
```

---

## Reading Context — Usage Patterns

### In Any Service
```typescript
// ✅ Inject ClsService — read context anywhere without method args
@Injectable()
export class BidsService {
  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly cls: ClsService,
  ) {}

  async placeBid(dto: CreateBidDto): Promise<BidEntity> {
    // Read user identity from CLS — no userId arg needed
    const userId = this.cls.get<string>('userId');
    const userRoles = this.cls.get<string[]>('userRoles') ?? [];
    const requestId = this.cls.get<string>('requestId');

    this.logger.log('Placing bid', {
      requestId,
      userId,
      auctionId: dto.auctionId,
    });

    // ... business logic
  }
}
```

### In Controllers — Use @CurrentUser() Instead
```typescript
// ✅ In controllers — use @CurrentUser() decorator (reads from request.user)
// Do NOT use ClsService directly in controllers
@Post('bids')
async placeBid(
  @Body() dto: CreateBidDto,
  @CurrentUser() user: JwtPayload,   // Preferred in controllers
): Promise<BidEntity> {
  return this.bidsService.placeBid(dto, user.sub);
}

// ✅ Or let the service read from CLS directly
@Post('bids')
async placeBid(
  @Body() dto: CreateBidDto,
): Promise<BidEntity> {
  // Service reads userId from CLS internally
  return this.bidsService.placeBid(dto);
}
```

### In Guards
```typescript
// ✅ PermissionsGuard reads permissions from CLS
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

    // Read permissions from CLS — set by JwtStrategy
    const userPermissions =
      this.cls.get<string[]>('userPermissions') ?? [];

    const hasAll = required.every((p) => userPermissions.includes(p));
    if (!hasAll) throw new InsufficientPermissionsException();

    return true;
  }
}
```

### In Event Handlers & Processors
```typescript
// ⚠️ CLS context is NOT automatically available in event handlers
// and queue processors — they run outside the HTTP request lifecycle.
// Use jobId instead of requestId for async contexts.

@OnEvent(EventNames.AUCTION_CLOSED)
async handleAuctionClosed(payload: AuctionClosedEvent): Promise<void> {
  // Generate a jobId for tracing this async operation
  const jobId = uuidv4();

  this.logger.log('Handling auction.closed event', {
    jobId,                           // Use jobId — not requestId
    auctionId: payload.auctionId,
    winnerId: payload.winnerId,
  });

  await this.auctionsService.startPaymentWindow(payload.auctionId);
}
```

---

## Logging Interceptor — CLS Integration

```typescript
// src/common/interceptors/logging.interceptor.ts
// Full implementation — attaches requestId to every log

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly cls: ClsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // requestId was auto-generated by ClsModule middleware
    const requestId = this.cls.get<string>('requestId');
    const userId = this.cls.get<string | null>('userId');
    const startTime = Date.now();

    // Expose requestId in response header for client-side tracing
    response.setHeader('X-Request-Id', requestId);

    this.logger.log('Request started', {
      requestId,
      userId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - startTime;
          this.logger.log('Request completed', {
            requestId,
            userId,
            statusCode: response.statusCode,
            responseTimeMs: ms,
          });

          if (ms > 3000) {
            this.logger.error('Critical slow response', {
              requestId,
              url: request.url,
              responseTimeMs: ms,
            });
          } else if (ms > 1000) {
            this.logger.warn('Slow response detected', {
              requestId,
              url: request.url,
              responseTimeMs: ms,
            });
          }
        },
        error: () => {
          this.logger.warn('Request errored', {
            requestId,
            userId,
            method: request.method,
            url: request.url,
            responseTimeMs: Date.now() - startTime,
          });
        },
      }),
    );
  }
}
```

---

## Global Exception Filter — CLS Integration

```typescript
// Already shown in references/bootstrap.md
// Key pattern — always read requestId from CLS in filter

catch(exception: unknown, host: ArgumentsHost): void {
  const requestId = this.cls.get<string>('requestId') ?? 'unknown';

  // Include requestId in every error log
  this.logger.error('Exception caught', {
    requestId,
    errorCode,
    statusCode,
    message,
  });

  // Include requestId in error response header
  response.setHeader('X-Request-Id', requestId);
}
```

---

## CLS Store Access Rules

```typescript
// ✅ Always provide a default when reading optional fields
const userId = this.cls.get<string>('userId') ?? null;
const roles = this.cls.get<string[]>('userRoles') ?? [];
const requestId = this.cls.get<string>('requestId') ?? 'unknown';

// ✅ Always use typed generics when reading from CLS
const userId = this.cls.get<string>('userId');       // typed
const roles = this.cls.get<string[]>('userRoles');   // typed

// ❌ Never read without type — returns unknown
const userId = this.cls.get('userId');               // untyped — wrong

// ❌ Never set CLS values outside of JwtStrategy or LoggingInterceptor
this.cls.set('userId', someId);   // Only JwtStrategy should set user fields
this.cls.set('requestId', id);    // Only ClsModule middleware sets requestId
```

---

## What Lives in CLS vs Method Arguments

| Data | Where | Why |
|---|---|---|
| `requestId` | CLS only | Automatically set — never pass as arg |
| `userId` | CLS in services | Set by JwtStrategy — no need to thread |
| `userRoles` | CLS in guards/services | Set by JwtStrategy — no need to thread |
| `userPermissions` | CLS in guards | Set by JwtStrategy — no need to thread |
| `dto` (request body) | Method argument | Input data — always explicit |
| `resourceId` (path param) | Method argument | Route param — always explicit |
| `jobId` | Local variable in handler | Generated per async job |

---

## Common Mistakes to Avoid

```typescript
// ❌ Threading userId through every method — unnecessary with CLS
async placeBid(dto: CreateBidDto, userId: string): Promise<BidEntity> {}
async validateBid(dto: CreateBidDto, userId: string): Promise<void> {}
async checkOwnership(auctionId: string, userId: string): Promise<void> {}

// ✅ Read userId from CLS in the service directly
async placeBid(dto: CreateBidDto): Promise<BidEntity> {
  const userId = this.cls.get<string>('userId');
  await this.validateBid(dto);         // No userId arg needed
  await this.checkOwnership(dto.auctionId); // No userId arg needed
}

// ❌ Using CLS in event handlers without jobId
this.logger.log('Processing event', { requestId });  // requestId is null here

// ✅ Using jobId in event handlers
const jobId = uuidv4();
this.logger.log('Processing event', { jobId });      // Correct

// ❌ Not providing defaults for nullable CLS fields
const userId = this.cls.get<string>('userId');  // Could be null on public routes
// Then using userId without null check — runtime error

// ✅ Always default nullable fields
const userId = this.cls.get<string>('userId') ?? null;
if (!userId) throw new TokenExpiredException();
```

---

## CLS on Public Routes

```typescript
// On @Public() routes — userId is null in CLS
// JwtStrategy.validate() is never called for public routes
// Always handle null userId gracefully in services

async findAllAuctions(): Promise<AuctionEntity[]> {
  // userId may be null on public routes — do not assume it exists
  const userId = this.cls.get<string | null>('userId');

  // requestId is always available — set by ClsModule middleware
  const requestId = this.cls.get<string>('requestId');

  this.logger.log('Fetching all auctions', {
    requestId,
    userId,               // null for unauthenticated requests — fine
  });

  return this.auctionsRepository.findAll();
}
```

---

## ClsService Injection Checklist

When using ClsService in any class verify:

  ✅ ClsModule is imported as global in AppModule (already done)
  ✅ ClsService is injected via constructor
  ✅ All reads use typed generics: cls.get<string>('key')
  ✅ All reads provide defaults for nullable fields
  ✅ userId is never assumed non-null on public routes
  ✅ CLS is never set outside JwtStrategy or ClsModule middleware
  ✅ Event handlers use jobId not requestId for async tracing