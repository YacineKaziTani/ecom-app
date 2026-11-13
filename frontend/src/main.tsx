import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { ThemeProvider } from "./store/ThemeContext";
import { I18nProvider } from "./i18n/I18nProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initMonitoring } from "./lib/monitoring";
import "./index.css";

initMonitoring();

// After a new deploy, an already-open tab still references the previous
// build's route chunks, which no longer exist. Reload once to pick up the new
// build (guarded so a genuinely broken deploy can't cause a reload loop — the
// error boundary takes over instead).
window.addEventListener("vite:preloadError", (event) => {
  try {
    const key = "chunk-reload-at";
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      event.preventDefault();
      window.location.reload();
    }
  } catch {
    // storage unavailable — let the error surface normally
  }
});

// Installable app + offline shell (the API's /seo/manifest.webmanifest, sw.js). Only
// in production builds: in dev the worker would serve stale modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker not registered", err));
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <I18nProvider>
            <AuthProvider>
              <App />
              <Toaster
                position="top-right"
                gutter={10}
                toastOptions={{
                  duration: 3500,
                  // Toasts follow the active theme instead of shipping their own palette.
                  style: {
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--elevation-lg)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    padding: "0.75rem 1rem",
                    maxWidth: "26rem",
                  },
                  success: { iconTheme: { primary: "var(--success)", secondary: "var(--card)" } },
                  error: { iconTheme: { primary: "var(--destructive)", secondary: "var(--card)" } },
                }}
              />
            </AuthProvider>
            </I18nProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
