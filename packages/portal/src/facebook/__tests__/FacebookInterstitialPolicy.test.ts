import {describe, expect, test} from "@jest/globals";
import {
  canShowFacebookInterstitial,
  createFacebookInterstitialState,
  recordFacebookInterstitialShown,
  recordFacebookRewardedShown,
} from "../FacebookInterstitialPolicy";

describe("Facebook interstitial policy", () => {
  test("never allows startup, active-play, or ad-free impressions", () => {
    /** Provides state behavior. */
    const state = createFacebookInterstitialState();
    expect(canShowFacebookInterstitial(state, "startup", 1_000_000)).toBe(false);
    expect(canShowFacebookInterstitial(state, "active_play", 1_000_000)).toBe(false);
    expect(canShowFacebookInterstitial(createFacebookInterstitialState(true), "result", 1_000_000)).toBe(false);
    expect(canShowFacebookInterstitial(state, "result", Number.NaN)).toBe(false);
    expect(canShowFacebookInterstitial(state, "result", -1)).toBe(false);
  });

  test("requires 90 seconds between successful result-screen impressions", () => {
    /** Provides shown behavior. */
    const shown = recordFacebookInterstitialShown(createFacebookInterstitialState(), 1_000_000);
    expect(canShowFacebookInterstitial(shown, "result", 1_089_999)).toBe(false);
    expect(canShowFacebookInterstitial(shown, "result", 1_090_000)).toBe(true);
  });

  test("suppresses interstitials for 90 seconds after rewarded video", () => {
    /** Provides rewarded behavior. */
    const rewarded = recordFacebookRewardedShown(createFacebookInterstitialState(), 1_000_000);
    expect(canShowFacebookInterstitial(rewarded, "result", 1_089_999)).toBe(false);
    expect(canShowFacebookInterstitial(rewarded, "result", 1_090_000)).toBe(true);
  });

  test("caps a session after ten successful impressions", () => {
    /** Provides state behavior. */
    let state = createFacebookInterstitialState();
    for (let index = 0; index < 10; index += 1) {
      /** Provides now behavior. */
      const now = 1_000_000 + index * 90_000;
      expect(canShowFacebookInterstitial(state, "result", now)).toBe(true);
      state = recordFacebookInterstitialShown(state, now);
    }
    expect(canShowFacebookInterstitial(state, "result", 2_000_000)).toBe(false);
  });
});
