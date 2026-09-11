import { MigrationInterface, QueryRunner } from "typeorm";

export class DropKycNidBackPath1789119439232 implements MigrationInterface {
    name = 'DropKycNidBackPath1789119439232'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "nidBackPath"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "nidBackPath" character varying`);
    }

}
