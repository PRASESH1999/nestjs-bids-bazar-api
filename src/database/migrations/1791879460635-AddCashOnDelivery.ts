import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cash on delivery for auction winners.
 *
 *  - `product_payments.method` (FONEPAY | COD). The default fills every
 *    existing row with FONEPAY, which is what they all were — no backfill.
 *  - `COD_PENDING` on the payment-status enum. `boost_payments.status` shares
 *    the PaymentStatus enum, so its type gets the value too; boosts never use it.
 *  - `COD` on the bid payment-confirmation-method enum.
 *  - `users.codRefusalCount`, defaulting to 0.
 *  - `product_deliveries.returnedAt` / `returnedById` for refused COD parcels.
 *
 * Hand-written rather than generated: enum values are appended with
 * `ALTER TYPE ... ADD VALUE` instead of TypeORM's rename-and-recreate, which
 * would rewrite the status columns and rebuild every index on them (including
 * the partial unique index on PENDING payments). ADD VALUE inside the
 * migration transaction needs Postgres 12+, and the new values are not used
 * here, so the "not usable until commit" rule never bites.
 *
 * `down()` leaves the added enum values in place — Postgres cannot drop an
 * enum value, and an unused one is harmless.
 */
export class AddCashOnDelivery1791879460635 implements MigrationInterface {
  name = 'AddCashOnDelivery1791879460635';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."product_payments_method_enum" AS ENUM('FONEPAY', 'COD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD "method" "public"."product_payments_method_enum" NOT NULL DEFAULT 'FONEPAY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."product_payments_status_enum" ADD VALUE IF NOT EXISTS 'COD_PENDING' BEFORE 'SUCCESS'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."boost_payments_status_enum" ADD VALUE IF NOT EXISTS 'COD_PENDING' BEFORE 'SUCCESS'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."bids_paymentconfirmationmethod_enum" ADD VALUE IF NOT EXISTS 'COD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "codRefusalCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD "returnedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD "returnedById" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP COLUMN "returnedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP COLUMN "returnedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "codRefusalCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP COLUMN "method"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."product_payments_method_enum"`,
    );
  }
}
