import {describe, expect, test} from "@jest/globals";
import {
  recordFacebookNotificationPrompt,
  shouldPromptForFacebookNotifications,
} from "../FacebookNotificationPromptPolicy";

/** Defines the week ms value. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

describe("Facebook notification prompt policy", () => {
  test("waits for an authoritative win and a supported capability", () => {
    /** Provides state behavior. */
    const state = {permission: "unknown" as const};
    expect(
      shouldPromptForFacebookNotifications({authoritativeWins: 0, capabilityAvailable: true, state, nowMs: 1}),
    ).toBe(false);
    expect(
      shouldPromptForFacebookNotifications({authoritativeWins: 1, capabilityAvailable: false, state, nowMs: 1}),
    ).toBe(false);
    expect(
      shouldPromptForFacebookNotifications({authoritativeWins: 1, capabilityAvailable: true, state, nowMs: 1}),
    ).toBe(true);
  });

  test("retries declined prompts no more than weekly", () => {
    /** Provides state behavior. */
    const state = recordFacebookNotificationPrompt({permission: "unknown"}, "declined", 1_000_000);
    expect(
      shouldPromptForFacebookNotifications({
        authoritativeWins: 3,
        capabilityAvailable: true,
        state,
        nowMs: 1_000_000 + WEEK_MS - 1,
      }),
    ).toBe(false);
    expect(
      shouldPromptForFacebookNotifications({
        authoritativeWins: 3,
        capabilityAvailable: true,
        state,
        nowMs: 1_000_000 + WEEK_MS,
      }),
    ).toBe(true);
  });

  test("never prompts again after acceptance", () => {
    /** Provides state behavior. */
    const state = recordFacebookNotificationPrompt({permission: "unknown"}, "accepted", 1_000_000);
    expect(
      shouldPromptForFacebookNotifications({
        authoritativeWins: 99,
        capabilityAvailable: true,
        state,
        nowMs: 1_000_000 + WEEK_MS * 20,
      }),
    ).toBe(false);
  });

  test("fails closed for malformed counters and clocks", () => {
    /** Provides state behavior. */
    const state = {permission: "unknown" as const};
    for (const authoritativeWins of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5]) {
      expect(
        shouldPromptForFacebookNotifications({
          authoritativeWins,
          capabilityAvailable: true,
          state,
          nowMs: 1,
        }),
      ).toBe(false);
    }
    for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5]) {
      expect(
        shouldPromptForFacebookNotifications({
          authoritativeWins: 1,
          capabilityAvailable: true,
          state,
          nowMs,
        }),
      ).toBe(false);
    }
    expect(
      shouldPromptForFacebookNotifications({
        authoritativeWins: 1,
        capabilityAvailable: true,
        state: {permission: "declined", lastPromptAtMs: Number.NaN},
        nowMs: WEEK_MS,
      }),
    ).toBe(false);
    expect(() => recordFacebookNotificationPrompt(state, "declined", -1)).toThrow(
      "facebook-notification-prompt-time-invalid",
    );
  });
});
