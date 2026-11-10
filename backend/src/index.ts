import path from "path";
import dotenv from "dotenv";
// NODE_ENV=test (Jest, the Playwright end-to-end run) reads only .env.test, so
// real credentials in a local .env (database, email, payments) can't leak in.
dotenv.config({
  path: path.resolve(__dirname, "..", process.env.NODE_ENV === "test" ? ".env.test" : ".env"),
});

import { initSentry, Sentry } from "./config/sentry";
initSentry();

import { app } from "./app";
import { AppDataSource } from "./config/data-source";
import { checkEnvironment } from "./config/env";
import { logger } from "./config/logger";
import { verifyMailer } from "./config/mailer";
import { startReservationExpiryJob } from "./services/orderLifecycle";
import { settleBackgroundTasks } from "./utils/background";

const PORT = Number(process.env.PORT) || 4000;
const isProd = process.env.NODE_ENV === "production";

// Pending migrations run on boot in production so a deploy can't ship code
// ahead of its schema. RUN_MIGRATIONS=false opts out (e.g. if you run them
// from a separate release step instead).
const runMigrationsOnBoot =
  (process.env.RUN_MIGRATIONS ?? (isProd ? "true" : "false")) === "true";

async function main() {
  const { errors, warnings } = checkEnvironment();
  warnings.forEach((w) => logger.warn(w));
  if (errors.length > 0) {
    errors.forEach((e) => logger.fatal(e));
    throw new Error("Invalid configuration — see the errors above");
  }

  await AppDataSource.initialize();
  logger.info("Database connected");

  if (runMigrationsOnBoot) {
    const applied = await AppDataSource.runMigrations({ transaction: "all" });
    if (applied.length > 0)
      logger.info({ migrations: applied.map((m) => m.name) }, "Applied migrations");
  }

  verifyMailer();
  const stopExpiryJob = startReservationExpiryJob();

  const server = app.listen(PORT, () =>
    logger.info(`Server listening on port ${PORT}`),
  );

  // On deploy/restart the platform sends SIGTERM: stop taking new connections,
  // let in-flight requests (e.g. a checkout transaction) finish, then close the
  // DB pool. Forced exit after 10s so a stuck request can't block a deploy.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    stopExpiryJob();
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000).unref();
    server.close(async () => {
      await settleBackgroundTasks(); // pending emails / audit writes
      await AppDataSource.destroy().catch(() => {});
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch(async (err) => {
  logger.fatal({ err }, "Failed to start server");
  Sentry.captureException(err);
  await Sentry.flush(2000);
  process.exit(1);
});
