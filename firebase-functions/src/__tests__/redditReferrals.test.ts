import {
  REDDIT_REFERRAL_REWARD_COINS,
  REDDIT_REFERRAL_TOKEN_TTL_MS,
  bindRedditReferralToken,
  issueRedditReferralToken,
  settleRedditReferralAfterAuthoritativeWin,
} from "../reddit/redditReferrals";

/** Describes stored. */
type Stored = Record<string, unknown>;
/** Provides inviter uid behavior. */
const inviterUid = `reddit_${"a".repeat(40)}`;
/** Provides invitee uid behavior. */
const inviteeUid = `reddit_${"b".repeat(40)}`;
/** Provides token behavior. */
const token = "T".repeat(43);

/** Provides database behavior. */
const database = (seed: Record<string, Stored>) => {
  /** Provides documents behavior. */
  const documents = new Map(Object.entries(seed));
  /** Provides reference behavior. */
  const reference = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    create: async (value: Stored) => {
      if (documents.has(path)) throw new Error("already-exists");
      documents.set(path, value);
    },
  });
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async (ref: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => ({
        exists: documents.has(ref.path),
        data: () => documents.get(ref.path),
      }),
    ),
    update: jest.fn(
      (
        ref: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        documents.set(ref.path, {...documents.get(ref.path), ...value});
      },
    ),
    set: jest.fn(
      (
        ref: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        documents.set(ref.path, {...documents.get(ref.path), ...value});
      },
    ),
    create: jest.fn(
      (
        ref: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        if (documents.has(ref.path)) throw new Error("already-exists");
        documents.set(ref.path, value);
      },
    ),
  };
  /** Provides db behavior. */
  const db = {
    collection: (name: string) => ({doc: (id: string) => reference(`${name}/${id}`)}),
    doc: (path: string) => reference(path),
    runTransaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction),
  };
  return {db: db as never, documents};
};

/** Provides referral token path behavior. */
const referralTokenPath = (documents: Map<string, Stored>) =>
  [...documents.keys()].find((path) => path.startsWith("redditReferralTokens/"))!;

/** Provides issued fixture behavior. */
async function issuedFixture(now = 1_700_000_000_000) {
  /** Provides fixture behavior. */
  const fixture = database({
    [`users/${inviterUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2}},
    [`users/${inviteeUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0}},
  });
  await issueRedditReferralToken(inviterUid, now, () => token, fixture.db);
  return {fixture, now};
}

it("issues a seven-day opaque token while persisting only its hash", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await expect(issueRedditReferralToken(inviterUid, now, () => token, fixture.db)).rejects.toThrow("already-exists");
  /** Provides path behavior. */
  const path = referralTokenPath(fixture.documents);
  expect(path).toMatch(/^redditReferralTokens\/[0-9a-f]{64}$/);
  expect(JSON.stringify([...fixture.documents])).not.toContain(token);
  expect(fixture.documents.get(path)?.expiresAtMs).toBe(now + REDDIT_REFERRAL_TOKEN_TTL_MS);
});

it("binds only through the exact gateway-verified post and locale provenance", async () => {
  /** Provides now behavior. */
  const now = 1_700_000_000_000;
  /** Provides fixture behavior. */
  const fixture = database({
    [`users/${inviterUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2}},
    [`users/${inviteeUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0}},
  });
  /** Provides provenance behavior. */
  const provenance = {locale: "en" as const, postId: "t3_referral_post", environment: "sandbox" as const};
  await issueRedditReferralToken(inviterUid, now, () => token, fixture.db, provenance);
  expect(JSON.stringify([...fixture.documents])).not.toContain("t3_referral_post");
  await expect(
    bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db, {...provenance, locale: "fr"}),
  ).rejects.toThrow("reddit-referral-provenance-mismatch");
  await expect(
    bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db, {...provenance, postId: "t3_copied_post"}),
  ).rejects.toThrow("reddit-referral-provenance-mismatch");
  await expect(
    bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db, {...provenance, environment: "production"}),
  ).rejects.toThrow("reddit-referral-provenance-mismatch");
  await expect(bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db, provenance)).resolves.toEqual({
    alreadyBound: false,
    expiresAtMs: now + REDDIT_REFERRAL_TOKEN_TTL_MS,
  });
  /** Provides binding behavior. */
  const binding = fixture.documents.get(`redditReferralBindings/${inviteeUid}`);
  expect(binding).toMatchObject({locale: "en", postIdHash: expect.stringMatching(/^[0-9a-f]{64}$/)});
});

