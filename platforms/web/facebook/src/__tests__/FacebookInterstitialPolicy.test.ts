import {describe, expect, test} from "@jest/globals";
import {
  canShowFacebookInterstitial,
  createFacebookInterstitialState,
  getFacebookInterstitialSuppressionReason,
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

  test("reports the first applicable suppression reason without changing admission", () => {
    const allGuards = {adFree: true, shownThisSession: 10,
      lastInterstitialAtMs: 1_000_000, lastRewardedAtMs: 1_000_000};
    const cases = [
      {state: allGuards, placement: "startup", now: Number.NaN, reason: "clock-invalid", allowed: false},
      {state: allGuards, placement: "startup", now: 1_000_000, reason: "wrong-placement", allowed: false},
      {state: allGuards, placement: "active_play", now: 1_000_000, reason: "wrong-placement", allowed: false},
      {state: allGuards, placement: "result", now: 1_000_000, reason: "ad-free-gate", allowed: false},
      {state: {...allGuards, adFree: false}, placement: "result", now: 1_000_000, reason: "session-cap", allowed: false},
      {state: {...allGuards, adFree: false, shownThisSession: 0}, placement: "result", now: 1_000_000,
        reason: "interstitial-cooldown", allowed: false},
      {state: {...allGuards, adFree: false, shownThisSession: 0, lastInterstitialAtMs: 910_000},
        placement: "result", now: 1_000_000, reason: "rewarded-cooldown", allowed: false},
      {state: {...allGuards, adFree: false, shownThisSession: 0, lastInterstitialAtMs: 910_000,
        lastRewardedAtMs: 910_000}, placement: "result", now: 1_000_000, reason: undefined, allowed: true},
    ] as const;
    for (const {state, placement, now, reason, allowed} of cases) {
      expect(canShowFacebookInterstitial(state, placement, now)).toBe(allowed);
      expect(getFacebookInterstitialSuppressionReason(state, placement, now)).toBe(reason);
    }
  });

  test.each([
    {name: "negative clock", change: {}, now: -1, reason: "clock-invalid", allowed: false},
    {name: "fractional clock", change: {}, now: 1_000_000.5, reason: "clock-invalid", allowed: false},
    {name: "infinite clock", change: {}, now: Infinity, reason: "clock-invalid", allowed: false},
    {name: "unsafe clock", change: {}, now: Number.MAX_SAFE_INTEGER + 1, reason: "clock-invalid", allowed: false},
    {name: "maximum safe clock", change: {}, now: Number.MAX_SAFE_INTEGER, reason: undefined, allowed: true},
    {name: "negative zero clock", change: {}, now: -0, reason: undefined, allowed: true},
    {name: "NaN session count", change: {shownThisSession: Number.NaN}, now: 1_000_000, reason: undefined, allowed: true},
    {name: "infinite session count", change: {shownThisSession: Infinity}, now: 1_000_000, reason: "session-cap", allowed: false},
    {name: "NaN interstitial time", change: {lastInterstitialAtMs: Number.NaN}, now: 1_000_000, reason: undefined, allowed: true},
    {name: "NaN rewarded time", change: {lastRewardedAtMs: Number.NaN}, now: 1_000_000, reason: "rewarded-cooldown", allowed: false},
    {name: "future interstitial time", change: {lastInterstitialAtMs: 1_000_001}, now: 1_000_000, reason: "interstitial-cooldown", allowed: false},
    {name: "future rewarded time", change: {lastRewardedAtMs: 1_000_001}, now: 1_000_000, reason: "rewarded-cooldown", allowed: false},
    {name: "infinite interstitial time", change: {lastInterstitialAtMs: Infinity}, now: 1_000_000, reason: "interstitial-cooldown", allowed: false},
    {name: "infinite rewarded time", change: {lastRewardedAtMs: Infinity}, now: 1_000_000, reason: "rewarded-cooldown", allowed: false},
    {name: "negative infinite interstitial time", change: {lastInterstitialAtMs: -Infinity}, now: 1_000_000, reason: undefined, allowed: true},
    {name: "negative infinite rewarded time", change: {lastRewardedAtMs: -Infinity}, now: 1_000_000, reason: undefined, allowed: true},
    {name: "fractional interstitial boundary", change: {lastInterstitialAtMs: 1_000_000.5}, now: 1_090_000, reason: "interstitial-cooldown", allowed: false},
    {name: "fractional rewarded boundary", change: {lastRewardedAtMs: 1_000_000.5}, now: 1_090_000, reason: "rewarded-cooldown", allowed: false},
    {name: "interstitial boundary reached", change: {lastInterstitialAtMs: 1_000_000}, now: 1_090_000, reason: undefined, allowed: true},
    {name: "rewarded boundary reached", change: {lastRewardedAtMs: 1_000_000}, now: 1_090_000, reason: undefined, allowed: true},
  ])("preserves existing numeric behavior: $name", ({change, now, reason, allowed}) => {
    const state = {...createFacebookInterstitialState(), ...change};
    expect(canShowFacebookInterstitial(state, "result", now)).toBe(allowed);
    expect(getFacebookInterstitialSuppressionReason(state, "result", now)).toBe(reason);
  });
});
