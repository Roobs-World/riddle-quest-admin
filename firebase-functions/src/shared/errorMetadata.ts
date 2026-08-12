/** Cloud-log-safe metadata that never includes exception messages or payloads. */
export type SafeErrorMetadata = {
  /** Bounded exception class without its message. */
  errorClass: string;
  /** Optional bounded provider or transport code. */
  code?: string;
  /** Optional valid HTTP status. */
  status?: number;
};

/** Accepts only a short identifier-like metadata token. */
const boundedToken = (value: unknown): string | undefined =>
  typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : undefined;

/** Extracts only bounded classification fields from an unknown exception. */
export function getSafeErrorMetadata(error: unknown): SafeErrorMetadata {
  if (typeof error !== "object" || error === null) return {errorClass: typeof error};
  const record = error as Record<string, unknown>;
  const errorClass = boundedToken(error instanceof Error ? error.name : undefined) ?? "Error";
  const code = boundedToken(record.code);
  const status = typeof record.status === "number" && Number.isInteger(record.status) &&
    record.status >= 100 && record.status <= 599
    ? record.status
    : undefined;
  return {errorClass, ...(code ? {code} : {}), ...(status ? {status} : {})};
}
