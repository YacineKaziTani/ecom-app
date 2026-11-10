/**
 * Resets a DISPOSABLE test database to a known state for the Playwright
 * end-to-end tests (frontend/e2e): one shop with a plain product and a
 * product with size options. Wipes every table first.
 *
 *   NODE_ENV=test DB_HOST=… DB_PORT=… npm run e2e:seed
 *
 * Refuses to run unless NODE_ENV=test, which also means config/data-source.ts
 * ignores DATABASE_URL — so it can never touch the production database.
 */
import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV !== "test") {
  console.error("Refusing to run: the e2e fixtures wipe the database. Use NODE_ENV=test with a disposable database.");
  process.exit(1);
}
// Explicit env vars (CI, the Playwright config) win over the file.
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

export const E2E_FIXTURES = {
  password: "Password123",
  accounts: {
    shopAdmin: "owner-e2e@example.com",
    superAdmin: "admin-e2e@example.com",
    customer: "customer-e2e@example.com",
  },
  shopName: "Atelier E2E",
  plainProduct: { name: "Tajine E2E", price: 3500, stock: 5 },
  variantProduct: {
    name: "Robe E2E",
    price: 6000,
    variants: [
      { name: "S", stock: 2 },
      { name: "M", stock: 3, price: 6500 },
    ],
  },
} as const;

async function main() {
  // Imported after dotenv so the data source sees the test settings.
  const { AppDataSource } = await import("../config/data-source");
  const { User } = await import("../entities/User");
  const { Shop } = await import("../entities/Shop");
  const { Product } = await import("../entities/Product");
  const { ProductVariant } = await import("../entities/ProductVariant");

  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const tables = AppDataSource.entityMetadatas
    .map((m) => m.tableName)
    .filter((t) => t !== "shipping_zones")
    .map((t) => `"${t}"`)
    .join(", ");
  await AppDataSource.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  await AppDataSource.query(`UPDATE "shipping_zones" SET "homePrice" = 400, "deskPrice" = 250, "isActive" = true`);

  // One account per role; every password is E2E_FIXTURES.password.
  const password = await bcrypt.hash(E2E_FIXTURES.password, 10);
  const account = (email: string, role: "customer" | "admin" | "super_admin", firstName: string) =>
    AppDataSource.getRepository(User).save({ email, password, firstName, lastName: "E2E", role, emailVerifiedAt: new Date() });
  const owner = await account(E2E_FIXTURES.accounts.shopAdmin, "admin", "Samia");
  await account(E2E_FIXTURES.accounts.superAdmin, "super_admin", "Karim");
  await account(E2E_FIXTURES.accounts.customer, "customer", "Amina");
  const shop = await AppDataSource.getRepository(Shop).save({
    name: E2E_FIXTURES.shopName,
    slug: "atelier-e2e",
    ownerId: owner.id,
  });

  const { plainProduct, variantProduct } = E2E_FIXTURES;
  await AppDataSource.getRepository(Product).save({ ...plainProduct, shopId: shop.id });
  const robe = await AppDataSource.getRepository(Product).save({
    name: variantProduct.name,
    price: variantProduct.price,
    stock: variantProduct.variants.reduce((sum, v) => sum + v.stock, 0),
    shopId: shop.id,
  });
  await AppDataSource.getRepository(ProductVariant).save(
    variantProduct.variants.map((v, position) => ({ ...v, productId: robe.id, position })),
  );

  await AppDataSource.destroy();
  console.log("e2e fixtures ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
