import { MigrationInterface, QueryRunner } from "typeorm";
import { WILAYAS } from "../data/wilayas";

// Pay on delivery + wilaya-based shipping.
// Every zone starts active with a 0 DA home price and no stop-desk option, so
// checkout keeps behaving exactly as before (free delivery) until a super
// admin sets real prices in Dashboard → Shipping.
export class AddDeliveryAndCod1794090000000 implements MigrationInterface {
  name = "AddDeliveryAndCod1794090000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "shipping_zones" (
        "code" integer NOT NULL,
        "name" character varying NOT NULL,
        "nameAr" character varying NOT NULL,
        "homePrice" numeric(10,2) NOT NULL DEFAULT '0',
        "deskPrice" numeric(10,2),
        "isActive" boolean NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipping_zones_code" PRIMARY KEY ("code")
      )`);
    for (const [code, name, nameAr] of WILAYAS) {
      await queryRunner.query(
        `INSERT INTO "shipping_zones" ("code", "name", "nameAr") VALUES ($1, $2, $3)`,
        [code, name, nameAr],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentMethod" character varying NOT NULL DEFAULT 'card'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "shippingFee" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "wilayaCode" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "wilayaName" character varying`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "commune" character varying`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "phone" character varying`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryType" character varying`);

    await queryRunner.query(`ALTER TABLE "users" ADD "wilayaCode" integer`);
    await queryRunner.query(`ALTER TABLE "users" ADD "commune" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "commune"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "wilayaCode"`);
    for (const column of [
      "deliveryType",
      "phone",
      "commune",
      "wilayaName",
      "wilayaCode",
      "shippingFee",
      "paymentMethod",
    ]) {
      await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "${column}"`);
    }
    await queryRunner.query(`DROP TABLE "shipping_zones"`);
  }
}
