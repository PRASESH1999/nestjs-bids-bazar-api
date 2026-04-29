---
trigger: always_on
---

# Rule 12: Database Schema Maintenance

## Purpose
- Maintain a living, accurate ERD of all database entities at all times.
- The single source of truth for the data model lives in `/docs/database-schema.md`.
- The diagram must always reflect **current** state — never aspirational or outdated.

## When to Update
Update `/docs/database-schema.md` in the **same change** (same commit/PR) whenever any of the following occur:
- A new entity is created
- An entity is renamed or removed
- A column is added, removed, or renamed
- A column type changes
- A relationship is added, removed, or modified (FK changes, cardinality changes)
- A unique constraint or composite index is added or removed
- Encryption is added or removed from a field
- Default values change in a way that affects schema documentation

## What to Update
- The **High-Level Relationships** diagram — update if any relationship line changes
- The **Full ERD** diagram — always update on any schema change
- The **Entity Notes** section — update if any non-visible behavior changes (encryption, soft-delete, composite indexes, enum values)
- The **Last updated** date stamp at the top of the file

## Diagram Conventions
- Entity names: **UPPERCASE** in diagrams
- Mark keys: `PK` for primary key, `FK` for foreign key, `UK` for unique key, `FK,UK` for both
- Keep field types simple: `uuid`, `string`, `int`, `boolean`, `timestamp`, `enum`, `json`
- Relationship notation:
  ```
  ||--o|   one-to-one optional
  ||--||   one-to-one required
  ||--o{   one-to-many optional
  ||--|{   one-to-many required
  }o--o{   many-to-many
  ```
- Junction tables for many-to-many relationships must be shown explicitly as their own entity
- If unsure how to represent something, prefer clarity over technical precision

## Quality Rules
- Encrypted fields must be noted in the **Entity Notes** section — never rely on the ERD alone
- Soft-delete fields (`deletedAt`, `isActive`) must appear in the Full ERD
- Implicit FK columns (plain UUID columns with no TypeORM `@ManyToOne` relation) must still be marked `FK` in the ERD and documented in Entity Notes
- Do not remove entries from Entity Notes when a column is removed — update them to reflect the current state

## Verification
Before considering any schema-affecting task complete, the agent must:
1. Open `/docs/database-schema.md`
2. Confirm every changed entity is reflected accurately in both diagrams
3. Update the Entity Notes section if any non-visible behavior changed
4. Update the `_Last updated_` date stamp to today's date
