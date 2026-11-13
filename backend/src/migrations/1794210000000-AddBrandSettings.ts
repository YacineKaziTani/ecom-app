import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBrandSettings1794210000000 implements MigrationInterface {
    name = 'AddBrandSettings1794210000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "brandName" character varying(60) NOT NULL DEFAULT 'ArtisanShop'`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "logoUrl" character varying(2048)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "logoUrl"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "brandName"`);
    }

}
