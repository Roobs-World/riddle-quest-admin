/** Degrades only an intentional identity kill switch to isolated guest core play. */
export function normalizeIdentitySessionResult(result: {
  /** Stores payload. */
  payload: unknown; /** Stores status. */
  /** Stores status. */
  status: number;
}) {
  if (
    result.status === 503 &&
    typeof result.payload === "object" &&
    result.payload !== null &&
    (
      result.payload as {
        /** Stores error. */
        error?: unknown;
      }
    ).error === "reddit-feature-disabled:identity"
  ) {
    return {payload: {ok: true, authenticated: false, reason: "identity-disabled"}, status: 200};
  }
  return result;
}
