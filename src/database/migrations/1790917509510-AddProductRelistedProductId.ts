import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Relisting an ABANDONED product (POST /products/:id/relist) creates a fresh
 * listing; the abandoned row records which one through `relistedProductId`,
 * which also stops it being relisted twice.
 */
export class AddProductRelistedProductId1790917509510 implements MigrationInterface {
  name = 'AddProductRelistedProductId1790917509510';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "relistedProductId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "relistedProductId"`,
    );
  }
}
