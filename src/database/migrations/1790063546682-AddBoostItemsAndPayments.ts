import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBoostItemsAndPayments1790063546682 implements MigrationInterface {
  name = 'AddBoostItemsAndPayments1790063546682';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."boost_items_scheme_enum" AS ENUM('PER_DAY', 'THREE_DAYS', 'SEVEN_DAYS', 'FIFTEEN_DAYS', 'THIRTY_DAYS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."boost_items_status_enum" AS ENUM('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "boost_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "scheme" "public"."boost_items_scheme_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."boost_items_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "startDateTime" TIMESTAMP WITH TIME ZONE, "endDateTime" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d96276db71ee5c90de478360316" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ef29c6863d56d3a9c9d721228" ON "boost_items" ("productId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a71a576d0e6e6b208309500171" ON "boost_items" ("productId") WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a860378323fe760b069798b88" ON "boost_items" ("productId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf4418010e27d99deb50d0304a" ON "boost_items" ("status", "startDateTime") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."boost_payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "boost_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "boostItemId" uuid NOT NULL, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "referenceLabel" character varying(30) NOT NULL, "terminalId" character varying(16) NOT NULL, "qrString" text, "qrMessage" text, "status" "public"."boost_payments_status_enum" NOT NULL DEFAULT 'PENDING', "fonepayTraceId" character varying, "paymentMessage" character varying, "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4d3c4c36bc423bb28b3f4e0bf3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00bd60dcedbe7af797fb6c7e76" ON "boost_payments" ("boostItemId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a152f42d9addfd41f07fa8361" ON "boost_payments" ("productId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_50c808d5cf1f8227904f72696a" ON "boost_payments" ("referenceLabel") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_18696fcb6865e8e91bfad3d181" ON "boost_payments" ("boostItemId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5efaf345d79005418798677634" ON "boost_payments" ("sellerId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40ad739f3e334da05b3549b1bd" ON "boost_payments" ("productId", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" ADD CONSTRAINT "FK_3ef29c6863d56d3a9c9d721228e" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" ADD CONSTRAINT "FK_c5ef00d5396223dbde36b52f83f" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_00bd60dcedbe7af797fb6c7e76c" FOREIGN KEY ("boostItemId") REFERENCES "boost_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_9a152f42d9addfd41f07fa8361d" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_11b839803f6d3b4cbba033993e1" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_11b839803f6d3b4cbba033993e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_9a152f42d9addfd41f07fa8361d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_00bd60dcedbe7af797fb6c7e76c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" DROP CONSTRAINT "FK_c5ef00d5396223dbde36b52f83f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" DROP CONSTRAINT "FK_3ef29c6863d56d3a9c9d721228e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40ad739f3e334da05b3549b1bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5efaf345d79005418798677634"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18696fcb6865e8e91bfad3d181"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50c808d5cf1f8227904f72696a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a152f42d9addfd41f07fa8361"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_00bd60dcedbe7af797fb6c7e76"`,
    );
    await queryRunner.query(`DROP TABLE "boost_payments"`);
    await queryRunner.query(`DROP TYPE "public"."boost_payments_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf4418010e27d99deb50d0304a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a860378323fe760b069798b88"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a71a576d0e6e6b208309500171"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ef29c6863d56d3a9c9d721228"`,
    );
    await queryRunner.query(`DROP TABLE "boost_items"`);
    await queryRunner.query(`DROP TYPE "public"."boost_items_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."boost_items_scheme_enum"`);
  }
}
