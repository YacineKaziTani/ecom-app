import { api } from "./client";
import { User } from "./types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  firstName: string;
  lastName: string;
}

// Accounts with two-factor sign-in get a challenge instead of a session.
export type LoginResult = { user: User } | { twoFactorRequired: true; challenge: string };

export const authApi = {
  login: (data: LoginInput) => api.post<LoginResult>("/auth/login", data).then((r) => r.data),
  loginSecondStep: (challenge: string, code: string) =>
    api.post<{ user: User }>("/auth/login/2fa", { challenge, code }).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.post<{ message: string }>("/auth/verify-email", { token }).then((r) => r.data),
  resendVerification: () =>
    api.post<{ message: string }>("/auth/resend-verification").then((r) => r.data),
  register: (data: RegisterInput) => api.post<{ user: User }>("/auth/register", data).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get<{ user: User }>("/auth/me").then((r) => r.data),
  updateProfile: (data: Partial<User>) => api.patch<{ user: User }>("/auth/me", data).then((r) => r.data),
  forgotPassword: (email: string) => api.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, newPassword }).then((r) => r.data),
};
