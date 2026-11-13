import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPromotionsPixelsStockAlerts1794200000000 implements MigrationInterface {
    name = 'AddPromotionsPixelsStockAlerts1794200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "stock_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "variantId" uuid, "email" character varying(254) NOT NULL, "locale" character varying(2) NOT NULL DEFAULT 'en', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "notifiedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3c3bb550b3bf192460bffe3a55b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_alerts_productId" ON "stock_alerts" ("productId") `);
        // One pending alert per (product, option, email); a plain product has
        // no option, so NULLs must compare equal (Postgres 15+).
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_alerts_pending" ON "stock_alerts" ("productId", "variantId", "email") NULLS NOT DISTINCT WHERE "notifiedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "products" ADD "compareAtPrice" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "freeShippingThreshold" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "facebookPixelId" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "store_settings" ADD "tiktokPixelId" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "stock_alerts" ADD CONSTRAINT "FK_36ed3d3e893b4e2c20d541be68b" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_alerts" ADD CONSTRAINT "FK_c6a3f3421b6694982fb806f260e" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_alerts" DROP CONSTRAINT "FK_c6a3f3421b6694982fb806f260e"`);
        await queryRunner.query(`ALTER TABLE "stock_alerts" DROP CONSTRAINT "FK_36ed3d3e893b4e2c20d541be68b"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "tiktokPixelId"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "facebookPixelId"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN "freeShippingThreshold"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "compareAtPrice"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_stock_alerts_pending"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_alerts_productId"`);
        await queryRunner.query(`DROP TABLE "stock_alerts"`);
    }

}
