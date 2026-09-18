import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKycRemarks1789536368786 implements MigrationInterface {
    name = 'AddKycRemarks1789536368786'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD "remarks" character varying(1000)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP COLUMN "remarks"`);
    }

}
