/**
 * Bootstraps the first super_admin. Run once after your first migration:
 *   npx ts-node src/seed/createSuperAdmin.ts you@example.com yourPassword123
 */
import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";

async function main() {
  const [, , rawEmail, password, firstName = "Super", lastName = "Admin"] = process.argv;
  // Login lowercases the email, so store it the same way or the account can't sign in.
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !password) {
    console.error("Usage: npx ts-node src/seed/createSuperAdmin.ts <email> <password> [firstName] [lastName]");
    process.exit(1);
  }

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    existing.role = "super_admin";
    await repo.save(existing);
    console.log(`Existing user ${email} promoted to super_admin.`);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    const user = repo.create({ email, password: hashed, firstName, lastName, role: "super_admin" });
    await repo.save(user);
    console.log(`Created super_admin ${email}.`);
  }

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
