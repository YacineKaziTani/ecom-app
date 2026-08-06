import axios, { AxiosRequestConfig } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Carries the server's message plus any structured extras (e.g. stock-out `issues`)
// while still working with existing `toast.error(String(err))` call sites, since
// toString() is overridden to just return the message (no "Error: " prefix).
export class ApiError extends Error {
  data?: any;
  constructor(message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.data = data;
  }
  toString() {
    return this.message;
  }
}

interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// Access tokens are short-lived (15m) by design — this is what makes that
// invisible to the user. A single in-flight refresh call is shared across any
// number of requests that 401 at the same moment, so a page that fires five
// queries at once after the token expires triggers exactly one refresh, not five.
let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const url: string = originalRequest?.url || "";
    // Never try to refresh in response to the refresh/login/register/logout
    // calls themselves — that would either loop or refresh a session that was
    // never meant to exist yet (e.g. a failed login attempt).
    const isAuthLifecycleEndpoint = /\/auth\/(refresh|login|register|logout)$/.test(url);

    if (status === 401 && !isAuthLifecycleEndpoint && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshAccessToken();
        return api(originalRequest); // replay the original request now that the access token cookie is fresh
      } catch {
        // Refresh token is invalid/expired too — the session is genuinely over.
        // Fall through to normal error handling below (surfaces as a 401 to the caller).
      }
    }

    const message = error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject(new ApiError(message, error.response?.data));
  }
);
