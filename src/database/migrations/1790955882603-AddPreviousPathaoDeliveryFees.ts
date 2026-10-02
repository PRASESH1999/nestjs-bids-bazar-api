import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps the Pathao fee of every cancelled-and-replaced consignment (A57).
 * Index-aligned with `previousConsignmentIds`, so rows that were already
 * redispatched are backfilled with one NULL per superseded consignment — the
 * fee they had was overwritten and is not recoverable.
 */
export class AddPreviousPathaoDeliveryFees1790955882603 implements MigrationInterface {
  name = 'AddPreviousPathaoDeliveryFees1790955882603';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD "previousPathaoDeliveryFees" numeric(10,2) array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "product_deliveries"
         SET "previousPathaoDeliveryFees" = array_fill(NULL::numeric, ARRAY[cardinality("previousConsignmentIds")])
       WHERE cardinality("previousConsignmentIds") > 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP COLUMN "previousPathaoDeliveryFees"`,
    );
  }
}
