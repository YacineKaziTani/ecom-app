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

export const authApi = {
  login: (data: LoginInput) => api.post<{ user: User }>("/auth/login", data).then((r) => r.data),
  register: (data: RegisterInput) => api.post<{ user: User }>("/auth/register", data).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get<{ user: User }>("/auth/me").then((r) => r.data),
  updateProfile: (data: Partial<User>) => api.patch<{ user: User }>("/auth/me", data).then((r) => r.data),
  refresh: () => api.post("/auth/refresh").then((r) => r.data),
  forgotPassword: (email: string) => api.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, newPassword }).then((r) => r.data),
};
