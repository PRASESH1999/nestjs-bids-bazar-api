import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identity split: the account keeps a verified phone, KYC keeps the legal name.
 *
 * Four changes that have to happen together, because each one's backfill reads
 * a column another one drops:
 *
 *  1. `users.name` → `kyc_verifications.fullName`. The name a person goes by is
 *     a verified attribute; carrying an unverified copy on the profile meant
 *     two names per account and nothing saying which was authoritative.
 *     `username` becomes the public identity everywhere.
 *  2. Phone verification moves KYC → User, because it now *precedes* KYC.
 *     `primaryPhone` and `phoneVerifiedAt` are carried over, so nobody
 *     re-verifies a number they have already confirmed.
 *  3. `documentId` on KYC, unique per document type, so one physical document
 *     backs one account.
 *  4. `shipping_addresses`, and the payment columns that reference one.
 *
 * Every drop is preceded by its carry-over. Existing APPROVED submissions keep
 * working untouched: their phone lands on the user already verified.
 */
export class MoveIdentityToKycAddPhoneAndShipping1790000200000 implements MigrationInterface {
  name = 'MoveIdentityToKycAddPhoneAndShipping1790000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. New columns, before anything is read out of the old ones ────────
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "fullName" character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "documentId" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "rejectedFields" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pendingPhone" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneVerifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneOtpHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneOtpExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneOtpAttempts" integer NOT NULL DEFAULT 0`,
    );

    // ─── 2. Carry the data across ───────────────────────────────────────────

    // The name on file becomes the name on the submission. Only where a KYC
    // exists — an account without one simply has no full name until it submits.
    await queryRunner.query(`
      UPDATE "kyc_verifications" k
      SET "fullName" = u."name"
      FROM "users" u
      WHERE u."id" = k."userId" AND u."name" IS NOT NULL
    `);

    /*
     * Phone and its verification move to the account.
     *
     * Deduplicated: `users.phone` is uniquely indexed below, and nothing
     * previously stopped two KYC rows carrying the same number. Where that
     * happened, the earliest *verified* submission wins the number and the
     * others are left without one — they re-verify, rather than the migration
     * failing outright or silently picking arbitrarily.
     */
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          k."userId",
          k."primaryPhone",
          k."phoneVerifiedAt",
          ROW_NUMBER() OVER (
            PARTITION BY k."primaryPhone"
            ORDER BY (k."phoneVerifiedAt" IS NULL), k."phoneVerifiedAt", k."createdAt"
          ) AS rn
        FROM "kyc_verifications" k
        WHERE k."primaryPhone" IS NOT NULL
      )
      UPDATE "users" u
      SET "phone" = r."primaryPhone",
          "phoneVerifiedAt" = r."phoneVerifiedAt"
      FROM ranked r
      WHERE u."id" = r."userId" AND r.rn = 1
    `);

    // ─── 3. Drop what has now moved ─────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nameChangedAt"`);
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "primaryPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "phoneVerifiedAt"`,
    );
    // `secondaryPhone` survives as the emergency contact — renamed, because
    // "secondary" means nothing once there is no primary beside it.
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" RENAME COLUMN "secondaryPhone" TO "emergencyContactPhone"`,
    );

    // ─── 4. Indexes for the new identity columns ────────────────────────────
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_phone_unique" ON "users" ("phone") WHERE "phone" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_kyc_document_identity_unique" ON "kyc_verifications" ("documentType", "documentId") WHERE "documentId" IS NOT NULL`,
    );

    // ─── 5. Shipping addresses ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "shipping_addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "userId" uuid NOT NULL,
        "label" character varying(50) NOT NULL,
        "recipientName" character varying(150) NOT NULL,
        "recipientPhone" character varying(20) NOT NULL,
        "province" character varying(100) NOT NULL,
        "district" character varying(100) NOT NULL,
        "city" character varying(100) NOT NULL,
        "street" character varying(255) NOT NULL,
        "wardNumber" character varying(20),
        "landmark" character varying(500),
        "isDefault" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_shipping_addresses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_shipping_addresses_userId" ON "shipping_addresses" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shipping_addresses_user_default" ON "shipping_addresses" ("userId", "isDefault")`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD CONSTRAINT "FK_shipping_addresses_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD "shippingAddressId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD "shippingAddressSnapshot" jsonb`,
    );
    // SET NULL, not RESTRICT: deleting a saved address must not be blocked by
    // an old order, and must not rewrite where that order went — the snapshot
    // column is what fulfilment reads.
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_product_payments_shipping_address" FOREIGN KEY ("shippingAddressId") REFERENCES "shipping_addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_product_payments_shipping_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP COLUMN "shippingAddressSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP COLUMN "shippingAddressId"`,
    );
    await queryRunner.query(`DROP TABLE "shipping_addresses"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_kyc_document_identity_unique"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_users_phone_unique"`);

    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" RENAME COLUMN "emergencyContactPhone" TO "secondaryPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "phoneVerifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "phoneOtpAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "phoneOtpExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "phoneOtpHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" ADD "primaryPhone" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "nameChangedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "name" character varying(255)`,
    );

    // Put the data back where it came from, then restore NOT NULL. `username`
    // is the fallback for an account that never had a KYC row to take a name
    // from — the original value is genuinely gone in that case.
    await queryRunner.query(`
      UPDATE "users" u
      SET "name" = COALESCE(k."fullName", u."username")
      FROM "kyc_verifications" k
      WHERE k."userId" = u."id"
    `);
    await queryRunner.query(
      `UPDATE "users" SET "name" = "username" WHERE "name" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL`,
    );

    await queryRunner.query(`
      UPDATE "kyc_verifications" k
      SET "primaryPhone" = u."phone", "phoneVerifiedAt" = u."phoneVerifiedAt"
      FROM "users" u
      WHERE u."id" = k."userId" AND u."phone" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "phoneOtpAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "phoneOtpExpiresAt"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneOtpHash"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "phoneVerifiedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pendingPhone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);

    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "rejectedFields"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "documentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kyc_verifications" DROP COLUMN "fullName"`,
    );
  }
}
