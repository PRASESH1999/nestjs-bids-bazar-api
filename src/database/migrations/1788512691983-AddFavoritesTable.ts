import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFavoritesTable1788512691983 implements MigrationInterface {
    name = 'AddFavoritesTable1788512691983'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "productId" uuid NOT NULL, CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_783e5111df14529ff6124351b1" ON "favorites" ("userId", "productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0108a9b4ed312b4d34dc0c43e1" ON "favorites" ("userId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_e747534006c6e3c2f09939da60f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_0c7bba48aac77ad13092685ba5b" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_0c7bba48aac77ad13092685ba5b"`);
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_e747534006c6e3c2f09939da60f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0108a9b4ed312b4d34dc0c43e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_783e5111df14529ff6124351b1"`);
        await queryRunner.query(`DROP TABLE "favorites"`);
    }

}
