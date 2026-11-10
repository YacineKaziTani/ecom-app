import { execSync } from "node:child_process";

// Resets the test database to the fixtures in backend/src/seed/e2eFixtures.ts
// (and applies pending migrations) before the run.
export default function globalSetup() {
  execSync("npm --prefix ../backend run e2e:seed", {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });
}
