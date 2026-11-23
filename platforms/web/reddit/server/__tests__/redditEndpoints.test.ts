import {createHash} from "node:crypto";
import {
  parseRedditDeletionPayload,
  parseRedditIdentityPayload,
  redditProviderIdentityId,
  resolveRedditProviderIdentity,
} from "../redditEndpoints";
import {redditFirebaseUid} from "../redditSecurity";
import {createRedditUser} from "../redditUser";

/** Provides app name behavior. */
const appName = "riddle-quest";
/** Provides r id. */
const userId = "t2_reddit-user";
/** Provides uid secret behavior. */
const uidSecret = Buffer.alloc(32, 9).toString("base64");

describe("Reddit provider identities", () => {
  it("uses a stable opaque record ID", () => {
    /** Provides id behavior. */
    const id = redditProviderIdentityId(appName, userId);
    expect(id).toMatch(/^[0-9a-f]{64}$/u);
    expect(id).toBe(redditProviderIdentityId(appName, userId));
    expect(id).not.toContain(userId);
  });

  it("accepts exact active and deleted-generation records", () => {
    /** Provides first uid behavior. */
    const firstUid = redditFirebaseUid(userId, uidSecret, 1);
    expect(
      resolveRedditProviderIdentity(
        {
          provider: "reddit",
          appName,
          providerUserId: userId,
          uid: firstUid,
          accountGeneration: 1,
          status: "active",
        },
        {appName, userId, uidSecret},
      ),
    ).toEqual({accountGeneration: 1, uid: firstUid, needsUidRepair: false});
    /** Provides second uid behavior. */
    const secondUid = redditFirebaseUid(userId, uidSecret, 2);
    expect(
      resolveRedditProviderIdentity(
        {
          provider: "reddit",
          appName,
          providerUserId: userId,
          uid: null,
          accountGeneration: 2,
          status: "active",
          lastDeletedUidHash: createHash("sha256").update(firstUid).digest("hex"),
          lastDeletedAt: {toMillis: () => 1_750_000_000_000},
        },
        {appName, userId, uidSecret},
      ),
    ).toEqual({accountGeneration: 2, uid: secondUid, needsUidRepair: true});
  });

  it.each([
    {provider: "facebook", appName, providerUserId: userId, uid: null, accountGeneration: 2, status: "active"},
    {provider: "reddit", appName: "other", providerUserId: userId, uid: null, accountGeneration: 2, status: "active"},
    {provider: "reddit", appName, providerUserId: "t2_other", uid: null, accountGeneration: 2, status: "active"},
    {provider: "reddit", appName, providerUserId: userId, uid: null, accountGeneration: 1, status: "active"},
    {
      provider: "reddit",
      appName,
      providerUserId: userId,
      uid: null,
      accountGeneration: 2,
      status: "active",
      lastDeletedAt: {toMillis: () => 1},
      lastDeletedUidHash: "f".repeat(64),
    },
    {
      provider: "reddit",
      appName,
      providerUserId: userId,
      uid: `reddit_${"f".repeat(40)}`,
      accountGeneration: 1,
      status: "active",
    },
    {provider: "reddit", appName, providerUserId: userId, uid: null, accountGeneration: 2, status: "deleting"},
  ])("rejects a corrupt provider record", (value) => {
    expect(() => resolveRedditProviderIdentity(value, {appName, userId, uidSecret})).toThrow(
      "reddit-provider-identity-conflict",
    );
  });
});

it("requires an exact account generation on destructive Reddit requests", () => {
  expect(parseRedditDeletionPayload({accountGeneration: 7})).toEqual({accountGeneration: 7});
  for (const value of [{}, {accountGeneration: 0}, {accountGeneration: 1, extra: true}, {accountGeneration: "1"}]) {
    expect(() => parseRedditDeletionPayload(value)).toThrow("invalid-reddit-deletion-payload");
  }
});

it("accepts only a bounded server-sourced Reddit public profile", () => {
  expect(parseRedditIdentityPayload({environment: "sandbox"})).toEqual({environment: "sandbox"});
  expect(
    parseRedditIdentityPayload({environment: "production", profile: {username: "Reddit_User-1", avatarUrl: null}}),
  ).toEqual({environment: "production", profile: {username: "Reddit_User-1", avatarUrl: null}});
  expect(
    parseRedditIdentityPayload({
      environment: "sandbox",
      profile: {
        username: "Reddit_User-1",
        avatarUrl: "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png",
      },
    }),
  ).toMatchObject({environment: "sandbox", profile: {username: "Reddit_User-1"}});
  for (const value of [
    {},
    {environment: "staging"},
    {profile: {username: "ab", avatarUrl: null}},
    {environment: "sandbox", profile: {username: "bad user", avatarUrl: null}},
    {environment: "sandbox", profile: {username: "Reddit_User", avatarUrl: "https://attacker.invalid/avatar"}},
    {environment: "sandbox", profile: {username: "Reddit_User", avatarUrl: "http://www.redditstatic.com/avatar.png"}},
    {
      environment: "sandbox",
      profile: {username: "Reddit_User", avatarUrl: "https://user:pass@www.redditstatic.com/avatar.png"},
    },
    {environment: "sandbox", profile: {username: "Reddit_User", avatarUrl: null, id: userId}},
    {environment: "sandbox", profile: {username: "Reddit_User", avatarUrl: null}, userId},
  ])
    expect(() => parseRedditIdentityPayload(value)).toThrow("invalid-reddit-identity-payload");
});

it("creates a 300-coin game profile without Reddit-owned identity fields", () => {
  /** Provides r. */
  const user = createRedditUser(redditFirebaseUid(userId, uidSecret));
  expect(user).toMatchObject({coins: 300, preferredLanguage: "en", hasActiveSubscription: false});
  /** Serializes d. */
  const serialized = JSON.stringify(user);
  expect(serialized).not.toContain(userId);
  expect(user).not.toHaveProperty("providerUserId");
  expect(user).not.toHaveProperty("redditUsername");
  expect(user).not.toHaveProperty("avatar");
});
