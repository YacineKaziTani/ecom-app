import * as Sentry from "@sentry/node";

// Error tracking is opt-in: without SENTRY_DSN nothing is initialised and
// captureException() calls are no-ops. Only unexpected (5xx) errors are sent.
export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.RENDER_GIT_COMMIT, // set automatically on Render
    // The SDK collects cookies, headers and bodies by default — those carry
    // session tokens, passwords (login/reset) and customer addresses here.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
  });
}

export { Sentry };
