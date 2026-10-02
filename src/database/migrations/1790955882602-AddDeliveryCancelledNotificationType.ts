import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds DELIVERY_CANCELLED to notifications_type_enum — the buyer's in-app
 * notice that their Pathao order was cancelled and is being rebooked (A57).
 * Same rename / recreate / swap as AddInstantBuyHoldStatus, including the
 * unique (userId, type, relatedId) index that depends on the column.
 */
export class AddDeliveryCancelledNotificationType1790955882602 implements MigrationInterface {
  name = 'AddDeliveryCancelledNotificationType1790955882602';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f15ddcb2549b7afac0e55ffb"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER', 'INSTANT_BUY_EXPIRED', 'DELIVERY_CANCELLED')`,
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
    // The old enum has no equivalent for these notices, and nothing reads a
    // stale one back — drop them rather than fail the rollback.
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'DELIVERY_CANCELLED'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER', 'INSTANT_BUY_EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_94f15ddcb2549b7afac0e55ffb" ON "notifications" ("userId", "type", "relatedId")`,
    );
  }
}
