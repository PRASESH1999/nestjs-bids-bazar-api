---
name: create-module
description: >
  Use this skill when the user asks to create a new NestJS feature module.
  Triggers include: "create a X module", "scaffold Y module", "add a new
  module for Z", "generate the payments module", "set up the notifications
  module". Always read this skill before scaffolding any module file.
---

# Skill: create-module

## References — Read Before Starting
Always read these before generating any file:

- [SKILL.md] — project context, stack, open decisions
- [references/project-structure.md] — exact folder structure
- [references/conventions.md] — naming rules
- [references/typeorm-patterns.md] — entity and repository patterns
- [references/error-handling.md] — exception classes
- [references/swagger-standards.md] — controller decorators
- [references/rbac.md] — permissions and guards
- [references/testing-standards.md] — unit test and factory patterns
- [references/logging.md] — logger injection
- [references/cls-context.md] — ClsService usage

---

## Step 0 — Extract & Confirm Module Name

Extract module name from user request.
Apply these transformations:

| Format | Example |
|---|---|
| kebab-case (files/folders) | `auction-items` |
| PascalCase (classes) | `AuctionItems` |
| camelCase (instances/variables) | `auctionItems` |
| UPPER_SNAKE_CASE (permissions) | `AUCTION_ITEMS` |
| snake_case plural (DB table) | `auction_items` |

If the module name is ambiguous — ask the user before proceeding.
Never assume and generate — one wrong name cascades across all files.

---

## Step 1 — Check Open Decisions

Before generating any domain-specific code check SKILL.md Section 7.
If any open decision affects this module — surface it to the user first.
Never implement logic for unresolved decisions autonomously.

---

## Step 2 — Scaffold Folder Structure

Create the following structure under `src/modules/<name>/`:
src/modules/<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── <name>.service.ts
├── <name>.repository.ts
├── <name>.service.spec.ts
├── <name>.repository.integration.spec.ts
├── dto/
│   ├── create-<name>.dto.ts
│   ├── update-<name>.dto.ts
│   └── <name>-response.dto.ts
├── entities/
│   └── <name>.entity.ts
├── interfaces/
│   └── <name>.interface.ts
└── handlers/               ← only if module has async events
└── .gitkeep

Also create:
test/factories/<name>.factory.ts

---

## Step 3 — Generate Each File

### <name>.entity.ts
```typescript
import {
  Entity, Column,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('<table_name>')              // snake_case plural
export class <Name>Entity extends BaseEntity {
  // Add domain-specific columns here
  // Rules (from references/typeorm-patterns.md):
  // - Monetary: { type: 'decimal', precision: 18, scale: 2 }
  // - Timestamps: { type: 'timestamptz' }
  // - Enums: { type: 'enum', enum: EnumName }
  // - Foreign keys: @Index('idx_<table>_<fk_col>')
  // - Never float for monetary values
  // - Always { name: 'snake_case_name' } on every @Column()
}
```

### <name>.repository.ts
```typescript
import { Injectable } from '@nestjs/common';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { <Name>Entity } from './entities/<name>.entity';

@Injectable()
export class <Name>Repository {
  private readonly repo: Repository<<Name>Entity>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(<Name>Entity);
  }

  async findById(id: string): Promise<<Name>Entity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<<Name>Entity> {
    return this.repo.findOneOrFail({ where: { id } });
  }

  async findAll(): Promise<<Name>Entity[]> {
    return this.repo.find();
  }

  async create(
    data: Partial<<Name>Entity>,
    queryRunner?: QueryRunner,
  ): Promise<<Name>Entity> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(<Name>Entity)
      : this.repo;
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<<Name>Entity>,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(<Name>Entity)
      : this.repo;
    await repo.update(id, data);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }
}
```

### <name>.service.ts
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { <Name>Repository } from './<name>.repository';
import { <Name>Entity } from './entities/<name>.entity';
import { Create<Name>Dto } from './dto/create-<name>.dto';
import { Update<Name>Dto } from './dto/update-<name>.dto';
import { <Name>ResponseDto } from './dto/<name>-response.dto';
import { ResourceNotFoundException } from '@common/exceptions/resource-not-found.exception';

@Injectable()
export class <Name>Service {
  private readonly logger = new Logger(<Name>Service.name);

  constructor(
    private readonly <name>Repository: <Name>Repository,
    private readonly cls: ClsService,
  ) {}

  async findAll(): Promise<<Name>ResponseDto[]> {
    const entities = await this.<name>Repository.findAll();
    return entities.map((e) => this.mapToResponse(e));
  }

  async findById(id: string): Promise<<Name>ResponseDto> {
    const entity = await this.<name>Repository.findById(id);
    if (!entity) throw new ResourceNotFoundException('<Name>');
    return this.mapToResponse(entity);
  }

  async create(dto: Create<Name>Dto): Promise<<Name>ResponseDto> {
    const requestId = this.cls.get<string>('requestId');
    const userId = this.cls.get<string>('userId');

    const entity = await this.<name>Repository.create({ ...dto });

    this.logger.log('<Name> created', {
      requestId,
      userId,
      <name>Id: entity.id,
    });

    return this.mapToResponse(entity);
  }

