import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductPickupLocation1787560634520 implements MigrationInterface {
    name = 'AddProductPickupLocation1787560634520'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "locationProvince"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "locationDistrict"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "locationArea"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "province" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "district" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "city" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "street" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "wardNumber" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "wardNumber"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "street"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "district"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "province"`);
        await queryRunner.query(`ALTER TABLE "products" ADD "locationArea" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "locationDistrict" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "locationProvince" character varying`);
    }

}
