import axios, { AxiosRequestConfig } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

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

// Lets the auth layer react when a refresh fails (session revoked or expired),
// so the UI stops treating the visitor as signed in.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

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
    const isAuthLifecycleEndpoint =
      /\/auth\/(refresh|login|register|logout)$/.test(url);

    if (
      status === 401 &&
      !isAuthLifecycleEndpoint &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        await refreshAccessToken();
      } catch {
        onSessionExpired?.();
        return Promise.reject(
          new ApiError("Your session has expired — please sign in again"),
        );
      }
      return api(originalRequest);
    }

    const message =
      error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject(new ApiError(message, error.response?.data));
  },
);
