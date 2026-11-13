import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHomeAndShopProfiles1794190000000 implements MigrationInterface {
    name = 'AddHomeAndShopProfiles1794190000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "home_banners" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "imageUrl" character varying(2048) NOT NULL, "title" character varying(120) NOT NULL, "subtitle" character varying(240), "ctaLabel" character varying(40), "link" character varying(300), "lang" character varying(2), "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f38a619c5a7cb0c0fa0649ae000" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "coverUrl" character varying(2048)`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "story" text`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "wilayaCode" integer`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "instagramUrl" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "facebookUrl" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "shops" ADD "tiktokUrl" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "featuredShopId" uuid`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD CONSTRAINT "FK_a74001fd06267b702a6467c6632" FOREIGN KEY ("featuredShopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_settings" DROP CONSTRAINT "FK_a74001fd06267b702a6467c6632"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "featuredShopId"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "tiktokUrl"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "facebookUrl"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "instagramUrl"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "wilayaCode"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "story"`);
        await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "coverUrl"`);
        await queryRunner.query(`DROP TABLE "home_banners"`);
    }

}
