import { AppDataSource } from "../src/config/data-source";
import { settleBackgroundTasks } from "../src/utils/background";

// AppDataSource.initialize() throws if called twice on the same instance —
// guard so every test file can safely call this in its own beforeAll without
// caring whether another file already connected (Jest gives each test file
// its own module registry, so this module-level state isn't actually shared
// across files, but the guard is cheap and correct either way).
export async function initTestDb(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  // Start from a clean slate too, not only between tests: the end-to-end
  // seed (or an interrupted run) may have left data and delivery prices behind.
  await clearDatabase();
}

export async function closeTestDb(): Promise<void> {
  await settleBackgroundTasks();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Wipes every table between tests so each test starts from a clean slate.
// TRUNCATE ... CASCADE handles FK dependencies without needing to order the
// table list manually; RESTART IDENTITY isn't strictly needed (everything
// uses uuid PKs, not serial), included for good measure in case that changes.
// Reference data seeded by migrations — reset instead of truncated.
const REFERENCE_TABLES = new Set(["shipping_zones"]);

export async function clearDatabase(): Promise<void> {
  // Let post-response work (emails, audit writes) finish first — truncating
  // underneath it can deadlock.
  await settleBackgroundTasks();
  const tables = AppDataSource.entityMetadatas
    .map((m) => m.tableName)
    .filter((t) => !REFERENCE_TABLES.has(t))
    .map((t) => `"${t}"`)
    .join(", ");
  if (tables) await AppDataSource.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  await AppDataSource.query(
    `UPDATE "shipping_zones" SET "homePrice" = 0, "deskPrice" = NULL, "isActive" = true`,
  );
}
