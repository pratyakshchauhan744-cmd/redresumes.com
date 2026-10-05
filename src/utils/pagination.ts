export interface PaginationMeta {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function getPaginationMeta(page: number, total: number, pageSize: number): PaginationMeta {
  const normalizedTotal = Math.max(0, total);
  const normalizedPageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    page: safePage,
    totalPages,
    start: normalizedTotal === 0 ? 0 : (safePage - 1) * normalizedPageSize + 1,
    end: normalizedTotal === 0 ? 0 : Math.min(safePage * normalizedPageSize, normalizedTotal),
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
