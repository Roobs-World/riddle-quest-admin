/** Yahoo registration state derived from the active Firebase identity. */
export type YahooAuthState = "loading" | "guest" | "authenticated" | "failed";

/** Minimal Firebase identity fact required to distinguish a Yahoo account from a guest. */
type YahooFirebaseIdentity = Readonly<{
  /** Whether Firebase created this temporary identity without Yahoo registration. */
  isAnonymous: boolean;
}>;

/** Maps Firebase identity into the registration state shown by the shared game shell. */
export const getYahooAuthState = (
  user: YahooFirebaseIdentity | null,
): Exclude<YahooAuthState, "loading"> => user ? (user.isAnonymous ? "guest" : "authenticated") : "failed";
