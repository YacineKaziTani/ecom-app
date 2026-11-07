import { api } from "./client";
import { Paginated, User, UserRole } from "./types";

export const usersApi = {
  list: (search: string | undefined, page: number) =>
    api
      .get<Paginated<User>>("/auth/users", { params: { search, page, limit: 20 } })
      .then((r) => r.data),
  updateRole: (id: string, role: UserRole) =>
    api.patch<{ user: User }>(`/auth/${id}/role`, { role }).then((r) => r.data.user),
};
