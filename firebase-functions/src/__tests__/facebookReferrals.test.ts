import {
  FACEBOOK_REFERRAL_REWARD_COINS,
  FACEBOOK_REFERRAL_TOKEN_TTL_MS,
  bindFacebookReferralToken,
  issueFacebookReferralToken,
  settleFacebookReferralAfterAuthoritativeWin,
} from "../facebook/facebookReferrals";

type Stored = Record<string, unknown>;
const inviterUid = `facebook_${"a".repeat(40)}`;
const inviteeUid = `facebook_${"b".repeat(40)}`;
const token = "T".repeat(43);

const database = (seed: Record<string, Stored>) => {
  const documents = new Map(Object.entries(seed));
  const reference = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    create: async (value: Stored) => {
      if (documents.has(path)) throw new Error("already-exists");
      documents.set(path, value);
    },
  });
  const transaction = {
    get: jest.fn(async (ref: {path: string}) => ({
      exists: documents.has(ref.path),
      data: () => documents.get(ref.path),
    })),
    update: jest.fn((ref: {path: string}, value: Stored) => {
      documents.set(ref.path, {...documents.get(ref.path), ...value});
    }),
    set: jest.fn((ref: {path: string}, value: Stored) => {
      documents.set(ref.path, {...documents.get(ref.path), ...value});
    }),
    create: jest.fn((ref: {path: string}, value: Stored) => {
      if (documents.has(ref.path)) throw new Error("already-exists");
      documents.set(ref.path, value);
    }),
  };
  const db = {
    collection: (name: string) => ({doc: (id: string) => reference(`${name}/${id}`)}),
    doc: (path: string) => reference(path),
    runTransaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction),
  };
  return {db: db as never, documents};
};

const referralTokenPath = (documents: Map<string, Stored>) =>
  [...documents.keys()].find((path) => path.startsWith("facebookReferralTokens/"))!;

async function issuedFixture(now = 1_700_000_000_000) {
  const fixture = database({
    [`users/${inviterUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2}},
    [`users/${inviteeUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0}},
  });
  await issueFacebookReferralToken(inviterUid, now, () => token, fixture.db);
  return {fixture, now};
}

it("issues a seven-day opaque token while persisting only its hash", async () => {
  const {fixture, now} = await issuedFixture();
  await expect(issueFacebookReferralToken(inviterUid, now, () => token, fixture.db))
    .rejects.toThrow("already-exists");
  const path = referralTokenPath(fixture.documents);
  expect(path).toMatch(/^facebookReferralTokens\/[0-9a-f]{64}$/);
  expect(JSON.stringify([...fixture.documents])).not.toContain(token);
  expect(fixture.documents.get(path)?.expiresAtMs).toBe(now + FACEBOOK_REFERRAL_TOKEN_TTL_MS);
});

it("binds one new invitee idempotently and rejects a second referrer", async () => {
  const {fixture, now} = await issuedFixture();
  await expect(bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db)).resolves.toMatchObject({
    alreadyBound: false,
  });
  await expect(bindFacebookReferralToken(inviteeUid, token, now + 2, fixture.db)).resolves.toMatchObject({
    alreadyBound: true,
  });
  await expect(bindFacebookReferralToken(
    inviteeUid, token, now + FACEBOOK_REFERRAL_TOKEN_TTL_MS + 1, fixture.db,
  )).resolves.toMatchObject({alreadyBound: true});
  const binding = fixture.documents.get(`facebookReferralBindings/${inviteeUid}`);
  const secondInviter = `facebook_${"d".repeat(40)}`;
  fixture.documents.set(`users/${secondInviter}`, {
    coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2},
  });
  await issueFacebookReferralToken(secondInviter, now, () => "U".repeat(43), fixture.db);
  await expect(bindFacebookReferralToken(inviteeUid, "U".repeat(43), now + 3, fixture.db))
    .rejects.toThrow("facebook-referrer-already-bound");
  expect(binding?.inviterUid).toBe(inviterUid);
  expect(fixture.documents.get(`users/${inviteeUid}/knownRivals/${inviterUid}`)).toMatchObject({
    targetUserId: inviterUid, source: "facebook_invite",
  });
  expect(fixture.documents.get(`users/${inviterUid}/knownRivals/${inviteeUid}`)).toMatchObject({
    targetUserId: inviteeUid, source: "facebook_invite",
  });
});