it("binds one new invitee idempotently and rejects a second referrer", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await expect(bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db)).resolves.toMatchObject({
    alreadyBound: false,
  });
  await expect(bindRedditReferralToken(inviteeUid, token, now + 2, fixture.db)).resolves.toMatchObject({
    alreadyBound: true,
  });
  await expect(
    bindRedditReferralToken(inviteeUid, token, now + REDDIT_REFERRAL_TOKEN_TTL_MS + 1, fixture.db),
  ).resolves.toMatchObject({alreadyBound: true});
  /** Provides binding behavior. */
  const binding = fixture.documents.get(`redditReferralBindings/${inviteeUid}`);
  /** Provides second inviter behavior. */
  const secondInviter = `reddit_${"d".repeat(40)}`;
  fixture.documents.set(`users/${secondInviter}`, {
    coins: 300,
    hasPurchasedApp: false,
    stats: {wins: 2, gamesPlayed: 2},
  });
  await issueRedditReferralToken(secondInviter, now, () => "U".repeat(43), fixture.db);
  await expect(bindRedditReferralToken(inviteeUid, "U".repeat(43), now + 3, fixture.db)).rejects.toThrow(
    "reddit-referrer-already-bound",
  );
  expect(binding?.inviterUid).toBe(inviterUid);
  expect(fixture.documents.get(`users/${inviteeUid}/knownRivals/${inviterUid}`)).toMatchObject({
    targetUserId: inviterUid,
    source: "reddit_invite",
  });
  expect(fixture.documents.get(`users/${inviterUid}/knownRivals/${inviteeUid}`)).toMatchObject({
    targetUserId: inviteeUid,
    source: "reddit_invite",
  });
});

it("does not issue from a deleted or missing referrer account", async () => {
  /** Provides missing behavior. */
  const missing = database({});
  await expect(issueRedditReferralToken(inviterUid, 1, () => token, missing.db)).rejects.toThrow(
    "reddit-referrer-not-found",
  );
  /** Deletes d. */
  const deleted = database({
    [`users/${inviterUid}`]: {coins: 300},
    [`jestAccountDeletionTombstones/${inviterUid}`]: {recreationBlocked: true},
  });
  await expect(issueRedditReferralToken(inviterUid, 1, () => token, deleted.db)).rejects.toThrow("account-deleted");
});

it("rejects self-referrals, expired/future tokens, and established invitees", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  fixture.documents.set(`users/${inviterUid}`, {coins: 300, stats: {wins: 0, gamesPlayed: 0}});
  await expect(bindRedditReferralToken(inviterUid, token, now + 1, fixture.db)).rejects.toThrow(
    "invalid-reddit-referrer",
  );
  await expect(
    bindRedditReferralToken(inviteeUid, token, now + REDDIT_REFERRAL_TOKEN_TTL_MS + 1, fixture.db),
  ).rejects.toThrow("reddit-referral-token-expired");
  fixture.documents.set(`users/${inviteeUid}`, {
    coins: 300,
    hasPurchasedApp: false,
    stats: {wins: 0, gamesPlayed: 1},
  });
  await expect(bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db)).rejects.toThrow(
    "reddit-invitee-already-established",
  );
});

