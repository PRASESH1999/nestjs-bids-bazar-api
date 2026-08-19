import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsernameSequenceDropUsernameChangedAt1787041657296 implements MigrationInterface {
    name = 'AddUsernameSequenceDropUsernameChangedAt1787041657296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "usernameChangedAt"`);
        await queryRunner.query(`CREATE SEQUENCE "username_seq" START WITH 1 INCREMENT BY 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SEQUENCE "username_seq"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "usernameChangedAt" TIMESTAMP WITH TIME ZONE`);
    }

}
