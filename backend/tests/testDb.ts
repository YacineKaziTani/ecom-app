import { AppDataSource } from "../src/config/data-source";

// AppDataSource.initialize() throws if called twice on the same instance —
// guard so every test file can safely call this in its own beforeAll without
// caring whether another file already connected (Jest gives each test file
// its own module registry, so this module-level state isn't actually shared
// across files, but the guard is cheap and correct either way).
export async function initTestDb(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

export async function closeTestDb(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Wipes every table between tests so each test starts from a clean slate.
// TRUNCATE ... CASCADE handles FK dependencies without needing to order the
// table list manually; RESTART IDENTITY isn't strictly needed (everything
// uses uuid PKs, not serial), included for good measure in case that changes.
export async function clearDatabase(): Promise<void> {
  const tables = AppDataSource.entityMetadatas.map((m) => `"${m.tableName}"`).join(", ");
  if (!tables) return;
  await AppDataSource.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
