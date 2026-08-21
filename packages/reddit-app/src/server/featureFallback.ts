/** Degrades only an intentional identity kill switch to isolated guest core play. */
export function normalizeIdentitySessionResult(result: {payload: unknown; status: number}) {
  if (result.status === 503 && typeof result.payload === "object" && result.payload !== null &&
    (result.payload as {error?: unknown}).error === "reddit-feature-disabled:identity") {
    return {payload: {ok: true, authenticated: false, reason: "identity-disabled"}, status: 200};
  }
  return result;
}
