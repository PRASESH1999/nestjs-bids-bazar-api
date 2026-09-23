import { Matches, type ValidationOptions } from 'class-validator';

/**
 * Accepts any hex UUID *shape*, the way Nest's ParseUUIDPipe does.
 *
 * class-validator's `@IsUUID()` additionally demands a version nibble of 1–5
 * and an RFC variant. Six of the twelve seeded accounts are hand-written
 * fixtures (`00000000-0000-0000-0000-00000000000N`) that satisfy the shape and
 * fail the version check — so the same id was valid on a route that uses
 * ParseUUIDPipe and a 400 on one whose query DTO used `@IsUUID()`. Real ids
 * are v4 and pass both.
 *
 * For id *filters* only: looking an id up is the endpoint's job, and an id that
 * matches nothing is an empty result or a 404 either way. The seed fixtures are
 * the underlying defect — see OPEN-ITEMS A36 — and once they are reseeded with
 * real v4 ids, uses of this can go back to `@IsUUID()`.
 */
export function IsUuidShape(options?: ValidationOptions): PropertyDecorator {
  return Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    { message: '$property must be a UUID', ...options },
  );
}
