import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentsAndPayouts1794100000000 implements MigrationInterface {
    name = 'AddShipmentsAndPayouts1794100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "shopId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "carrier" character varying, "trackingNumber" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_shipments_order_shop" UNIQUE ("orderId", "shopId"), CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_shipments_shopId" ON "shipments" ("shopId") `);
        await queryRunner.query(`CREATE TABLE "payouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shopId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "reference" character varying, "note" character varying, "createdById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payouts_shopId" ON "payouts" ("shopId") `);
        await queryRunner.query(`ALTER TABLE "order_items" ADD "commissionRate" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "couponShopId" uuid`);
        await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_13ba957bcb616719a0dc3fca82f" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_d5533e1491fdbbb7a4608981833" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payouts" ADD CONSTRAINT "FK_00bee286e10503ef93d9bc4a251" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payouts" ADD CONSTRAINT "FK_0f8677ada7e6d81a15ea0f4f331" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Backfill: one shipment per shop for every existing order, carrying
        // the order's current status.
        await queryRunner.query(`
            INSERT INTO "shipments" ("orderId", "shopId", "status")
            SELECT DISTINCT oi."orderId", s."id", o."status"
            FROM "order_items" oi
            JOIN "orders" o ON o."id" = oi."orderId"
            JOIN "shops" s ON s."id"::text = oi."shopId"`);
        // Backfill: which shop absorbed each existing order's coupon discount.
        await queryRunner.query(`
            UPDATE "orders" o SET "couponShopId" = c."shopId"
            FROM "coupons" c
            WHERE c."code" = o."couponCode" AND c."shopId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payouts" DROP CONSTRAINT "FK_0f8677ada7e6d81a15ea0f4f331"`);
        await queryRunner.query(`ALTER TABLE "payouts" DROP CONSTRAINT "FK_00bee286e10503ef93d9bc4a251"`);
        await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_d5533e1491fdbbb7a4608981833"`);
        await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_13ba957bcb616719a0dc3fca82f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "couponShopId"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "commissionRate"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payouts_shopId"`);
        await queryRunner.query(`DROP TABLE "payouts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_shipments_shopId"`);
        await queryRunner.query(`DROP TABLE "shipments"`);
    }

}
