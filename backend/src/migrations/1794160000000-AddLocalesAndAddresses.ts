import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocalesAndAddresses1794160000000 implements MigrationInterface {
    name = 'AddLocalesAndAddresses1794160000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "label" character varying(40) NOT NULL, "phone" character varying(20) NOT NULL, "wilayaCode" integer NOT NULL, "commune" character varying(100) NOT NULL, "address" character varying(500) NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_addresses_userId" ON "addresses" ("userId") `);
        await queryRunner.query(`ALTER TABLE "orders" ADD "locale" character varying(2) NOT NULL DEFAULT 'en'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "cancelledBy" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "locale" character varying(2) NOT NULL DEFAULT 'en'`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD CONSTRAINT "FK_95c93a584de49f0b0e13f753630" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "addresses" DROP CONSTRAINT "FK_95c93a584de49f0b0e13f753630"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelledBy"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "locale"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_addresses_userId"`);
        await queryRunner.query(`DROP TABLE "addresses"`);
    }

}
