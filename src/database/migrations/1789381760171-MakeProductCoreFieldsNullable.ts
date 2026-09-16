import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeProductCoreFieldsNullable1789381760171 implements MigrationInterface {
    name = 'MakeProductCoreFieldsNullable1789381760171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3bc014be6177ded36911df7db5"`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "title" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "description" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoryId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "subcategoryId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "condition" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "basePrice" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "biddingStartPrice" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "instantBuyPrice" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_3bc014be6177ded36911df7db5" ON "products" ("categoryId", "subcategoryId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3bc014be6177ded36911df7db5"`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "instantBuyPrice" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "biddingStartPrice" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "basePrice" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "condition" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "subcategoryId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "title" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_3bc014be6177ded36911df7db5" ON "products" ("categoryId", "subcategoryId") `);
    }

}
