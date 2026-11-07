import { MigrationInterface, QueryRunner } from "typeorm";

// Postgres doesn't index foreign-key columns automatically, so lookups like
// "this customer's orders" / "this shop's products" (and ON DELETE cascades)
// were full table scans. Also: a partial index for the reservation-expiry job
// and trigram indexes for the storefront's ILIKE '%term%' search.
//
// Plain CREATE INDEX briefly blocks writes on each table while it builds —
// fine at this size; for very large tables you'd build them CONCURRENTLY
// outside a migration transaction instead.
const INDEXES: [name: string, definition: string][] = [
  ["IDX_orders_userId", `"orders" ("userId")`],
  ["IDX_orders_createdAt", `"orders" ("createdAt")`],
  [
    "IDX_orders_reservation",
    `"orders" ("reservedUntil") WHERE "status" = 'pending' AND "paymentStatus" <> 'paid'`,
  ],
  ["IDX_order_items_orderId", `"order_items" ("orderId")`],
  ["IDX_order_items_shopId", `"order_items" ("shopId")`],
  ["IDX_products_shopId", `"products" ("shopId")`],
  ["IDX_products_categoryId", `"products" ("categoryId")`],
  ["IDX_products_createdAt", `"products" ("createdAt")`],
  ["IDX_products_name_trgm", `"products" USING gin ("name" gin_trgm_ops)`],
  [
    "IDX_products_description_trgm",
    `"products" USING gin ("description" gin_trgm_ops)`,
  ],
  ["IDX_refresh_tokens_userId", `"refresh_tokens" ("userId")`],
  ["IDX_password_reset_tokens_userId", `"password_reset_tokens" ("userId")`],
  ["IDX_coupons_shopId", `"coupons" ("shopId")`],
  ["IDX_cart_items_productId", `"cart_items" ("productId")`],
];

export class AddIndexes1794080000000 implements MigrationInterface {
  name = "AddIndexes1794080000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(`CREATE INDEX "${name}" ON ${definition}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "${name}"`);
    }
  }
}
