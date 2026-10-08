import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `products.productCode` (e.g. BB-SKU-42) and the `product_code_seq` sequence
 * ProductsRepository.nextProductCodeSequenceValue draws from.
 *
 * Generated column + constraint, plus two hand-added steps:
 *  - the sequence itself, which generation cannot see;
 *  - a backfill numbering every lot that has already gone public, in the
 *    order it went public, then moving the sequence past the last one.
 *
 * "Went public" = approved and not rejected: `reviewedAt` set and
 * `rejectionReason` null. That covers approved lots in every later status,
 * approved-then-withdrawn lots, and relists (which carry the original's
 * approval). A rejected lot keeps its reason; a resubmitted one has both
 * cleared. A lot went public at its approval, or — for a relist, created after
 * the approval it carries — at its creation; GREATEST picks whichever is later.
 */
export class AddProductCode1791456775212 implements MigrationInterface {
  name = 'AddProductCode1791456775212';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE "product_code_seq" START WITH 1 INCREMENT BY 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "productCode" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "UQ_3146a8c669fc3f362c02fa9e0ba" UNIQUE ("productCode")`,
    );
    await queryRunner.query(
      `WITH numbered AS (
         SELECT "id",
                ROW_NUMBER() OVER (ORDER BY GREATEST("reviewedAt", "createdAt"), "id") AS n
         FROM "products"
         WHERE "reviewedAt" IS NOT NULL AND "rejectionReason" IS NULL
       )
       UPDATE "products" p
       SET "productCode" = 'BB-SKU-' || numbered.n
       FROM numbered
       WHERE p."id" = numbered."id"`,
    );
    await queryRunner.query(
      `SELECT setval('product_code_seq', GREATEST(COUNT(*), 1), COUNT(*) > 0)
       FROM "products"
       WHERE "productCode" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "UQ_3146a8c669fc3f362c02fa9e0ba"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "productCode"`);
    await queryRunner.query(`DROP SEQUENCE "product_code_seq"`);
  }
}
