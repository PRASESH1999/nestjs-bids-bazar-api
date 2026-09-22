import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `products.settledAmount` — what a lot actually sold for.
 *
 * Adds the column **and backfills it**, including repointing `winningBidId` at
 * the bid that actually paid. Both are necessary: a lot whose payment cascaded
 * has a `winningBidId` naming the bidder who never paid, and no column at all
 * recording the amount the sale closed at. See OPEN-ITEMS A26.
 *
 * The backfill reads the CONFIRMED bid, which is the one the settle paths mark
 * and the only one per product that can hold that status.
 */
export class AddProductSettledAmount1790000100000 implements MigrationInterface {
  name = 'AddProductSettledAmount1790000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "settledAmount" numeric(12,2)`,
    );

    // Backfill both the amount and the pointer from the bid that actually paid.
    await queryRunner.query(`
      UPDATE "products" p
      SET "settledAmount" = b."amount",
          "winningBidId"  = b."id"
      FROM "bids" b
      WHERE b."productId" = p."id"
        AND b."paymentStatus" = 'CONFIRMED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `winningBidId` is deliberately not reverted — the pre-migration value was
    // wrong on any cascaded lot, and there is nothing to restore it from.
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "settledAmount"`,
    );
  }
}
