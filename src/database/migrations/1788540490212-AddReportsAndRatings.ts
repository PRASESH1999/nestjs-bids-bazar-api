import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReportsAndRatings1788540490212 implements MigrationInterface {
    name = 'AddReportsAndRatings1788540490212'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."product_reports_status_enum" AS ENUM('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')`);
        await queryRunner.query(`CREATE TABLE "product_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "reporterId" uuid NOT NULL, "productId" uuid NOT NULL, "reportedUserId" uuid NOT NULL, "remarks" text NOT NULL, "status" "public"."product_reports_status_enum" NOT NULL DEFAULT 'PENDING', "adminNote" text, CONSTRAINT "PK_57b3bd50de73401641fd93a2fcf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c1004896d463a9d26b2fea56c" ON "product_reports" ("reportedUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e18f805b13b851ae5fbf326399" ON "product_reports" ("status", "createdAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_77cb24169f3eb8fbe19b5c8b2f" ON "product_reports" ("reporterId", "productId") `);
        await queryRunner.query(`CREATE TABLE "seller_ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "buyerId" uuid NOT NULL, "sellerId" uuid NOT NULL, "paymentId" uuid NOT NULL, "rating" integer NOT NULL, "remarks" text, CONSTRAINT "PK_f698f873830975c1fee3ba68d3e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f0fb66e4ea20df651a1fa000c" ON "seller_ratings" ("sellerId", "createdAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6f42babf8a7351f3cb827ade2e" ON "seller_ratings" ("paymentId") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "averageRating" numeric(3,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "ratingCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "product_reports" ADD CONSTRAINT "FK_8df8a3db47ccb2bad377c852305" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_reports" ADD CONSTRAINT "FK_5f76f68e7b084bbcd31f36df78b" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_reports" ADD CONSTRAINT "FK_1c1004896d463a9d26b2fea56c1" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_1606624daf84ff30e039cdaabf7" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_95db746b058b5275d492683306e" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec"`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_95db746b058b5275d492683306e"`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_1606624daf84ff30e039cdaabf7"`);
        await queryRunner.query(`ALTER TABLE "product_reports" DROP CONSTRAINT "FK_1c1004896d463a9d26b2fea56c1"`);
        await queryRunner.query(`ALTER TABLE "product_reports" DROP CONSTRAINT "FK_5f76f68e7b084bbcd31f36df78b"`);
        await queryRunner.query(`ALTER TABLE "product_reports" DROP CONSTRAINT "FK_8df8a3db47ccb2bad377c852305"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ratingCount"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "averageRating"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6f42babf8a7351f3cb827ade2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f0fb66e4ea20df651a1fa000c"`);
        await queryRunner.query(`DROP TABLE "seller_ratings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77cb24169f3eb8fbe19b5c8b2f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e18f805b13b851ae5fbf326399"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c1004896d463a9d26b2fea56c"`);
        await queryRunner.query(`DROP TABLE "product_reports"`);
        await queryRunner.query(`DROP TYPE "public"."product_reports_status_enum"`);
    }

}
