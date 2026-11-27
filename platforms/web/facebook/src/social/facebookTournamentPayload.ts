/** The SDK returns tournament data as JSON text, bounded to 1000 serialized characters. */
export function parseFacebookTournamentPayload(value: unknown): unknown {
  try {
    if (typeof value === "string") return value.length <= 1000 ? JSON.parse(value) : null;
    // Normalized adapters may already have parsed the same envelope.
    if (value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(value).length <= 1000) return value;
  } catch { /* Malformed or oversized native metadata cannot select an official tournament. */ }
  return null;
}
