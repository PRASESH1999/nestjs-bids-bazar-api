# Bids Bazar API — Response Format Guide

Base URL: `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/api/v1/docs`

---

## Response Envelope

**Success** responses return the resource directly — there is no outer wrapper (except for paginated lists, see below).

**Error** responses always follow this envelope, regardless of where the error originated:

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "statusCode": 400,
    "fields": [
      { "field": "email", "message": "email must be an email" }
    ]
  }
}
```

`fields` is only present on `400 VALIDATION_FAILED` errors.  
`stack` is only present when `NODE_ENV=development`.

---

## Error Codes Reference

| HTTP | `code` | When |
|------|--------|------|
| 400 | `VALIDATION_FAILED` | Request body/query fails class-validator rules. Check `fields[]` for per-field messages. |
| 401 | `UNAUTHORIZED` | No JWT, expired JWT, or invalid credentials. |
| 403 | `FORBIDDEN` | Valid JWT but insufficient role/permission. |
| 403 | `EMAIL_NOT_VERIFIED` | Login attempted before email verification. |
| 404 | `NOT_FOUND` | Resource with given ID does not exist. |
| 409 | `CONFLICT` | Duplicate unique value (name, email). |
| 409 | `DUPLICATE_RESOURCE` | DB-level unique constraint violation. |
| 410 | `GONE` | Token existed but expired (e.g. email verification link). |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded. Back off and retry. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error. |

---

## Authentication

The API uses **two tokens**:

| Token | Type | Lifetime | How to send |
|-------|------|----------|-------------|
| `accessToken` | JWT | Short-lived (check `JWT_EXPIRES_IN` env) | `Authorization: Bearer <token>` header |
| `refreshToken` | Opaque random string | 7 days | Sent/received automatically via `HttpOnly` cookie |

### Flow

```
POST /auth/register   →  receive verification email
GET  /auth/verify-email?token=...  →  account activated
POST /auth/login      →  { accessToken } + refreshToken cookie set
  (use accessToken on every protected request)
