import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodProtection1794140000000 implements MigrationInterface {
    name = 'AddCodProtection1794140000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order_calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "outcome" character varying NOT NULL, "note" character varying, "createdById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_33751d046324b2bc0478e763646" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_order_calls_orderId" ON "order_calls" ("orderId") `);
        await queryRunner.query(`CREATE TABLE "blocked_phones" ("phone" character varying NOT NULL, "reason" character varying, "createdById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_blocked_phones_phone" PRIMARY KEY ("phone"))`);
        await queryRunner.query(`CREATE TABLE "phone_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11ef2c1c5ed828b9636472db666" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_phone_verifications_phone" ON "phone_verifications" ("phone") `);
        await queryRunner.query(`ALTER TABLE "orders" ADD "confirmedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "callAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "returnedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "returnReason" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "returnCost" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "order_calls" ADD CONSTRAINT "FK_aac97371d7a1b420f9011f8ea7f" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_calls" ADD CONSTRAINT "FK_b22eb8edbfa0d48247bd4025414" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_calls" DROP CONSTRAINT "FK_b22eb8edbfa0d48247bd4025414"`);
        await queryRunner.query(`ALTER TABLE "order_calls" DROP CONSTRAINT "FK_aac97371d7a1b420f9011f8ea7f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "returnCost"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "returnReason"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "returnedAt"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "callAttempts"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "confirmedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phone_verifications_phone"`);
        await queryRunner.query(`DROP TABLE "phone_verifications"`);
        await queryRunner.query(`DROP TABLE "blocked_phones"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_calls_orderId"`);
        await queryRunner.query(`DROP TABLE "order_calls"`);
    }

}
