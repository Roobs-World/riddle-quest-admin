import {
  FACEBOOK_CONTEXT_BOARD_DURATION_MS,
  createFacebookContextCompetition,
  facebookContextKey,
  facebookOfflineMatchTag,
  updateFacebookContextCompetition,
} from "../../race/facebookContextCompetition";

const START = Date.UTC(2026, 7, 19);
const A = `facebook_${"a".repeat(40)}`;
const B = `facebook_${"b".repeat(40)}`;

describe("Facebook context competition", () => {
  it("creates exact locale tags and hashes the raw Meta context ID", () => {
    expect(facebookOfflineMatchTag("ja")).toBe("race10_v1:ja");
    expect(facebookOfflineMatchTag("fr")).not.toBe(facebookOfflineMatchTag("ja"));
    const key = facebookContextKey("123456789:THREAD");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("123456789");
  });

  it("creates a seven-day board without Meta names or photos", () => {
    const context = createFacebookContextCompetition({
      contextId: "context-1",
      contextType: "GROUP",
      locale: "ar",
      userId: A,
      nowMs: START,
    });
    expect(context).toMatchObject({hostUserId: A, locale: "ar", expiresAtMs: START + 7 * 86_400_000});
    expect(FACEBOOK_CONTEXT_BOARD_DURATION_MS).toBe(7 * 86_400_000);
    expect(JSON.stringify(context)).not.toMatch(/name|photo|avatar/i);
    expect(() => createFacebookContextCompetition({
      contextId: "context-1", contextType: "GROUP", locale: "ar", userId: A, nowMs: Number.NaN,
    })).toThrow("context time is invalid");
    expect(() => createFacebookContextCompetition({
      contextId: "context-1", contextType: "GROUP", locale: "ar", userId: A,
      nowMs: 253_402_300_799_999,
    })).toThrow("context time is invalid");
    expect(() => createFacebookContextCompetition({
      contextId: "context-1", contextType: "GROUP", locale: "ar", userId: "facebook_invalid", nowMs: START,
    })).toThrow("Facebook identity is required");
  });

  it("elects the same host regardless of concurrent join ordering", () => {
    const initial = createFacebookContextCompetition({
      contextId: "context-1", contextType: "THREAD", locale: "ja", userId: B, nowMs: START,
    });
    const first = updateFacebookContextCompetition(initial, {kind: "join", userId: A, locale: "ja", nowMs: START});
    expect(first.hostUserId).toBe(A);
    const retry = updateFacebookContextCompetition(first, {kind: "join", userId: A, locale: "ja", nowMs: START});
    expect(retry.members).toHaveLength(2);
    expect(retry.hostUserId).toBe(A);
  });

  it("rejects cross-locale, pre-creation, and expired actions", () => {
    const context = createFacebookContextCompetition({
      contextId: "context-1", contextType: "THREAD", locale: "ja", userId: A, nowMs: START,
    });
    expect(() => updateFacebookContextCompetition(
      context, {kind: "join", userId: B, locale: "fr", nowMs: START + 1},
    )).toThrow("locale does not match");
    expect(() => updateFacebookContextCompetition(
      context, {kind: "join", userId: B, locale: "ja", nowMs: context.expiresAtMs},
    )).toThrow("has expired");
    expect(() => updateFacebookContextCompetition(
      context, {kind: "join", userId: B, locale: "ja", nowMs: Number.NaN},
    )).toThrow("context time is invalid");
    expect(() => updateFacebookContextCompetition(
      context, {kind: "join", userId: B, locale: "ja", nowMs: START - 1},
    )).toThrow("has not started");
    expect(() => updateFacebookContextCompetition(
      context, {kind: "leave", userId: A, nowMs: START - 1},
    )).toThrow("has not started");
  });

  it("fails over when the host leaves and rejects duplicate leave", () => {
    const initial = createFacebookContextCompetition({
      contextId: "context-1", contextType: "THREAD", locale: "ja", userId: A, nowMs: START,
    });
    const joined = updateFacebookContextCompetition(
      initial, {kind: "join", userId: B, locale: "ja", nowMs: START + 1},
    );
    expect(updateFacebookContextCompetition(
      joined, {kind: "leave", userId: A, nowMs: START + 2},
    ).hostUserId).toBe(B);
    const left = updateFacebookContextCompetition(joined, {kind: "leave", userId: A, nowMs: START + 2});
    expect(() => updateFacebookContextCompetition(
      left, {kind: "leave", userId: A, nowMs: START + 3},
    )).toThrow("not active");
  });
});
