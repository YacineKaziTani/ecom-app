import { api } from "./client";

export const twoFactorApi = {
  setup: () =>
    api
      .post<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/auth/2fa/setup")
      .then((r) => r.data),
  enable: (code: string) =>
    api.post<{ recoveryCodes: string[] }>("/auth/2fa/enable", { code }).then((r) => r.data),
  disable: (code: string) => api.post("/auth/2fa/disable", { code }).then((r) => r.data),
};
