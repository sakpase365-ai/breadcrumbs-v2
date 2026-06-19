type DbError = { message?: string } | null;

export type QueryResult<T = unknown> = {
  data: T | null;
  error: DbError;
  count?: number | null;
};

export type LooseQuery<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: (columns?: string, options?: Record<string, unknown>) => LooseQuery<T>;
  eq: (column: string, value: unknown) => LooseQuery<T>;
  order: (column: string, options?: Record<string, unknown>) => LooseQuery<T>;
  insert: (values: unknown) => LooseQuery<T>;
  update: (values: unknown) => LooseQuery<T>;
  upsert: (values: unknown, options?: Record<string, unknown>) => LooseQuery<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
  single: () => Promise<QueryResult<T>>;
};

export type LooseSupabase = {
  from: <T = unknown>(table: string) => LooseQuery<T>;
};
