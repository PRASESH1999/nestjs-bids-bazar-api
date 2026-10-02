import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProductStatusEnum1789990314613 implements MigrationInterface {
  name = 'RenameProductStatusEnum1789990314613';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bca32e7e2b877bcaae255805c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_58075ba759b7738eb2eac5a9af"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."products_status_enum" RENAME TO "products_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum" AS ENUM('DRAFT', 'AWAITING_APPROVAL', 'REJECTED', 'AWAITING_FIRST_BID', 'ACTIVE', 'AWAITING_PAYMENT', 'SETTLED', 'ABANDONED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT`,
    );
    // Explicit remap rather than a bare text cast: SUBMITTED/PENDING are
    // renamed, and APPROVED/CLOSED/PAYMENT_FAILED no longer exist as
    // distinct statuses (nothing in the app ever set them going forward,
    // but a bare cast would hard-fail the migration if a stray row ever
    // did land in one of them, so we fold them into their closest
    // surviving equivalent instead of assuming zero rows).
    await queryRunner.query(`
            ALTER TABLE "products" ALTER COLUMN "status" TYPE "public"."products_status_enum" USING (
                CASE "status"::"text"
                    WHEN 'SUBMITTED' THEN 'AWAITING_APPROVAL'
                    WHEN 'PENDING' THEN 'AWAITING_FIRST_BID'
                    WHEN 'APPROVED' THEN 'AWAITING_FIRST_BID'
                    WHEN 'CLOSED' THEN 'AWAITING_PAYMENT'
                    WHEN 'PAYMENT_FAILED' THEN 'ABANDONED'
                    ELSE "status"::"text"
                END
            )::"public"."products_status_enum"
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."products_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bca32e7e2b877bcaae255805c3" ON "products" ("ownerId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58075ba759b7738eb2eac5a9af" ON "products" ("status", "createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_58075ba759b7738eb2eac5a9af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bca32e7e2b877bcaae255805c3"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum_old" AS ENUM('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'PENDING', 'ACTIVE', 'CLOSED', 'AWAITING_PAYMENT', 'SETTLED', 'PAYMENT_FAILED', 'ABANDONED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT`,
    );
    // Reverse remap: only AWAITING_APPROVAL/AWAITING_FIRST_BID need translating
    // back; APPROVED/CLOSED/PAYMENT_FAILED are gone for good on rollback too,
    // since we can no longer tell which rows originally held them.
    await queryRunner.query(`
            ALTER TABLE "products" ALTER COLUMN "status" TYPE "public"."products_status_enum_old" USING (
                CASE "status"::"text"
                    WHEN 'AWAITING_APPROVAL' THEN 'SUBMITTED'
                    WHEN 'AWAITING_FIRST_BID' THEN 'PENDING'
                    ELSE "status"::"text"
                END
            )::"public"."products_status_enum_old"
        `);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."products_status_enum_old" RENAME TO "products_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58075ba759b7738eb2eac5a9af" ON "products" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bca32e7e2b877bcaae255805c3" ON "products" ("ownerId", "status") `,
    );
  }
}
