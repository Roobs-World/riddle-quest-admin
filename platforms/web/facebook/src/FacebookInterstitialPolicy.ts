/** Defines the interstitial interval ms value. */
const INTERSTITIAL_INTERVAL_MS = 90_000;
/** Defines the rewarded suppression ms value. */
const REWARDED_SUPPRESSION_MS = 90_000;
/** Defines the session cap value. */
const SESSION_CAP = 10;

/** Describes facebook interstitial state. */
export type FacebookInterstitialState = Readonly<{
  /** Stores shown this session. */
  shownThisSession: number;
  /** Stores last interstitial at ms. */
  lastInterstitialAtMs?: number;
  /** Stores last rewarded at ms. */
  lastRewardedAtMs?: number;
  /** Stores ad free. */
  adFree: boolean;
}>;

/** Creates facebook interstitial state. */
export const createFacebookInterstitialState = (adFree = false): FacebookInterstitialState => ({
  shownThisSession: 0,
  adFree,
});

/** Allows Facebook interstitials only at post-game results and within every frequency guard. */
export function canShowFacebookInterstitial(
  state: FacebookInterstitialState,
  placement: "startup" | "active_play" | "result",
  nowMs: number,
): boolean {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return false;
  if (placement !== "result" || state.adFree || state.shownThisSession >= SESSION_CAP) return false;
  if (state.lastInterstitialAtMs !== undefined && nowMs - state.lastInterstitialAtMs < INTERSTITIAL_INTERVAL_MS) {
    return false;
  }
  return state.lastRewardedAtMs === undefined || nowMs - state.lastRewardedAtMs >= REWARDED_SUPPRESSION_MS;
}

/** Records only a successfully displayed interstitial. */
export function recordFacebookInterstitialShown(
  state: FacebookInterstitialState,
  nowMs: number,
): FacebookInterstitialState {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error("facebook-interstitial-time-invalid");
  return {...state, shownThisSession: state.shownThisSession + 1, lastInterstitialAtMs: nowMs};
}

/** Starts the post-rewarded-video suppression interval. */
export function recordFacebookRewardedShown(
  state: FacebookInterstitialState,
  nowMs: number,
): FacebookInterstitialState {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error("facebook-rewarded-time-invalid");
  return {...state, lastRewardedAtMs: nowMs};
}
