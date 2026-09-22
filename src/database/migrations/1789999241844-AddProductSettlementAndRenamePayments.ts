import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductSettlementAndRenamePayments1789999241844 implements MigrationInterface {
    name = 'AddProductSettlementAndRenamePayments1789999241844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec"`);
        // "payments" is replaced by "product_payments" below (new productSettlementId/
        // sellerId columns + a partial unique index rescoped from productId to
        // productSettlementId). TypeORM's diff can't tell this is a replacement rather
        // than an unrelated new table, so it never generates a DROP for the old one —
        // done explicitly here instead of leaving it as orphaned dead schema.
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_df3c369970714c014a4bcd6b01a"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_80a2b377fa57b59dc5c0e138ef3"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_deliveryzone_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."product_settlements_status_enum" AS ENUM('PENDING_PAYMENT', 'SETTLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "product_settlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "bidId" uuid NOT NULL, "bidWinnerId" uuid NOT NULL, "fallbackRank" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."product_settlements_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_32f94edcf989317ef8f6a408ac4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f28509c6f4572e9e3e2b25e3b1" ON "product_settlements" ("productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e75a511dec4f30d4479b934b9f" ON "product_settlements" ("bidId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_44f38944fa0c33180393d266bc" ON "product_settlements" ("productId") WHERE "status" = 'PENDING_PAYMENT'`);
        await queryRunner.query(`CREATE INDEX "IDX_60b15b3353a02724d1d76fbec1" ON "product_settlements" ("productId", "fallbackRank") `);
        await queryRunner.query(`CREATE TYPE "public"."product_payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TYPE "public"."product_payments_deliveryzone_enum" AS ENUM('INSIDE_VALLEY', 'OUTSIDE_VALLEY')`);
        await queryRunner.query(`CREATE TABLE "product_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "productSettlementId" uuid NOT NULL, "sellerId" uuid NOT NULL, "winnerUserId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "referenceLabel" character varying(30) NOT NULL, "terminalId" character varying(16) NOT NULL, "qrString" text, "qrMessage" text, "websocketUrl" text, "status" "public"."product_payments_status_enum" NOT NULL DEFAULT 'PENDING', "fonepayTraceId" character varying, "paymentMessage" character varying, "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "deliveryZone" "public"."product_payments_deliveryzone_enum" NOT NULL, "deliveryCharge" numeric(10,2) NOT NULL, "sellerPaidAt" TIMESTAMP WITH TIME ZONE, "sellerPaidById" uuid, "sellerPayoutAmount" numeric(12,2), "sellerCommissionPercent" numeric(5,2), CONSTRAINT "PK_acbbf7050eef624e7e81bb65c51" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf1f077cf16bfc3bb28304cfab" ON "product_payments" ("productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd41af63c08957822228a39a32" ON "product_payments" ("productSettlementId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91d660c047775f3a9ad6902f73" ON "product_payments" ("winnerUserId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9b87494b9959394a32cc704b19" ON "product_payments" ("referenceLabel") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d9dc1920b5fc46b8e5f7209f52" ON "product_payments" ("productSettlementId") WHERE "status" = 'PENDING'`);
        await queryRunner.query(`CREATE INDEX "IDX_e716286026f74a8bfe05b4502e" ON "product_payments" ("winnerUserId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_9198b3dbab691f73c3c95c81bf" ON "product_payments" ("productId", "status") `);
        await queryRunner.query(`ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_f28509c6f4572e9e3e2b25e3b10" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_44b3b4119737bafd73d85823a19" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_e75a511dec4f30d4479b934b9f8" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_9ec8327c229623351833d9ded76" FOREIGN KEY ("bidWinnerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_payments" ADD CONSTRAINT "FK_bf1f077cf16bfc3bb28304cfab5" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_payments" ADD CONSTRAINT "FK_fd41af63c08957822228a39a326" FOREIGN KEY ("productSettlementId") REFERENCES "product_settlements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_payments" ADD CONSTRAINT "FK_dce4aca974ab21b2c63c6cac5fb" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_payments" ADD CONSTRAINT "FK_91d660c047775f3a9ad6902f739" FOREIGN KEY ("winnerUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec" FOREIGN KEY ("paymentId") REFERENCES "product_payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec"`);
        await queryRunner.query(`ALTER TABLE "product_payments" DROP CONSTRAINT "FK_91d660c047775f3a9ad6902f739"`);
        await queryRunner.query(`ALTER TABLE "product_payments" DROP CONSTRAINT "FK_dce4aca974ab21b2c63c6cac5fb"`);
        await queryRunner.query(`ALTER TABLE "product_payments" DROP CONSTRAINT "FK_fd41af63c08957822228a39a326"`);
        await queryRunner.query(`ALTER TABLE "product_payments" DROP CONSTRAINT "FK_bf1f077cf16bfc3bb28304cfab5"`);
        await queryRunner.query(`ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_9ec8327c229623351833d9ded76"`);
        await queryRunner.query(`ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_e75a511dec4f30d4479b934b9f8"`);
        await queryRunner.query(`ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_44b3b4119737bafd73d85823a19"`);
        await queryRunner.query(`ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_f28509c6f4572e9e3e2b25e3b10"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9198b3dbab691f73c3c95c81bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e716286026f74a8bfe05b4502e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d9dc1920b5fc46b8e5f7209f52"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b87494b9959394a32cc704b19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91d660c047775f3a9ad6902f73"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd41af63c08957822228a39a32"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf1f077cf16bfc3bb28304cfab"`);
        await queryRunner.query(`DROP TABLE "product_payments"`);
        await queryRunner.query(`DROP TYPE "public"."product_payments_deliveryzone_enum"`);
        await queryRunner.query(`DROP TYPE "public"."product_payments_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60b15b3353a02724d1d76fbec1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44f38944fa0c33180393d266bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e75a511dec4f30d4479b934b9f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f28509c6f4572e9e3e2b25e3b1"`);
        await queryRunner.query(`DROP TABLE "product_settlements"`);
        await queryRunner.query(`DROP TYPE "public"."product_settlements_status_enum"`);
        // Recreate "payments" exactly as InitSchema defined it before re-linking seller_ratings.
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_deliveryzone_enum" AS ENUM('INSIDE_VALLEY', 'OUTSIDE_VALLEY')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "winnerUserId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "referenceLabel" character varying(30) NOT NULL, "terminalId" character varying(16) NOT NULL, "qrString" text, "qrMessage" text, "websocketUrl" text, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "fonepayTraceId" character varying, "paymentMessage" character varying, "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "deliveryZone" "public"."payments_deliveryzone_enum" NOT NULL, "deliveryCharge" numeric(10,2) NOT NULL, "sellerPaidAt" TIMESTAMP WITH TIME ZONE, "sellerPaidById" uuid, "sellerPayoutAmount" numeric(12,2), "sellerCommissionPercent" numeric(5,2), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_80a2b377fa57b59dc5c0e138ef" ON "payments" ("productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_df3c369970714c014a4bcd6b01" ON "payments" ("winnerUserId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_885b048d8480daa62900ddf01e" ON "payments" ("referenceLabel") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4eb1e967f6cc268c5a47d895a7" ON "payments" ("productId") WHERE "status" = 'PENDING'`);
        await queryRunner.query(`CREATE INDEX "IDX_dcfc63d678037d5ed27778bb6b" ON "payments" ("winnerUserId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_99334eb0755ef43771f9ef80c0" ON "payments" ("productId", "status") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_80a2b377fa57b59dc5c0e138ef3" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_df3c369970714c014a4bcd6b01a" FOREIGN KEY ("winnerUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
