import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstantBuyHoldStatus1790856442726 implements MigrationInterface {
  name = 'AddInstantBuyHoldStatus1790856442726';

  // Hand-written rather than the raw `migration:generate` output: the
  // generated diff also bundled in unrelated pre-existing drift between a
  // few entities and the live schema (FK/unique-index naming on
  // shipping_addresses/users/kyc_verifications) that predates this change
  // and is out of scope here. This migration touches only the two enum
  // additions this feature needs.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bca32e7e2b877bcaae255805c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_58075ba759b7738eb2eac5a9af"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."products_status_enum" RENAME TO "products_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum" AS ENUM('DRAFT', 'AWAITING_APPROVAL', 'REJECTED', 'AWAITING_FIRST_BID', 'ACTIVE', 'AWAITING_INSTANT_BUY', 'AWAITING_PAYMENT', 'SETTLED', 'ABANDONED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" TYPE "public"."products_status_enum" USING "status"::"text"::"public"."products_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."products_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bca32e7e2b877bcaae255805c3" ON "products" ("ownerId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58075ba759b7738eb2eac5a9af" ON "products" ("status", "createdAt")`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f15ddcb2549b7afac0e55ffb"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER', 'INSTANT_BUY_EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_94f15ddcb2549b7afac0e55ffb" ON "notifications" ("userId", "type", "relatedId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f15ddcb2549b7afac0e55ffb"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER')`,
    );
    // Any notification rows written as INSTANT_BUY_EXPIRED while this
    // migration's `up` was live have no equivalent in the old enum — fold
    // them into AUCTION_ABANDONED (closest existing "auction ended
    // without you" type) rather than failing the rollback outright.
    await queryRunner.query(`
            ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING (
                CASE "type"::"text"
                    WHEN 'INSTANT_BUY_EXPIRED' THEN 'AUCTION_ABANDONED'
                    ELSE "type"::"text"
                END
            )::"public"."notifications_type_enum_old"
        `);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_94f15ddcb2549b7afac0e55ffb" ON "notifications" ("userId", "type", "relatedId")`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_58075ba759b7738eb2eac5a9af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bca32e7e2b877bcaae255805c3"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum_old" AS ENUM('DRAFT', 'AWAITING_APPROVAL', 'REJECTED', 'AWAITING_FIRST_BID', 'ACTIVE', 'AWAITING_PAYMENT', 'SETTLED', 'ABANDONED', 'WITHDRAWN')`,
    );
    // Any product rows paused as AWAITING_INSTANT_BUY while this
    // migration's `up` was live have no equivalent in the old enum —
    // fold them back to ACTIVE (closest "still biddable" status) rather
    // than failing the rollback outright.
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "products" ALTER COLUMN "status" TYPE "public"."products_status_enum_old" USING (
                CASE "status"::"text"
                    WHEN 'AWAITING_INSTANT_BUY' THEN 'ACTIVE'
                    ELSE "status"::"text"
                END
            )::"public"."products_status_enum_old"
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."products_status_enum_old" RENAME TO "products_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58075ba759b7738eb2eac5a9af" ON "products" ("status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bca32e7e2b877bcaae255805c3" ON "products" ("ownerId", "status")`,
    );
  }
}
