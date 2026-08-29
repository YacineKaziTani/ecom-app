import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users, ShieldAlert, X } from "lucide-react";
import { usersApi } from "../../api/users";
import { UserRole } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { roleBadge, formatDate } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

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
      <EmptyState
        icon={ShieldAlert}
        title="Restricted area"
        description="Only super admins can view and manage user roles."
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Access control"
        title="Users"
        description="Search accounts and manage what each person can do."
      />

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="input pl-10 pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1
                       text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : (
              <tbody>
                {users?.length ? (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold uppercase text-brand-700 dark:text-accent">
                              {u.firstName?.[0]}
                              {u.lastName?.[0]}
                            </span>
                            <span className="font-medium text-foreground">
                              {u.firstName} {u.lastName}
                              {isSelf && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">{u.email}</td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </td>
                        <td>
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => {
                              const role = e.target.value as UserRole;
                              if (
                                confirm(
                                  `Change ${u.firstName} ${u.lastName}'s role to "${role.replace("_", " ")}"?`,
                                )
                              ) {
                                updateRoleMutation.mutate({ id: u.id, role });
                              }
                            }}
                            aria-label={`Role for ${u.firstName} ${u.lastName}`}
                            className={cn(
                              "appearance-none rounded-full border-0 px-2.5 py-1 text-xs font-semibold capitalize",
                              "focus:outline-none focus:ring-2 focus:ring-ring/60",
                              roleBadge[u.role],
                              isSelf
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer transition-opacity hover:opacity-80",
                            )}
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
                    <td colSpan={4} className="p-0">
                      <EmptyState
                        icon={Users}
                        title={search ? "No matching users" : "No users yet"}
                        description={
                          search
                            ? `Nothing matched “${search}”. Try a different name or email.`
                            : "Accounts will appear here once people sign up."
                        }
                        className="rounded-none border-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
