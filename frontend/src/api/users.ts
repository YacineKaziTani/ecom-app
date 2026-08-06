import { api } from "./client";
import { User, UserRole } from "./types";

export const usersApi = {
  list: (search?: string) => api.get<User[]>("/auth/users", { params: { search } }).then((r) => r.data),
  updateRole: (id: string, role: UserRole) =>
    api.patch<{ user: User }>(`/auth/${id}/role`, { role }).then((r) => r.data.user),
};
