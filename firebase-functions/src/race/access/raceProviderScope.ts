/** Provider scope derived exclusively from an authenticated game-owned identity. */
export type RaceProviderScope = "facebook" | "reddit" | "android";
/** Identifies a validated provider namespace without trusting client-supplied scope. */
export function raceProviderScope(userId: string): RaceProviderScope | undefined {
  /** Provides match behavior. */
  const match = /^(facebook|reddit)_[a-f0-9]{40}$/.exec(userId);
  if (match?.[1] === "facebook" || match?.[1] === "reddit") return match[1];
  // Android keeps Firebase-generated identities; canonical profile validation is required at entry.
  return /^[A-Za-z0-9]{28}$/.test(userId) ? "android" : undefined;
}