it("fails closed for invalid clocks, token chronology, establishment state, and balances", async () => {
  /** Provides invalid clock behavior. */
  const invalidClock = database({
    [`users/${inviterUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 1, gamesPlayed: 1}},
  });
  await expect(issueRedditReferralToken(inviterUid, Number.NaN, () => token, invalidClock.db)).rejects.toThrow(
    "invalid-reddit-referral-time",
  );
  await expect(
    issueRedditReferralToken(inviterUid, 8_640_000_000_000_000, () => token, invalidClock.db),
  ).rejects.toThrow("invalid-reddit-referral-time");

  /** Provides malformed token behavior. */
  const malformedToken = await issuedFixture();
  /** Provides path behavior. */
  const path = referralTokenPath(malformedToken.fixture.documents);
  /** Provides token data behavior. */
  const tokenData = malformedToken.fixture.documents.get(path)!;
  malformedToken.fixture.documents.set(path, {...tokenData, expiresAtMs: (tokenData.expiresAtMs as number) + 1});
  await expect(
    bindRedditReferralToken(inviteeUid, token, malformedToken.now + 1, malformedToken.fixture.db),
  ).rejects.toThrow("invalid-reddit-referral-token-window");

  /** Provides malformed stats behavior. */
  const malformedStats = await issuedFixture();
  malformedStats.fixture.documents.set(`users/${inviteeUid}`, {
    coins: 300,
    hasPurchasedApp: false,
    stats: {wins: 0, gamesPlayed: "0"},
  });
  await expect(
    bindRedditReferralToken(inviteeUid, token, malformedStats.now + 1, malformedStats.fixture.db),
  ).rejects.toThrow("invalid-reddit-referral-stats-gamesPlayed");

  /** Provides malformed balance behavior. */
  const malformedBalance = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, malformedBalance.now + 1, malformedBalance.fixture.db);
  malformedBalance.fixture.documents.set(`users/${inviteeUid}`, {
    coins: "325",
    hasPurchasedApp: false,
    stats: {wins: 1, gamesPlayed: 1},
  });
  await expect(
    settleRedditReferralAfterAuthoritativeWin(inviteeUid, malformedBalance.now + 2, malformedBalance.fixture.db),
  ).rejects.toThrow("invalid-reddit-referral-invitee-balance");

  /** Provides malformed binding behavior. */
  const malformedBinding = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, malformedBinding.now + 1, malformedBinding.fixture.db);
  malformedBinding.fixture.documents.set(`users/${inviteeUid}`, {
    coins: 325,
    hasPurchasedApp: false,
    stats: {wins: 1, gamesPlayed: 1},
  });
  /** Provides binding behavior. */
  const binding = malformedBinding.fixture.documents.get(`redditReferralBindings/${inviteeUid}`)!;
  malformedBinding.fixture.documents.set(`redditReferralBindings/${inviteeUid}`, {...binding, tokenId: "bad"});
  await expect(
    settleRedditReferralAfterAuthoritativeWin(inviteeUid, malformedBinding.now + 2, malformedBinding.fixture.db),
  ).rejects.toThrow("reddit-referral-binding-conflict");
});

it("settles both rewards once after the first authoritative win", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db)).resolves.toEqual({
    alreadySettled: false,
    inviteeCoins: REDDIT_REFERRAL_REWARD_COINS,
    inviterCoins: REDDIT_REFERRAL_REWARD_COINS,
  });
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(425);
  expect(fixture.documents.get(`users/${inviterUid}`)?.coins).toBe(400);
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 3, fixture.db)).resolves.toEqual({
    alreadySettled: true,
    inviteeCoins: 100,
    inviterCoins: 100,
  });
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(425);
});

it("always pays the eligible invitee but caps the inviter at five UTC-day conversions", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  /** Provides cap path behavior. */
  const capPath = `redditReferralDailyCaps/${await (async () => {
    await settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db);
    return [...fixture.documents.keys()].find((path) => path.startsWith("redditReferralDailyCaps/"))?.split("/")[1];
  })()}`;
  fixture.documents.delete(
    [...fixture.documents.keys()].find((path) => path.startsWith("redditReferralSettlements/"))!,
  );
  /** Provides original binding behavior. */
  const originalBinding = fixture.documents.get(`redditReferralBindings/${inviteeUid}`)!;
  fixture.documents.set(`redditReferralBindings/${inviteeUid}`, {
    ...originalBinding,
    settledAtMs: null,
  });
  fixture.documents.set(capPath, {inviterUid, utcDay: new Date(now).toISOString().slice(0, 10), count: 5});
  /** Provides before inviter behavior. */
  const beforeInviter = fixture.documents.get(`users/${inviterUid}`)?.coins;
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 4, fixture.db)).resolves.toMatchObject({
    inviteeCoins: 100,
    inviterCoins: 0,
  });
  expect(fixture.documents.get(`users/${inviterUid}`)?.coins).toBe(beforeInviter);
});

it("does not settle before an authoritative win", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db);
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db)).rejects.toThrow(
    "reddit-referral-win-not-established",
  );
});

it("rejects unsettled rewards after invitee deletion and validates replay scope", async () => {
  /** Provides {fixture, now} behavior. */
  const {fixture, now} = await issuedFixture();
  await bindRedditReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  fixture.documents.set(`jestAccountDeletionTombstones/${inviteeUid}`, {recreationBlocked: true});
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db)).rejects.toThrow(
    "account-deleted",
  );
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(325);

  fixture.documents.delete(`jestAccountDeletionTombstones/${inviteeUid}`);
  await settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 3, fixture.db);
  /** Provides actual settlement path behavior. */
  const actualSettlementPath = [...fixture.documents.keys()].find((path) =>
    path.startsWith("redditReferralSettlements/"),
  )!;
  fixture.documents.set(actualSettlementPath, {
    provider: "reddit",
    replayProtection: true,
    inviteeCoins: 100,
    inviterCoins: 0,
    settledAtMs: now + 3,
  });
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 4, fixture.db)).resolves.toEqual({
    alreadySettled: true,
    inviteeCoins: 100,
    inviterCoins: 0,
  });
  fixture.documents.set(actualSettlementPath, {
    provider: "reddit",
    replayProtection: true,
    inviteeCoins: 99,
    inviterCoins: 0,
    settledAtMs: now + 3,
  });
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 5, fixture.db)).rejects.toThrow(
    "reddit-referral-settlement-conflict",
  );
  fixture.documents.set(actualSettlementPath, {
    provider: "reddit",
    replayProtection: true,
    inviteeCoins: 100,
    inviterCoins: 0,
    settledAtMs: "invalid",
  });
  await expect(settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 6, fixture.db)).rejects.toThrow(
    "invalid-reddit-referral-settlement-settled-at",
  );
});