  async update(
    id: string,
    dto: Update<Name>Dto,
  ): Promise<<Name>ResponseDto> {
    const entity = await this.<name>Repository.findById(id);
    if (!entity) throw new ResourceNotFoundException('<Name>');

    await this.<name>Repository.update(id, { ...dto });

    const updated = await this.<name>Repository.findById(id);
    return this.mapToResponse(updated!);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.<name>Repository.findById(id);
    if (!entity) throw new ResourceNotFoundException('<Name>');
    await this.<name>Repository.softDelete(id);

    this.logger.log('<Name> soft deleted', {
      requestId: this.cls.get<string>('requestId'),
      userId: this.cls.get<string>('userId'),
      <name>Id: id,
    });
  }

  private mapToResponse(entity: <Name>Entity): <Name>ResponseDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      // Map domain-specific fields here
      // Never expose: deletedAt, password, tokens, hashes
    };
  }
}
```

### <name>.controller.ts
```typescript
import {
  Controller, Get, Post, Patch,
  Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';
import { <Name>Service } from './<name>.service';
import { Create<Name>Dto } from './dto/create-<name>.dto';
import { Update<Name>Dto } from './dto/update-<name>.dto';
import { <Name>ResponseDto } from './dto/<name>-response.dto';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtPayload } from '@common/types/jwt-payload.type';

@ApiTags('<name>s')
@ApiBearerAuth('access-token')
@Controller('<name>s')
export class <Name>Controller {
  constructor(private readonly <name>Service: <Name>Service) {}

