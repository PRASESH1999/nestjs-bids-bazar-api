# Database Migrations Workflow

`synchronize` is **permanently `false`** in both `app.module.ts` and `src/config/typeorm.config.ts`.
We now have live data — schema changes MUST go through migrations. Never flip `synchronize` back to `true`.

Migrations live in `src/database/migrations/`.

## Golden rule

**Every time you add, remove, or change an entity/column/index/relation, you must generate and
run a migration before that change reaches a shared/live database.** Editing an entity file alone
does nothing to the database anymore.

## Day-to-day flow

1. **Edit your entity file(s)** as usual (add a column, add an index, change a relation, etc).

2. **Generate the migration** — TypeORM diffs your entities against the *actual current* database
   schema (defined by `dataSourceOptions.entities` + `dataSourceOptions.migrations` in
   `src/config/typeorm.config.ts`) and writes the SQL needed to close the gap:

   ```bash
   npm run migration:generate -- src/database/migrations/DescriptiveName
   ```

   Use a short PascalCase name describing the change, e.g. `AddProductViewCount`,
   `AddSellerCommissionToPayments`. Do not reuse `InitSchema`.

3. **Read the generated file** in `src/database/migrations/`. Sanity-check the `up()` SQL — TypeORM
   is usually right, but double check on:
   - Column drops/renames (TypeORM can't tell a rename from a drop+add — it may generate a
     destructive `DROP COLUMN` + `ADD COLUMN` when you actually renamed a column. Fix manually with
     `RENAME COLUMN` if so, to avoid losing live data).
   - `NOT NULL` columns added to tables that already have rows — you need a default or a backfill
     step, otherwise the migration fails against live data.
   - Enum changes (Postgres enum alterations are trickier than a plain column change).

4. **Run it locally first**:

   ```bash
   npm run migration:run
   ```

5. **Verify** the app still boots and the affected feature works.

6. **Commit the migration file** together with the entity change, in the same PR/commit. Never
   commit an entity change without its migration — the two must move together.

7. **Deploy**: run `npm run migration:run` against the target environment (staging/production)
   as part of the deploy step, *before* the new app code that depends on the new schema goes live.

## Commands reference

| Command | Purpose |
|---|---|
| `npm run migration:generate -- src/database/migrations/Name` | Diff entities vs DB, write a new migration file |
| `npm run migration:run` | Apply all pending migrations to `DB_NAME` from `.env.development` |
| `npm run migration:revert` | Roll back the most recently applied migration |

All of these use `src/config/typeorm.config.ts` as the datasource (`-d` flag baked into the npm
scripts) — that file's `entities` array must be kept in sync manually whenever you add a new entity
class (it is not auto-loaded like `app.module.ts`'s `autoLoadEntities: true`).

## Adding a brand-new entity

1. Create the entity class as usual.
2. **Add it to the `entities` array** in `src/config/typeorm.config.ts` — if you forget this step,
   `migration:generate` won't see the new entity and will generate nothing for it.
3. Generate + run the migration as above.

## Rules of thumb

- Never edit a migration file that has already been run against staging/production — write a new
  migration to fix it instead. Editing history desyncs environments that already recorded the old
  migration as "applied."
- Never delete a migration file that has been applied anywhere other than your own machine.
- If `migration:generate` produces an empty migration (no `up()` body), your entities already match
  the database — nothing to do.
- If you ever need to hand-write a migration (data backfills, non-schema changes), use
  `npm run typeorm migration:create -- src/database/migrations/Name` instead of `generate`, then
  write the SQL yourself.
