---
trigger: always_on
---

# Rule 11: Categories & Subcategories

## Structure
- Two-level hierarchy: Category → Subcategory.
- Each subcategory belongs to exactly one category.
- No deeper nesting allowed.

## Management
- Created, edited, and deleted by ADMIN and SUPERADMIN only.
- Soft delete via isActive flag — never hard delete (items reference these records).
- Icons are uploaded images, optional, stored on the local server filesystem and served
  as public static assets.

## Public Access
- Anyone (including unauthenticated users) can LIST categories and subcategories.
- Public users CANNOT fetch a single category or subcategory by ID.
- Single-record GET endpoints are restricted to ADMIN and SUPERADMIN (used by admin
  panel for edit forms).
- Subcategory listing supports filtering by categoryId for cascading dropdowns.

## Cascading Dropdowns
- On the items/listings creation form (future module), user first selects a category.
- Subcategory dropdown then loads only the selected category's subcategories.
- Achieved via GET /subcategories?categoryId=xxx

## Slug Rules
- Auto-generated using slugify from the name field — lowercase, hyphenated, no
  special characters.
- Category slugs must be globally unique.
- Subcategory slugs must be unique within their parent category (same slug allowed
  under different categories — e.g. "accessories" under both Electronics and Fashion).
- Slugs are auto-regenerated when an admin updates the name.

## Icon Rules
- Optional field on both Category and Subcategory.
- Image upload only (JPEG, PNG, SVG, WebP), max 1 MB.
- Stored under /public/category-icons/ — served as public static assets.
- DB stores the relative path (e.g. /category-icons/electronics-uuid.png).
- On update with a new icon, the old icon file is deleted from disk.
- On category/subcategory delete (soft), icon file remains until hard cleanup.

## Deletion Rules
- Soft delete only — sets isActive: false.
- A category cannot be soft-deleted while it has active subcategories — admin must
  deactivate subcategories first.
- Public list endpoints filter out isActive: false records.
- Admin list endpoints can include inactive records via ?includeInactive=true.

## Endpoint Access Matrix

| Endpoint                  | Public | USER | ADMIN | SUPERADMIN |
|---------------------------|--------|------|-------|------------|
| GET  /categories          | ✅     | ✅   | ✅    | ✅         |
| GET  /subcategories       | ✅     | ✅   | ✅    | ✅         |
| GET  /categories/:id      | ❌     | ❌   | ✅    | ✅         |
| GET  /subcategories/:id   | ❌     | ❌   | ✅    | ✅         |
| GET  /admin/categories    | ❌     | ❌   | ✅    | ✅         |
| GET  /admin/subcategories | ❌     | ❌   | ✅    | ✅         |
| POST /categories          | ❌     | ❌   | ✅    | ✅         |
| PATCH /categories/:id     | ❌     | ❌   | ✅    | ✅         |
| DELETE /categories/:id    | ❌     | ❌   | ✅    | ✅         |
| POST /subcategories       | ❌     | ❌   | ✅    | ✅         |
| PATCH /subcategories/:id  | ❌     | ❌   | ✅    | ✅         |
| DELETE /subcategories/:id | ❌     | ❌   | ✅    | ✅         |