it("does not issue from a deleted or missing referrer account", async () => {
  const missing = database({});
  await expect(issueFacebookReferralToken(inviterUid, 1, () => token, missing.db))
    .rejects.toThrow("facebook-referrer-not-found");
  const deleted = database({
    [`users/${inviterUid}`]: {coins: 300},
    [`jestAccountDeletionTombstones/${inviterUid}`]: {recreationBlocked: true},
  });
  await expect(issueFacebookReferralToken(inviterUid, 1, () => token, deleted.db))
    .rejects.toThrow("account-deleted");
});

it("rejects self-referrals, expired/future tokens, and established invitees", async () => {
  const {fixture, now} = await issuedFixture();
  fixture.documents.set(`users/${inviterUid}`, {coins: 300, stats: {wins: 0, gamesPlayed: 0}});
  await expect(bindFacebookReferralToken(inviterUid, token, now + 1, fixture.db))
    .rejects.toThrow("invalid-facebook-referrer");
  await expect(bindFacebookReferralToken(inviteeUid, token, now + FACEBOOK_REFERRAL_TOKEN_TTL_MS + 1, fixture.db))
    .rejects.toThrow("facebook-referral-token-expired");
  fixture.documents.set(`users/${inviteeUid}`, {
    coins: 300, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 1},
  });
  await expect(bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db))
    .rejects.toThrow("facebook-invitee-already-established");
});

it("fails closed for invalid clocks, token chronology, establishment state, and balances", async () => {
  const invalidClock = database({
    [`users/${inviterUid}`]: {coins: 300, hasPurchasedApp: false, stats: {wins: 1, gamesPlayed: 1}},
  });
  await expect(issueFacebookReferralToken(inviterUid, Number.NaN, () => token, invalidClock.db))
    .rejects.toThrow("invalid-facebook-referral-time");
  await expect(issueFacebookReferralToken(inviterUid, 8_640_000_000_000_000, () => token, invalidClock.db))
    .rejects.toThrow("invalid-facebook-referral-time");

  const malformedToken = await issuedFixture();
  const path = referralTokenPath(malformedToken.fixture.documents);
  const tokenData = malformedToken.fixture.documents.get(path)!;
  malformedToken.fixture.documents.set(path, {...tokenData, expiresAtMs: (tokenData.expiresAtMs as number) + 1});
  await expect(bindFacebookReferralToken(
    inviteeUid, token, malformedToken.now + 1, malformedToken.fixture.db,
  )).rejects.toThrow("invalid-facebook-referral-token-window");

  const malformedStats = await issuedFixture();
  malformedStats.fixture.documents.set(`users/${inviteeUid}`, {
    coins: 300, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: "0"},
  });
  await expect(bindFacebookReferralToken(
    inviteeUid, token, malformedStats.now + 1, malformedStats.fixture.db,
  )).rejects.toThrow("invalid-facebook-referral-stats-gamesPlayed");

  const malformedBalance = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, malformedBalance.now + 1, malformedBalance.fixture.db);
  malformedBalance.fixture.documents.set(`users/${inviteeUid}`, {
    coins: "325", hasPurchasedApp: false, stats: {wins: 1, gamesPlayed: 1},
  });
  await expect(settleFacebookReferralAfterAuthoritativeWin(
    inviteeUid, malformedBalance.now + 2, malformedBalance.fixture.db,
  )).rejects.toThrow("invalid-facebook-referral-invitee-balance");

  const malformedBinding = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, malformedBinding.now + 1, malformedBinding.fixture.db);
  malformedBinding.fixture.documents.set(`users/${inviteeUid}`, {
    coins: 325, hasPurchasedApp: false, stats: {wins: 1, gamesPlayed: 1},
  });
  const binding = malformedBinding.fixture.documents.get(`facebookReferralBindings/${inviteeUid}`)!;
  malformedBinding.fixture.documents.set(`facebookReferralBindings/${inviteeUid}`, {...binding, tokenId: "bad"});
  await expect(settleFacebookReferralAfterAuthoritativeWin(
    inviteeUid, malformedBinding.now + 2, malformedBinding.fixture.db,
  )).rejects.toThrow("facebook-referral-binding-conflict");
});

