import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountSecurity1794120000000 implements MigrationInterface {
    name = 'AddAccountSecurity1794120000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_90489f8f3368c45f461e90efbe5" UNIQUE ("tokenHash"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_email_verification_tokens_userId" ON "email_verification_tokens" ("userId") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" uuid, "actorEmail" character varying, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying, "details" jsonb, "ip" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`);
        // Accounts that existed before verification was introduced count as verified.
        await queryRunner.query(`UPDATE "users" SET "emailVerifiedAt" = "createdAt"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpSecret" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpEnabledAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpRecoveryCodes" text array`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpLastUsedStep" integer`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_10f285d038feb767bf7c2da14b3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_2dc33f7f3c22e2e7badafca1d12" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_2dc33f7f3c22e2e7badafca1d12"`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_10f285d038feb767bf7c2da14b3"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpLastUsedStep"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpRecoveryCodes"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpEnabledAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpSecret"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_createdAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_action"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_verification_tokens_userId"`);
        await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    }

}
