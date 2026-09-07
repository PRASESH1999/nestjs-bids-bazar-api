import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKycPhoneVerification1788693951129 implements MigrationInterface {
    name = 'AddKycPhoneVerification1788693951129'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "phoneOtpHash" character varying`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "phoneOtpExpiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "phoneOtpAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "phoneVerifiedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "phoneVerifiedAt"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpAttempts"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "phoneOtpHash"`);
    }

}
