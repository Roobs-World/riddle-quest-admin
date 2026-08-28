import {
  FACEBOOK_NOTIFICATION_REPROMPT_MS,
  resolveFacebookNotificationPromptClaim,
} from "../facebook/facebookNotificationPrompts";

/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides now ms behavior. */
const nowMs = Date.parse("2026-08-20T12:00:00.000Z");
/** Provides timestamp behavior. */
const timestamp = (milliseconds: number) => ({toMillis: () => milliseconds});
/** Provides r. */
const user = {stats: {wins: 1, totalWins: 1, multiplayerWins: 0}};

describe("Facebook notification prompt lease decisions", () => {
  it("grants only after an authoritative win and at the exact weekly boundary", () => {
    expect(resolveFacebookNotificationPromptClaim({uid, user, lease: undefined, nowMs})).toEqual({
      granted: true,
      claimedAtMs: nowMs,
    });
    expect(
      resolveFacebookNotificationPromptClaim({
        uid,
        user,
        nowMs,
        lease: {
          schemaVersion: 1,
          uid,
          accepted: false,
          lastPromptAt: timestamp(nowMs - FACEBOOK_NOTIFICATION_REPROMPT_MS + 1),
        },
      }),
    ).toEqual({granted: false});
    expect(
      resolveFacebookNotificationPromptClaim({
        uid,
        user,
        nowMs,
        lease: {
          schemaVersion: 1,
          uid,
          accepted: false,
          lastPromptAt: timestamp(nowMs - FACEBOOK_NOTIFICATION_REPROMPT_MS),
        },
      }),
    ).toEqual({granted: true, claimedAtMs: nowMs});
    expect(
      resolveFacebookNotificationPromptClaim({
        uid,
        user: {stats: {wins: 0, totalWins: 0, multiplayerWins: 0}},
        lease: undefined,
        nowMs,
      }),
    ).toEqual({granted: false});
  });

  it("permanently suppresses an accepted lease and rejects future-dated attempts", () => {
    expect(
      resolveFacebookNotificationPromptClaim({
        uid,
        user,
        nowMs,
        lease: {
          schemaVersion: 1,
          uid,
          accepted: true,
          lastPromptAt: timestamp(1),
          acceptedAt: timestamp(2),
        },
      }),
    ).toEqual({granted: false});
    expect(
      resolveFacebookNotificationPromptClaim({
        uid,
        user,
        nowMs,
        lease: {
          schemaVersion: 1,
          uid,
          accepted: false,
          lastPromptAt: timestamp(nowMs + 1),
        },
      }),
    ).toEqual({granted: false});
  });

  it("fails closed on malformed identities, clocks, wins, and lease state", () => {
    /** Provides corrupt behavior. */
    const corrupt = [
      {uid: "facebook_bad", user, lease: undefined, nowMs},
      {uid, user, lease: undefined, nowMs: Number.NaN},
      {uid, user: {stats: {wins: -1}}, lease: undefined, nowMs},
      {uid, user: {stats: {wins: 1.5}}, lease: undefined, nowMs},
      {uid, user, lease: {schemaVersion: 2}, nowMs},
      {uid, user, lease: {schemaVersion: 1, uid: `${uid}0`, accepted: false, lastPromptAt: timestamp(1)}, nowMs},
      {uid, user, lease: {schemaVersion: 1, uid, accepted: true, lastPromptAt: timestamp(1)}, nowMs},
      {
        uid,
        user,
        lease: {schemaVersion: 1, uid, accepted: false, lastPromptAt: timestamp(1), acceptedAt: timestamp(2)},
        nowMs,
      },
      {
        uid,
        user,
        lease: {
          schemaVersion: 1,
          uid,
          accepted: false,
          lastPromptAt: {
            toMillis: () => {
              throw new Error("corrupt");
            },
          },
        },
        nowMs,
      },
    ];
    for (const input of corrupt)
      expect(() => resolveFacebookNotificationPromptClaim(input)).toThrow(/facebook-notification/u);
  });
});
