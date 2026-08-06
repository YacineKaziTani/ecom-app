import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usersApi } from "../../api/users";
import { UserRole } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import toast from "react-hot-toast";

const roleStyles: Record<UserRole, string> = {
  super_admin: "bg-amber-100 text-amber-700",
  admin: "bg-blue-100 text-blue-700",
  customer: "bg-gray-100 text-gray-700",
};

const roles: UserRole[] = ["customer", "admin", "super_admin"];

export default function UsersAdmin() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => usersApi.list(search || undefined),
    enabled: isSuperAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return (
      <p className="text-gray-500">Only super admins can manage user roles.</p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-foreground">Users</h1>
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full rounded-lg border border-border bg-card py-3 pl-9 pr-4 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : users?.length ? (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.firstName} {u.lastName}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => {
                          const role = e.target.value as UserRole;
                          if (
                            confirm(
                              `Change ${u.firstName} ${u.lastName}'s role to "${role}"?`,
                            )
                          ) {
                            updateRoleMutation.mutate({ id: u.id, role });
                          }
                        }}
                        className={`rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-accent ${roleStyles[u.role]} ${
                          isSelf
                            ? "cursor-not-allowed opacity-70"
                            : "cursor-pointer"
                        }`}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
