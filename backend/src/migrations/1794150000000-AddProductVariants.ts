import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductVariants1794150000000 implements MigrationInterface {
    name = 'AddProductVariants1794150000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "UQ_f5c53f7e745f8fa6e473875aaa2"`);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "name" character varying NOT NULL, "sku" character varying, "price" numeric(10,2), "stock" integer NOT NULL DEFAULT '0', "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_variants_product_name" UNIQUE ("productId", "name"), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_product_variants_productId" ON "product_variants" ("productId") `);
        await queryRunner.query(`ALTER TABLE "order_items" ADD "variantId" uuid`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD "variantName" character varying`);
        await queryRunner.query(`ALTER TABLE "cart_items" ADD "variantId" uuid`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_f515690c571a03400a9876600b5" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_516736b9807228bb17b2d0a3e2a" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "FK_5a27845bc2d79be6f1fa3d2c036" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // One cart line per user + product + variant; "no variant" counts as one
        // value (NULLS NOT DISTINCT, Postgres 15+), so plain products can't get
        // duplicate lines either.
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cart_items_line" ON "cart_items" ("userId", "productId", "variantId") NULLS NOT DISTINCT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_cart_items_line"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_5a27845bc2d79be6f1fa3d2c036"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_516736b9807228bb17b2d0a3e2a"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_f515690c571a03400a9876600b5"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP COLUMN "variantId"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "variantName"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "variantId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_variants_productId"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "UQ_f5c53f7e745f8fa6e473875aaa2" UNIQUE ("userId", "productId")`);
    }

}
