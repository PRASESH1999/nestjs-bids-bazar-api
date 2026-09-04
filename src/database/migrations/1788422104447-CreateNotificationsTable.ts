import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTable1788422104447 implements MigrationInterface {
    name = 'CreateNotificationsTable1788422104447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "relatedId" uuid NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "data" jsonb, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_94f15ddcb2549b7afac0e55ffb" ON "notifications" ("userId", "type", "relatedId") `);
        await queryRunner.query(`CREATE INDEX "IDX_adb71380622f8eb91ce89d5ecc" ON "notifications" ("userId", "isRead", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_adb71380622f8eb91ce89d5ecc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94f15ddcb2549b7afac0e55ffb"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    }

}
