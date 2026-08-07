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
        return api(originalRequest);
      } catch {}
    }

    const message =
      error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject(new ApiError(message, error.response?.data));
  },
);
