import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBiddingEndPrice1789639030045 implements MigrationInterface {
  name = 'AddBiddingEndPrice1789639030045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "biddingEndPrice" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "biddingEndPrice"`,
    );
  }
}
