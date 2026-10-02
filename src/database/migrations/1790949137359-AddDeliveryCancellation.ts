import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryCancellation1790949137359 implements MigrationInterface {
  name = 'AddDeliveryCancellation1790949137359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD "cancelledAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD "previousConsignmentIds" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP COLUMN "previousConsignmentIds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP COLUMN "cancelledAt"`,
    );
  }
}
