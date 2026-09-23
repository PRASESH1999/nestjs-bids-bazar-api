import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pathao courier integration (warehouse -> buyer leg):
 *  - shipping_addresses: adds Pathao city/zone/area columns.
 *  - product_payments: drops deliveryZone (+ its enum) and
 *    shippingAddressSnapshot — delivery/fulfilment data now lives on the new
 *    product_deliveries table instead (shippingAddressId + deliveryCharge
 *    stay on product_payments; they're payment-transaction data, not
 *    fulfilment data — see ProductPayment entity comments).
 *  - product_deliveries: new table, one row per successful sale.
 *
 * NOTE: `migration:generate` also produced unrelated drops/recreates of
 * pre-existing constraints on users/kyc_verifications/shipping_addresses
 * (hand-picked names from an earlier migration not matching TypeORM's
 * auto-generated names) — that drift predates this change and has been
 * stripped out of this file to keep it scoped to the Pathao feature only.
 */
export class AddPathaoDeliveryIntegration1790162955408 implements MigrationInterface {
  name = 'AddPathaoDeliveryIntegration1790162955408';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoCityId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoCityName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoZoneId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoZoneName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoAreaId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD "pathaoAreaName" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP COLUMN "deliveryZone"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."product_payments_deliveryzone_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP COLUMN "shippingAddressSnapshot"`,
    );

    await queryRunner.query(
      `CREATE TABLE "product_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productPaymentId" uuid NOT NULL, "recipientName" character varying(150) NOT NULL, "recipientPhone" character varying(20) NOT NULL, "province" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "city" character varying(100) NOT NULL, "street" character varying(255) NOT NULL, "wardNumber" character varying(20), "landmark" character varying(500), "pathaoCityId" integer NOT NULL, "pathaoCityName" character varying, "pathaoZoneId" integer NOT NULL, "pathaoZoneName" character varying, "pathaoAreaId" integer, "pathaoAreaName" character varying, "deliveryCharge" numeric(10,2) NOT NULL, "receivedAtWarehouseAt" TIMESTAMP WITH TIME ZONE, "receivedAtWarehouseById" uuid, "storeId" integer, "consignmentId" character varying, "itemWeightKg" numeric(5,2), "itemDescription" character varying, "amountToCollect" numeric(10,2) NOT NULL DEFAULT '0', "pathaoDeliveryFee" numeric(10,2), "dispatchedById" uuid, "dispatchedAt" TIMESTAMP WITH TIME ZONE, "orderStatus" character varying, "lastStatusCheckAt" TIMESTAMP WITH TIME ZONE, "deliveredAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4ee290e6efbebbb6fb6a9e808fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_124f23fdbc51c8964fd434bfc8" ON "product_deliveries" ("productPaymentId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9623ad7b04e95c837117b3d9bd" ON "product_deliveries" ("consignmentId") WHERE "consignmentId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD CONSTRAINT "FK_124f23fdbc51c8964fd434bfc84" FOREIGN KEY ("productPaymentId") REFERENCES "product_payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP CONSTRAINT "FK_124f23fdbc51c8964fd434bfc84"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9623ad7b04e95c837117b3d9bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_124f23fdbc51c8964fd434bfc8"`,
    );
    await queryRunner.query(`DROP TABLE "product_deliveries"`);

    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD "shippingAddressSnapshot" jsonb`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_payments_deliveryzone_enum" AS ENUM('INSIDE_VALLEY', 'OUTSIDE_VALLEY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD "deliveryZone" "public"."product_payments_deliveryzone_enum" NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoAreaName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoAreaId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoZoneName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoZoneId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoCityName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP COLUMN "pathaoCityId"`,
    );
  }
}
