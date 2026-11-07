import { api } from "./client";
import { AuditLogEntry, Paginated } from "./types";

export const auditLogsApi = {
  list: (page: number, action?: string) =>
    api
      .get<Paginated<AuditLogEntry>>("/audit-logs", { params: { page, action: action || undefined } })
      .then((r) => r.data),
};