it("settles both rewards once after the first authoritative win", async () => {
  const {fixture, now} = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db)).resolves.toEqual({
    alreadySettled: false,
    inviteeCoins: FACEBOOK_REFERRAL_REWARD_COINS,
    inviterCoins: FACEBOOK_REFERRAL_REWARD_COINS,
  });
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(425);
  expect(fixture.documents.get(`users/${inviterUid}`)?.coins).toBe(400);
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 3, fixture.db)).resolves.toEqual({
    alreadySettled: true,
    inviteeCoins: 100,
    inviterCoins: 100,
  });
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(425);
});

it("always pays the eligible invitee but caps the inviter at five UTC-day conversions", async () => {
  const {fixture, now} = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  const capPath = `facebookReferralDailyCaps/${await (async () => {
    await settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db);
    return [...fixture.documents.keys()].find((path) => path.startsWith("facebookReferralDailyCaps/"))?.split("/")[1];
  })()}`;
  fixture.documents.delete([...fixture.documents.keys()].find((path) => path.startsWith("facebookReferralSettlements/"))!);
  const originalBinding = fixture.documents.get(`facebookReferralBindings/${inviteeUid}`)!;
  fixture.documents.set(`facebookReferralBindings/${inviteeUid}`, {
    ...originalBinding, settledAtMs: null,
  });
  fixture.documents.set(capPath, {inviterUid, utcDay: new Date(now).toISOString().slice(0, 10), count: 5});
  const beforeInviter = fixture.documents.get(`users/${inviterUid}`)?.coins;
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 4, fixture.db)).resolves.toMatchObject({
    inviteeCoins: 100, inviterCoins: 0,
  });
  expect(fixture.documents.get(`users/${inviterUid}`)?.coins).toBe(beforeInviter);
});

it("does not settle before an authoritative win", async () => {
  const {fixture, now} = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db);
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db))
    .rejects.toThrow("facebook-referral-win-not-established");
});

it("rejects unsettled rewards after invitee deletion and validates replay scope", async () => {
  const {fixture, now} = await issuedFixture();
  await bindFacebookReferralToken(inviteeUid, token, now + 1, fixture.db);
  fixture.documents.set(`users/${inviteeUid}`, {coins: 325, stats: {wins: 1, gamesPlayed: 1}});
  fixture.documents.set(`jestAccountDeletionTombstones/${inviteeUid}`, {recreationBlocked: true});
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 2, fixture.db))
    .rejects.toThrow("account-deleted");
  expect(fixture.documents.get(`users/${inviteeUid}`)?.coins).toBe(325);

  fixture.documents.delete(`jestAccountDeletionTombstones/${inviteeUid}`);
  await settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 3, fixture.db);
  const actualSettlementPath = [...fixture.documents.keys()]
    .find((path) => path.startsWith("facebookReferralSettlements/"))!;
  fixture.documents.set(actualSettlementPath, {
    provider: "facebook", replayProtection: true, inviteeCoins: 100, inviterCoins: 0, settledAtMs: now + 3,
  });
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 4, fixture.db)).resolves.toEqual({
    alreadySettled: true, inviteeCoins: 100, inviterCoins: 0,
  });
  fixture.documents.set(actualSettlementPath, {
    provider: "facebook", replayProtection: true, inviteeCoins: 99, inviterCoins: 0, settledAtMs: now + 3,
  });
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 5, fixture.db))
    .rejects.toThrow("facebook-referral-settlement-conflict");
  fixture.documents.set(actualSettlementPath, {
    provider: "facebook", replayProtection: true, inviteeCoins: 100, inviterCoins: 0, settledAtMs: "invalid",
  });
  await expect(settleFacebookReferralAfterAuthoritativeWin(inviteeUid, now + 6, fixture.db))
    .rejects.toThrow("invalid-facebook-referral-settlement-settled-at");
});