  @Get()
  @RequirePermissions(Permission.<NAME>_VIEW)
  @ApiOperation({ summary: 'List all <name>s' })
  @ApiResponse({ status: 200, type: [<Name>ResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(): Promise<<Name>ResponseDto[]> {
    return this.<name>Service.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.<NAME>_VIEW)
  @ApiOperation({ summary: 'Get <name> by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: <Name>ResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: '<Name> not found' })
  async findOne(@Param('id') id: string): Promise<<Name>ResponseDto> {
    return this.<name>Service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.<NAME>_CREATE)
  @ApiOperation({ summary: 'Create a new <name>' })
  @ApiResponse({ status: 201, type: <Name>ResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(
    @Body() dto: Create<Name>Dto,
  ): Promise<<Name>ResponseDto> {
    return this.<name>Service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.<NAME>_UPDATE)
  @ApiOperation({ summary: 'Update <name>' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: <Name>ResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: '<Name> not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: Update<Name>Dto,
  ): Promise<<Name>ResponseDto> {
    return this.<name>Service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.<NAME>_DELETE)
  @ApiOperation({ summary: 'Soft delete <name>' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: '<Name> deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: '<Name> not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.<name>Service.remove(id);
  }
}
```

### create-<name>.dto.ts
```typescript
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create<Name>Dto {
  // Add domain-specific fields here
  // Rules:
  // - Every field has @ApiProperty() first
  // - Validators after @ApiProperty()
  // - @IsOptional() as first validator on optional fields
  // - Never any business logic in DTOs
  // - Use @Type(() => Number) for numeric query params
  @ApiProperty({ description: 'Example field', example: 'value' })
  @IsString()
  @IsNotEmpty()
  exampleField: string;
}
```

### update-<name>.dto.ts
```typescript
import { PartialType } from '@nestjs/swagger';
import { Create<Name>Dto } from './create-<name>.dto';

// Always extend PartialType — never redefine fields manually
export class Update<Name>Dto extends PartialType(Create<Name>Dto) {}
```

### <name>-response.dto.ts
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class <Name>ResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  // Add domain-specific response fields here
  // Rules:
  // - Never include: deletedAt, password, tokens, hashes
  // - Monetary amounts as number — never string
  // - All fields have @ApiProperty()

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
```

### <name>.interface.ts
```typescript
// Domain contract — data shape only, no logic
export interface I<Name> {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  // Add domain-specific fields here
}
```

### <name>.module.ts
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { <Name>Controller } from './<name>.controller';
import { <Name>Service } from './<name>.service';
import { <Name>Repository } from './<name>.repository';
import { <Name>Entity } from './entities/<name>.entity';

@Module({
  imports: [TypeOrmModule.forFeature([<Name>Entity])],
  controllers: [<Name>Controller],
  providers: [<Name>Service, <Name>Repository],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

### <name>.service.spec.ts
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { <Name>Service } from './<name>.service';
import { <Name>Repository } from './<name>.repository';
import { ClsService } from 'nestjs-cls';
import { create<Name>Entity } from '@test/factories/<name>.factory';
import { ResourceNotFoundException } from '@common/exceptions/resource-not-found.exception';

// ── Mocks — always at module scope ────────────────────────────────────────
const mock<Name>Repository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => ({
    requestId: 'test-request-id',
    userId: 'test-user-id',
  }[key] ?? null)),
};

describe('<Name>Service', () => {
  let service: <Name>Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Name>Service,
        { provide: <Name>Repository, useValue: mock<Name>Repository },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    service = module.get<<Name>Service>(<Name>Service);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return mapped response when entity exists', async () => {
      const entity = create<Name>Entity();
      mock<Name>Repository.findById.mockResolvedValue(entity);

      const result = await service.findById(entity.id);

      expect(result).toMatchObject({ id: entity.id });
    });

    it('should throw ResourceNotFoundException when not found', async () => {
      mock<Name>Repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id'))
        .rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return mapped response', async () => {
      const entity = create<Name>Entity();
      mock<Name>Repository.create.mockResolvedValue(entity);

      const result = await service.create({ exampleField: 'value' });

      expect(result).toMatchObject({ id: entity.id });
      expect(mock<Name>Repository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should soft delete when entity exists', async () => {
      const entity = create<Name>Entity();
      mock<Name>Repository.findById.mockResolvedValue(entity);

      await service.remove(entity.id);

      expect(mock<Name>Repository.softDelete)
        .toHaveBeenCalledWith(entity.id);
    });

    it('should throw ResourceNotFoundException when not found', async () => {
      mock<Name>Repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-id'))
        .rejects.toThrow(ResourceNotFoundException);
    });
  });
});
```

### test/factories/<name>.factory.ts
```typescript
import { faker } from '@faker-js/faker';
import { <Name>Entity } from '@modules/<name>/entities/<name>.entity';
import { Create<Name>Dto } from '@modules/<name>/dto/create-<name>.dto';

export const create<Name>Entity = (
  overrides?: Partial<<Name>Entity>,
): <Name>Entity => ({
  id: faker.string.uuid(),
  // Add domain-specific fields with faker values
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const create<Name>Dto = (
  overrides?: Partial<Create<Name>Dto>,
): Create<Name>Dto => ({
  exampleField: faker.lorem.word(),
  ...overrides,
});
```

---

## Step 4 — Register in AppModule

Add `<Name>Module` to the imports array in `src/app.module.ts`:

```typescript
import { <Name>Module } from '@modules/<name>/<name>.module';

@Module({
  imports: [
    // ... existing modules
    <Name>Module,
  ],
})
export class AppModule {}
```

---

## Step 5 — Add Permissions to Enum

Add new permissions to `src/common/enums/permission.enum.ts`:

```typescript
// Add under appropriate section
<NAME>_CREATE  = '<name>:create',
<NAME>_VIEW    = '<name>:view',
<NAME>_UPDATE  = '<name>:update',
<NAME>_DELETE  = '<name>:delete',
```

Then update `role-permissions.map.ts` with appropriate role assignments.
See references/rbac.md for the full pattern.

---

## Step 6 — Create Migration

After module files are generated, always prompt:

> "Module scaffolded. You'll need a migration for the new table.
> Run `create-migration` skill next to generate the migration file."

---

## Step 7 — Final Checklist

Before marking module creation complete verify ALL of the following:

### Files Created
  ✅ <name>.module.ts
  ✅ <name>.controller.ts
  ✅ <name>.service.ts
  ✅ <name>.repository.ts
  ✅ <name>.service.spec.ts
  ✅ <name>.repository.integration.spec.ts (empty shell at minimum)
  ✅ dto/create-<name>.dto.ts
  ✅ dto/update-<name>.dto.ts
  ✅ dto/<name>-response.dto.ts
  ✅ entities/<name>.entity.ts
  ✅ interfaces/<name>.interface.ts
  ✅ test/factories/<name>.factory.ts

### Architecture
  ✅ Entity extends BaseEntity
  ✅ UUID primary key (from BaseEntity)
  ✅ Soft delete via DeleteDateColumn (from BaseEntity)
  ✅ Monetary columns use decimal(18,2) — never float
  ✅ All columns have explicit name: 'snake_case'
  ✅ Foreign key columns have @Index()
  ✅ Repository uses DataSource — not @InjectRepository()
  ✅ Service has no DB queries — all through repository
  ✅ Controller has no business logic — calls service only
  ✅ Module registered in AppModule

### Code Quality
  ✅ No `any` types anywhere
  ✅ All methods have explicit return types
  ✅ Logger injected with class name context
  ✅ ClsService used for userId/requestId — not method args
  ✅ All imports use path aliases — no relative ../../

### API & Swagger
  ✅ Controller has @ApiTags() and @ApiBearerAuth()
  ✅ Every endpoint has @ApiOperation() and @ApiResponse()
  ✅ Every DTO field has @ApiProperty()
  ✅ POST uses @HttpCode(201)
  ✅ DELETE uses @HttpCode(204) and returns void

### Permissions
  ✅ New permissions added to Permission enum
  ✅ Permissions assigned to appropriate roles in role-permissions.map.ts
  ✅ @RequirePermissions() on every protected route

### Testing
  ✅ Mock objects defined at module scope — never inside describe
  ✅ afterEach(jest.clearAllMocks) present
  ✅ Factory created in test/factories/
  ✅ Tests cover findById success and not-found cases
  ✅ Tests cover create success case
  ✅ Tests cover remove success and not-found cases

### Final Gate
  ✅ npm run lint — zero errors
  ✅ npm run build — zero TypeScript errors
  ✅ npm run test — all unit tests pass