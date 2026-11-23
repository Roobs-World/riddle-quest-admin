/** Describes reddit environment. */
export type RedditEnvironment = "sandbox" | "production";

/** Adds only the server-configured environment to a bounded referral request. */
export function attachRedditReferralEnvironment(operation: string, payload: unknown, environment: unknown): unknown {
  if (operation !== "referral.issue" && operation !== "referral.bind") return payload;
  if (
    (environment !== "sandbox" && environment !== "production") ||
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new Error("referral-environment-not-configured");
  }
  /** Provides value behavior. */
  const value = payload as Record<string, unknown>;
  /** Provides expected keys behavior. */
  const expectedKeys = operation === "referral.issue" ? ["locale"] : ["locale", "token"];
  if (
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => !(key in value)) ||
    "environment" in value
  )
    throw new Error("invalid-reddit-referral-request");
  return {...value, environment};
}
