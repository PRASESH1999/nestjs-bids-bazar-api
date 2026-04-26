---
trigger: always_on
---

# Rule 2: API Design Standards

## Base
- REST only. No GraphQL.
- All endpoints are prefixed with /api/v1/
- NestJS global prefix must be set to 'api' and versioning to 'v1' in main.ts.

## URL Naming Conventions
- Use plural nouns for resources: /bids, /auctions, /users
- Use kebab-case for multi-word resources: /bid-items, /auction-rooms
- Use nested routes for relationships: /auctions/:auctionId/bids
- Never use verbs in URLs — use HTTP methods to express actions.

  ✅ GET    /api/v1/bids
  ✅ POST   /api/v1/bids
  ✅ GET    /api/v1/bids/:id
  ✅ PATCH  /api/v1/bids/:id
  ✅ DELETE /api/v1/bids/:id
  ❌ POST   /api/v1/createBid
  ❌ GET    /api/v1/getBidById

## HTTP Methods
- GET    → Read only, never mutates data
- POST   → Create a new resource
- PATCH  → Partial update (preferred over PUT)
- PUT    → Full replacement only (use sparingly)
- DELETE → Remove a resource

## HTTP Status Codes
- 200 OK             → Successful GET, PATCH, DELETE
- 201 Created        → Successful POST (always return the created resource)
- 204 No Content     → Successful DELETE with no body
- 400 Bad Request    → Validation failure / malformed request
- 401 Unauthorized   → Missing or invalid auth token
- 403 Forbidden      → Authenticated but not permitted
- 404 Not Found      → Resource does not exist
- 409 Conflict       → Duplicate bid, closed auction, state conflict
- 422 Unprocessable  → Passes validation but fails business rules
- 429 Too Many Reqs  → Rate limit hit
- 500 Internal Error → Unexpected server error (never expose internals)

## Standard Response Envelope
Every API response must follow this structure — no exceptions:

Success:
{
  "data": { ... },        // the resource or array of resources
  "meta": {               // optional, include when relevant
    "page": 1,
    "limit": 20,
    "total": 150
  },
  "error": null
}

Error:
{
  "data": null,
  "meta": null,
  "error": {
    "code": "BID_ALREADY_CLOSED",
    "message": "This auction is no longer accepting bids.",
    "statusCode": 409
  }
}

- Implement this via a NestJS global ResponseInterceptor in common/interceptors/.
- Implement error shape via a global HttpExceptionFilter in common/filters/.
- Never return raw NestJS exceptions directly to the client.

## Query Params (for list endpoints)
- Pagination:  ?page=1&limit=20  (default limit: 20, max limit: 100)
- Sorting:     ?sortBy=createdAt&order=asc|desc
- Filtering:   ?status=ACTIVE&auctionId=123
- Always validate query params via a DTO with class-validator.

## Request & Response DTOs
- Every endpoint must have a typed request DTO (input) and a response DTO (output).
- Never expose raw entity fields in responses — always map through a response DTO.
- Use @ApiProperty() decorators on all DTOs for auto Swagger documentation.

## Swagger / OpenAPI
- Swagger must be enabled in main.ts at /api/v1/docs.
- Every controller and endpoint must have @ApiTags() and @ApiOperation() decorators.
- Keep Swagger spec in sync with every route change — this is enforced in CI.