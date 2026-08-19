import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKycNidPhoneOptionalBank1787120761933 implements MigrationInterface {
    name = 'AddKycNidPhoneOptionalBank1787120761933'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "nidFrontPath" character varying`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "nidBackPath" character varying`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "primaryPhone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "secondaryPhone" character varying(20)`);
        await queryRunner.query(`ALTER TYPE "public"."kyc_verifications_documenttype_enum" RENAME TO "kyc_verifications_documenttype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_verifications_documenttype_enum" AS ENUM('CITIZENSHIP', 'PASSPORT', 'NID_CARD')`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ALTER COLUMN "documentType" TYPE "public"."kyc_verifications_documenttype_enum" USING "documentType"::"text"::"public"."kyc_verifications_documenttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_verifications_documenttype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."kyc_verifications_documenttype_enum_old" AS ENUM('CITIZENSHIP', 'PASSPORT')`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ALTER COLUMN "documentType" TYPE "public"."kyc_verifications_documenttype_enum_old" USING "documentType"::"text"::"public"."kyc_verifications_documenttype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_verifications_documenttype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."kyc_verifications_documenttype_enum_old" RENAME TO "kyc_verifications_documenttype_enum"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "secondaryPhone"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "primaryPhone"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "nidBackPath"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "nidFrontPath"`);
    }

}
