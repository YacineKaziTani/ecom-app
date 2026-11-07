// Error reporting is opt-in: the Sentry SDK is only downloaded (as a separate
// chunk) when VITE_SENTRY_DSN is set at build time, so it costs nothing otherwise.
const dsn = import.meta.env.VITE_SENTRY_DSN;

let sentry: Promise<typeof import("@sentry/react")> | null = null;

export function initMonitoring() {
  if (!dsn) return;
  sentry = import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Keep customer data (cookies, form bodies, addresses) out of reports.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: 0,
    });
    return Sentry;
  });
}

export function reportError(error: unknown, extra?: Record<string, unknown>) {
  console.error(error);
  void sentry?.then((Sentry) => Sentry.captureException(error, { extra }));
}
