import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogFeatures1794130000000 implements MigrationInterface {
    name = 'AddCatalogFeatures1794130000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "userId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_reviews_product_user" UNIQUE ("productId", "userId"), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_reviews_productId" ON "reviews" ("productId") `);
        await queryRunner.query(`CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "productId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_wishlist_user_product" UNIQUE ("userId", "productId"), CONSTRAINT "PK_0bd52924a97cda208ed2a07bd69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_wishlist_items_productId" ON "wishlist_items" ("productId") `);
        await queryRunner.query(`ALTER TABLE "products" ADD "galleryUrls" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "products" ADD "ratingAverage" numeric(3,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "products" ADD "ratingCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_a6b3c434392f5d10ec171043666" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_3167e7490f12ed329a36703d980" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_485ece8ab9b569d1c560144aa25" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_485ece8ab9b569d1c560144aa25"`);
        await queryRunner.query(`ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_3167e7490f12ed329a36703d980"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_a6b3c434392f5d10ec171043666"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "ratingCount"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "ratingAverage"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "galleryUrls"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_wishlist_items_productId"`);
        await queryRunner.query(`DROP TABLE "wishlist_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reviews_productId"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
    }

}
