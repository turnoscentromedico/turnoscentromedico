import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginationArgs(query: PaginationQuery) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

/**
 * Build a Prisma `orderBy` from sortBy/sortOrder params.
 * Supports nested fields via dot notation (e.g. "patient.lastName").
 * Falls back to `defaultOrderBy` when no sortBy is provided.
 */
export function buildOrderBy(
  query: PaginationQuery,
  allowedFields: string[],
  defaultOrderBy: Record<string, string>,
): Record<string, unknown> | Record<string, unknown>[] {
  if (!query.sortBy || !allowedFields.includes(query.sortBy)) {
    return defaultOrderBy;
  }

  const parts = query.sortBy.split(".");
  if (parts.length === 1) {
    return { [parts[0]]: query.sortOrder };
  }

  // Nested: "patient.lastName" → { patient: { lastName: "asc" } }
  let obj: Record<string, unknown> = { [parts[parts.length - 1]]: query.sortOrder };
  for (let i = parts.length - 2; i >= 0; i--) {
    obj = { [parts[i]]: obj };
  }
  return obj;
}
