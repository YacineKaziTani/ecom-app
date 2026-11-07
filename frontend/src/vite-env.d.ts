/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: enables Sentry error reporting in the browser. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
