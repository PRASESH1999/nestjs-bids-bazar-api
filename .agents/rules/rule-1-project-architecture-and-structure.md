---
trigger: always_on
---

# Rule 1: Project Architecture & Structure

## Framework & Pattern
- This is a single-service NestJS backend following a Modular / Feature-based architecture.
- Every feature is self-contained in its own module. No cross-module direct imports — use
  shared modules or dependency injection.

## Folder Structure
src/
├── main.ts                   # App entry point only, no logic here
├── app.module.ts             # Root module, imports all feature modules
├── common/                   # Shared across all modules
│   ├── decorators/
│   ├── filters/              # Exception filters
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── config/                   # Config module, env validation (e.g. Joi / Zod)
└── modules/
    └── bids/                 # Example feature module
        ├── bids.module.ts
        ├── bids.controller.ts
        ├── bids.service.ts
        ├── bids.repository.ts
        ├── dto/
        │   ├── create-bid.dto.ts
        │   └── update-bid.dto.ts
        ├── entities/
        │   └── bid.entity.ts
        ├── interfaces/
        │   └── bid.interface.ts
        └── bids.spec.ts

## Layering Rules
- Request flow must always follow: Controller → Service → Repository
- Controllers handle HTTP only — no business logic, no DB calls ever.
- Services contain all business logic — no direct DB queries, always go through repository.
- Repositories handle all DB interactions — no business logic here.
- Never skip a layer (e.g. controller calling repository directly is forbidden).

## Module Rules
- Every feature gets its own NestJS module file (e.g. bids.module.ts).
- Shared logic (guards, pipes, decorators) always goes in common/ — never duplicated
  across modules.
- Config and environment access only through the ConfigModule — never raw process.env
  outside of config/.

## DTOs & Validation
- Every controller input must have a DTO with class-validator decorators.
- DTOs live in the dto/ folder of their respective module.
- Never use raw req.body — always typed and validated through DTOs.

## Entities & Interfaces
- Entities represent DB models and live in entities/ within their module.
- Interfaces define shapes/contracts and live in interfaces/ within their module.
- No logic inside entities — data shape only.

## Naming Conventions
- Module files: <feature>.module.ts
- Controllers: <feature>.controller.ts
- Services: <feature>.service.ts
- Repositories: <feature>.repository.ts
- DTOs: <action>-<feature>.dto.ts (e.g. create-bid.dto.ts)
- Entities: <feature>.entity.ts
- All filenames in kebab-case.