import pino from "pino";

const env = process.env.NODE_ENV;
const isDev = !env || env === "development";

function prettyTransport() {
  try {
    require.resolve("pino-pretty"); // dev dependency — absent in slim installs
    return {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    };
  } catch {
    return undefined;
  }
}

// JSON logs in production (one object per line — what log platforms expect),
// readable output in development, silent in tests unless LOG_LEVEL is set.
export const logger = pino({
  level: process.env.LOG_LEVEL || (env === "test" ? "silent" : "info"),
  // Never write session cookies or credentials to the logs.
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  transport: isDev ? prettyTransport() : undefined,
});
