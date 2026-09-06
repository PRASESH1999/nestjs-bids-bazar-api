import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductIsRare1788689653049 implements MigrationInterface {
    name = 'AddProductIsRare1788689653049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "isRare" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "isRare"`);
    }

}
