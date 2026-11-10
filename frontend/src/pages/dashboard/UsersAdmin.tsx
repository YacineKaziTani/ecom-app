import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Search, Users, ShieldAlert, X } from "lucide-react";
import { usersApi } from "../../api/users";
import { UserRole } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { roleBadge, formatDate } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

const roles: UserRole[] = ["customer", "admin", "super_admin"];

export default function UsersAdmin() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["users", debouncedSearch, page],
    queryFn: () => usersApi.list(debouncedSearch || undefined, page),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });
  const users = data?.items;

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(t("dash.users.roleUpdated"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("dash.restricted")}
        description={t("dash.users.restrictedBody")}
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.users.eyebrow")}
        title={t("dash.nav.users")}
        description={t("dash.users.description")}
      />

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("dash.users.searchPlaceholder")}
          aria-label={t("dash.users.search")}
          className="input ps-10 pe-10"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1
                       text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t("dash.users.clear")}
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
                <th>{t("dash.users.name")}</th>
                <th>{t("dash.users.email")}</th>
                <th>{t("dash.users.joined")}</th>
                <th>{t("dash.users.role")}</th>
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
                                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                                  {t("dash.users.you")}
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
                                  t("dash.users.confirmRole", { name: `${u.firstName} ${u.lastName}`, role: t(`role.${role}`) }),
                                )
                              ) {
                                updateRoleMutation.mutate({ id: u.id, role });
                              }
                            }}
                            aria-label={t("dash.users.roleFor", { name: `${u.firstName} ${u.lastName}` })}
                            className={cn(
                              "appearance-none rounded-full border-0 px-2.5 py-1 text-xs font-semibold",
                              "focus:outline-none focus:ring-2 focus:ring-ring/60",
                              roleBadge[u.role],
                              isSelf
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer transition-opacity hover:opacity-80",
                            )}
                          >
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {t(`role.${r}`)}
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
                        title={search ? t("dash.users.noMatchTitle") : t("dash.users.emptyTitle")}
                        description={
                          search
                            ? t("dash.users.noMatchBody", { search })
                            : t("dash.users.emptyBody")
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

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
