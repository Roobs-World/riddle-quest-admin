/** Yahoo registration state derived from the active Firebase identity. */
export type YahooAuthState = "loading" | "guest" | "authenticated" | "failed";

/** Maps Firebase identity into the registration state shown by the shared game shell. */
export const getYahooAuthState = (
  user: Readonly<{isAnonymous: boolean}> | null,
): Exclude<YahooAuthState, "loading"> => user ? (user.isAnonymous ? "guest" : "authenticated") : "failed";
