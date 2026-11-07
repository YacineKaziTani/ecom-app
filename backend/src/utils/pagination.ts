import { clampInt } from "./validators";

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

// Reads ?page= & ?limit= from a query string, clamped to sane bounds.
export function parsePagination(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100,
): PageParams {
  const limit = clampInt(query.limit, defaultLimit, 1, maxLimit);
  const page = clampInt(query.page, 1, 1, 100_000);
  return { page, limit, skip: (page - 1) * limit };
}

// The response shape every paginated endpoint returns.
export function paginated<T>(
  items: T[],
  total: number,
  { page, limit }: PageParams,
) {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