POST /auth/refresh    →  { accessToken } + new refreshToken cookie (old one invalidated)
POST /auth/logout     →  refreshToken cookie cleared
```

> **Frontend note:** Never store `refreshToken` in JS-accessible storage — it is `HttpOnly`. Store `accessToken` in memory (e.g. React state). On 401, call `/auth/refresh` automatically, then retry the original request.

---

## Shared Object Shapes

### User

```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "USER",
  "isActive": true,
  "isEmailVerified": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "deletedAt": null
}
```

`role` values: `USER` | `ADMIN` | `SUPERADMIN`  
`password` and `hashedRefreshToken` are **never** included in responses.  
Soft-deleted users have `deletedAt` set to a timestamp.

### Category

```json
{
  "id": "uuid",
  "name": "Electronics",
  "iconPath": "/category-icons/electronics.png",
  "displayOrder": 0,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

`iconPath` is `null` when no icon was uploaded. Serve it from the same host as a static file.

### Subcategory

```json
{
  "id": "uuid",
  "categoryId": "parent-category-uuid",
  "name": "Mobile Phones",
  "iconPath": "/category-icons/mobile.png",
  "displayOrder": 0,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### Paginated List

Only `GET /users` currently returns a paginated envelope:

```json
{
  "data": [ /* User[] */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Query params: `?page=1&limit=20` (limit max: 100).

---

## Endpoints

### Auth — `POST /auth/register`

**Request**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "Secret123!" }
```

**201 Created**
```json
{ "message": "Account created. Please check your email to verify your account before logging in." }
```

**Errors:** 400 · 409 (email taken) · 429

---

### Auth — `POST /auth/login`

**Request**
```json
{ "email": "john@example.com", "password": "Secret123!" }
```

**200 OK** — also sets `refreshToken` HttpOnly cookie
```json
{ "accessToken": "eyJhbGci..." }
```

**Errors:**

| Status | `code` | Meaning |
|--------|--------|---------|
| 400 | `VALIDATION_FAILED` | Bad request body |
| 401 | `UNAUTHORIZED` | Wrong credentials or account inactive |
| 403 | `EMAIL_NOT_VERIFIED` | Call `/auth/resend-verification` first |
| 429 | `TOO_MANY_REQUESTS` | 5 attempts per 15 min |

---

### Auth — `GET /auth/verify-email?token=<token>`

**200 OK**
```json
{ "message": "Email verified successfully. You can now log in." }
```

**Errors:** 400 · 404 (invalid token) · 410 (expired — request a new one)

---

### Auth — `POST /auth/resend-verification`

**Request**
```json
{ "email": "john@example.com" }
```

**200 OK** — response is identical whether the email exists or not (prevents user enumeration)
```json
{ "message": "If your email exists and is unverified, a new verification email has been sent." }
```

**Errors:** 400 · 429 (3 attempts per hour)

---

### Auth — `POST /auth/refresh`

Requires: `refreshToken` cookie + `Authorization: Bearer <expired-or-valid-accessToken>` header.

**200 OK** — rotates the refreshToken cookie
```json
{ "accessToken": "eyJhbGci..." }
```

**Errors:** 401 (missing cookie, missing/invalid access token, or token mismatch — possible theft) · 429

---

### Auth — `POST /auth/logout`

Requires: valid `Authorization: Bearer <accessToken>` header.

**200 OK** — clears the refreshToken cookie
```json
{ "message": "Logged out successfully" }
```

**Errors:** 401

---

### Users — `POST /users/admin` *(SUPERADMIN)*

**Request**
```json
{ "name": "Admin User", "email": "admin@example.com", "password": "Admin123!", "role": "ADMIN" }
```

**201 Created** → User object

**Errors:** 400 · 401 · 403 · 409 (email taken)

---

### Users — `GET /users/me`

**200 OK** → User object

**Errors:** 401 · 403

---

### Users — `PATCH /users/me`

**Request** (all fields optional)
```json
{ "name": "New Name" }
```

**200 OK** → Updated User object

**Errors:** 400 · 401 · 403

---

### Users — `GET /users` *(ADMIN+)*

Query params: `?page=1&limit=20`

**200 OK** → Paginated List of User objects

**Errors:** 401 · 403

---

### Users — `PATCH /users/:id/suspend` *(ADMIN+)*

**200 OK** → User object with `isActive: false`

**Errors:** 401 · 403 (hierarchy — cannot suspend equal/higher role) · 404

---

### Users — `DELETE /users/:id` *(ADMIN+)*

Soft delete — record is kept in DB with `deletedAt` set.

**200 OK**
```json
{ "success": true }
```

**Errors:** 401 · 403 · 404

---

### Users — `POST /users/:id/role` *(SUPERADMIN)*

**Request**
```json
{ "role": "ADMIN" }
```

**201 Created** → Updated User object

**Errors:** 400 · 401 · 403 · 404

---

### Categories — `GET /categories` *(public)*

**200 OK** → `Category[]` ordered by `displayOrder ASC, name ASC`, `isActive: true` only

---

### Categories — `GET /categories/:id` *(ADMIN+)*

**200 OK** → Category object

**Errors:** 401 · 403 · 404

---

### Categories — `POST /categories` *(ADMIN+)*

**Request:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| `name` | string (2–50 chars) | Yes |
| `displayOrder` | number | No (default 0) |
| `icon` | file (JPEG/PNG/SVG/WebP, max 1 MB) | No |

**201 Created** → Category object (`iconPath` set if icon uploaded)

**Errors:** 400 · 401 · 403 · 409 (name already exists)

---

### Categories — `PATCH /categories/:id` *(ADMIN+)*

**Request:** `multipart/form-data` (all fields optional)

| Field | Type |
|-------|------|
| `name` | string (2–50 chars) |
| `displayOrder` | number |
| `isActive` | boolean |
| `icon` | file — replaces existing icon |

**200 OK** → Updated Category object

**Errors:** 400 · 401 · 403 · 404 · 409 (name conflict)

---

### Categories — `DELETE /categories/:id` *(ADMIN+)*

Soft-delete — sets `isActive: false`. Does **not** remove the record.

**200 OK**
```json
{ "success": true }
```

**409 Conflict** — if the category has active subcategories, deactivate them first.

**Errors:** 401 · 403 · 404 · 409

---

### Admin — `GET /admin/categories` *(ADMIN+)*

Query: `?includeInactive=true`

**200 OK** → `Category[]` (includes inactive when flag is set)

**Errors:** 401 · 403

---

### Subcategories — `GET /subcategories` *(public)*

Query: `?categoryId=<uuid>` (optional — filters to one parent)

**200 OK** → `Subcategory[]` ordered by `displayOrder ASC, name ASC`, `isActive: true` only

Use the `categoryId` filter to power cascading dropdowns: select a category first, then fetch its subcategories.

---

### Subcategories — `GET /subcategories/:id` *(ADMIN+)*

**200 OK** → Subcategory object

**Errors:** 401 · 403 · 404

---

### Subcategories — `POST /subcategories` *(ADMIN+)*

**Request:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| `categoryId` | UUID | Yes |
| `name` | string (2–50 chars) | Yes |
| `displayOrder` | number | No (default 0) |
| `icon` | file (JPEG/PNG/SVG/WebP, max 1 MB) | No |

**201 Created** → Subcategory object

**Errors:** 400 · 401 · 403 · 404 (parent category not found/inactive) · 409 (same name already exists in this category)

---

### Subcategories — `PATCH /subcategories/:id` *(ADMIN+)*

**Request:** `multipart/form-data` (all fields optional)

| Field | Type |
|-------|------|
| `categoryId` | UUID — move to a different parent |
| `name` | string (2–50 chars) |
| `displayOrder` | number |
| `isActive` | boolean |
| `icon` | file — replaces existing icon |

**200 OK** → Updated Subcategory object

**Errors:** 400 · 401 · 403 · 404 · 409

---

### Subcategories — `DELETE /subcategories/:id` *(ADMIN+)*

Soft-delete — sets `isActive: false`.

**200 OK**
```json
{ "success": true }
```

**Errors:** 401 · 403 · 404

---

### Admin — `GET /admin/subcategories` *(ADMIN+)*

Query: `?categoryId=<uuid>&includeInactive=true`

**200 OK** → `Subcategory[]`

**Errors:** 401 · 403

---

## Icon Files

Icons are served as static files from the same server:

```
GET http://localhost:3000<iconPath>
e.g. http://localhost:3000/category-icons/abc123.png
```

`iconPath` in the response is always a root-relative path starting with `/`.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /auth/register` | 10 per hour |
| `POST /auth/login` | 5 per 15 minutes |
| `POST /auth/resend-verification` | 3 per hour |
| `POST /auth/refresh` | 20 per 15 minutes |

On `429`, wait before retrying. No `Retry-After` header is currently sent.
