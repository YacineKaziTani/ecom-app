import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStoreSettings1794180000000 implements MigrationInterface {
    name = 'AddStoreSettings1794180000000'

    // One row (id 1) with the business details shown on the Contact and legal
    // pages; until a super admin saves them the API returns the defaults.
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "store_settings" ("id" integer NOT NULL DEFAULT '1', "legalName" character varying(120), "registerNumber" character varying(60), "taxId" character varying(40), "address" character varying(300), "phone" character varying(20), "whatsapp" character varying(20), "email" character varying(254), "openingHours" character varying(120), "facebookUrl" character varying(300), "instagramUrl" character varying(300), "tiktokUrl" character varying(300), "deliveryDaysMin" integer NOT NULL DEFAULT '2', "deliveryDaysMax" integer NOT NULL DEFAULT '7', "exchangeDays" integer NOT NULL DEFAULT '7', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_store_settings_single_row" CHECK ("id" = 1), CONSTRAINT "PK_store_settings_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "store_settings"`);
    }

}
