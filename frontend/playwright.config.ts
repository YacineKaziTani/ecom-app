import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: the real backend (NODE_ENV=test, a disposable database
// seeded by `npm run e2e:seed` in ../backend) behind the Vite dev server.
//
//   DB_HOST=localhost DB_PORT=5432 npx playwright test
//
// Own ports, and never reusing a running server, so a dev backend pointed at
// a real database can't be picked up by mistake.
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5180);

const database = {
  DB_HOST: process.env.DB_HOST ?? "localhost",
  DB_PORT: process.env.DB_PORT ?? "5432",
  DB_USER: process.env.DB_USER ?? "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "postgres",
  DB_NAME: process.env.DB_NAME ?? "ecom_test",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // the tests share one database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm --prefix ../backend run e2e:server",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...database,
        NODE_ENV: "test",
        PORT: String(API_PORT),
        CLIENT_URL: `http://localhost:${WEB_PORT}`,
        // No outside services: emails, SMS and payments stay off.
        RESEND_API_KEY: "",
        SMS_PROVIDER: "",
        CHARGILY_API_KEY: "",
      },
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_PROXY: `http://localhost:${API_PORT}` },
    },
  ],
});
