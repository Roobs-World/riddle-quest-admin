import {
  joinFacebookContextCompetition,
  leaveFacebookContextCompetition,
  parseFacebookContextCompetition,
  removeUserFromFacebookContextCompetitions,
} from "../../race/facebookContextService";
import {FACEBOOK_CONTEXT_BOARD_DURATION_MS, facebookContextKey} from "../../race/facebookContextCompetition";

type Stored = Record<string, unknown>;
const A = `facebook_${"a".repeat(40)}`;
const B = `facebook_${"b".repeat(40)}`;
const C = `facebook_${"c".repeat(40)}`;
const START = Date.UTC(2026, 7, 19);

const database = () => {
  const documents = new Map<string, Stored>();
  const ref = (path: string) => ({path, id: path.split("/").at(-1)!});
  const transaction = {
    get: jest.fn(async (reference: {path: string}) => ({
      exists: documents.has(reference.path),
      data: () => documents.get(reference.path),
    })),
    set: jest.fn((reference: {path: string}, value: Stored) => {
      documents.set(reference.path, {...documents.get(reference.path), ...value});
    }),
    delete: jest.fn((reference: {path: string}) => documents.delete(reference.path)),
  };
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ref(`${name}/${id}`),
      where: (_field: string, _operator: string, value: string) => ({
        limit: (_limit: number) => ({
          get: async () => {
            const docs = [...documents.entries()]
              .filter(([path, data]) => path.startsWith(`${name}/`) &&
                Array.isArray(data.memberIds) && data.memberIds.includes(value))
              .map(([path]) => ({ref: ref(path)}));
            return {empty: docs.length === 0, docs};
          },
        }),
      }),
    }),
    doc: (path: string) => ref(path),
    runTransaction: async <T>(operation: (value: typeof transaction) => Promise<T>) => operation(transaction),
  };
  return {db: db as never, documents};
};

it("transactionally joins independent members and establishes bilateral known-rival records", async () => {
  const fixture = database();
  const first = await joinFacebookContextCompetition({
    userId: A, contextId: "meta-thread-1", contextType: "THREAD", locale: "ja", nowMs: START,
  }, fixture.db);
  expect(first.members).toHaveLength(1);
  const joined = await joinFacebookContextCompetition({
    userId: B, contextId: "meta-thread-1", contextType: "THREAD", locale: "ja", nowMs: START + 1,
  }, fixture.db);
  expect(joined.members).toHaveLength(2);
  expect(fixture.documents.get(`users/${A}/knownRivals/${B}`)).toMatchObject({
    targetUserId: B, source: "facebook_context",
  });
  expect(fixture.documents.get(`users/${B}/knownRivals/${A}`)).toMatchObject({
    targetUserId: A, source: "facebook_context",
  });
  expect(JSON.stringify([...fixture.documents])).not.toContain("meta-thread-1");

  const replay = await joinFacebookContextCompetition({
    userId: B, contextId: "meta-thread-1", contextType: "THREAD", locale: "ja", nowMs: START + 2,
  }, fixture.db);
  expect(replay.members).toHaveLength(2);
});

it("rejects cross-locale/type joins and fails over the host on leave", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "group-1", contextType: "GROUP", locale: "ar", nowMs: START,
  }, fixture.db);
  await expect(joinFacebookContextCompetition({
    userId: B, contextId: "group-1", contextType: "THREAD", locale: "ar", nowMs: START + 1,
  }, fixture.db)).rejects.toThrow("type changed");
  await expect(joinFacebookContextCompetition({
    userId: B, contextId: "group-1", contextType: "GROUP", locale: "en", nowMs: START + 1,
  }, fixture.db)).rejects.toThrow("locale does not match");
  await joinFacebookContextCompetition({
    userId: B, contextId: "group-1", contextType: "GROUP", locale: "ar", nowMs: START + 1,
  }, fixture.db);
  await expect(leaveFacebookContextCompetition({
    userId: A, contextId: "group-1", nowMs: START + 2,
  }, fixture.db)).resolves.toMatchObject({hostUserId: B});
});

it("rejects pre-creation context actions without mutating membership or rival state", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "clock-group", contextType: "GROUP", locale: "en", nowMs: START,
  }, fixture.db);
  const key = facebookContextKey("clock-group");
  const before = structuredClone(fixture.documents.get(`facebookContextCompetitions/${key}`));
  await expect(joinFacebookContextCompetition({
    userId: B, contextId: "clock-group", contextType: "GROUP", locale: "en", nowMs: START - 1,
  }, fixture.db)).rejects.toThrow("has not started");
  await expect(leaveFacebookContextCompetition({
    userId: A, contextId: "clock-group", nowMs: START - 1,
  }, fixture.db)).rejects.toThrow("has not started");
  await expect(joinFacebookContextCompetition({
    userId: B, contextId: "clock-group", contextType: "GROUP", locale: "en",
    nowMs: 253_402_300_799_999,
  }, fixture.db)).rejects.toThrow("context time is invalid");
  expect(fixture.documents.get(`facebookContextCompetitions/${key}`)).toEqual(before);
  expect([...fixture.documents.keys()].some((path) => path.includes("knownRivals"))).toBe(false);
});

it("deletes a context and every score when its sole active member leaves", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "solo", contextType: "THREAD", locale: "en", nowMs: START,
  }, fixture.db);
  const key = facebookContextKey("solo");
  fixture.documents.set(`facebookContextCompetitions/${key}/entries/${A}`, {adjustedTimeMs: 1});
  await expect(leaveFacebookContextCompetition({
    userId: A, contextId: "solo", nowMs: START + 1,
  }, fixture.db)).resolves.toBeNull();
  expect(fixture.documents.has(`facebookContextCompetitions/${key}`)).toBe(false);
  expect(fixture.documents.has(`facebookContextCompetitions/${key}/entries/${A}`)).toBe(false);
});

it("resets membership time and removes the old score when an inactive member rejoins", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "rejoin-group", contextType: "GROUP", locale: "en", nowMs: START,
  }, fixture.db);
  await joinFacebookContextCompetition({
    userId: B, contextId: "rejoin-group", contextType: "GROUP", locale: "en", nowMs: START + 1,
  }, fixture.db);
  await leaveFacebookContextCompetition({
    userId: A, contextId: "rejoin-group", nowMs: START + 2,
  }, fixture.db);
  const key = facebookContextKey("rejoin-group");
  const entryPath = `facebookContextCompetitions/${key}/entries/${A}`;
  fixture.documents.set(entryPath, {adjustedTimeMs: 1, completedAtMs: START + 1});

  const rejoined = await joinFacebookContextCompetition({
    userId: A, contextId: "rejoin-group", contextType: "GROUP", locale: "en", nowMs: START + 10,
  }, fixture.db);
  expect(rejoined.members.find(({userId}) => userId === A)).toEqual({
    userId: A, joinedAtMs: START + 10, active: true,
  });
  expect(rejoined.hostUserId).toBe(B);
  expect(fixture.documents.has(entryPath)).toBe(false);
});

it("rejects corrupt membership and host-election records", () => {
  const key = facebookContextKey("strict-record");
  const valid = {
    contextKey: key,
    contextType: "THREAD",
    locale: "en",
    hostUserId: A,
    members: [{userId: A, joinedAtMs: START, active: true}],
    createdAtMs: START,
    expiresAtMs: START + FACEBOOK_CONTEXT_BOARD_DURATION_MS,
  };
  expect(parseFacebookContextCompetition(valid)).toMatchObject({hostUserId: A});
  expect(() => parseFacebookContextCompetition({
    ...valid,
    members: [...valid.members, {...valid.members[0]}],
  })).toThrow("identities are duplicated");
  expect(() => parseFacebookContextCompetition({...valid, hostUserId: B}))
    .toThrow("host election is invalid");
  expect(() => parseFacebookContextCompetition({...valid, expiresAtMs: START + 1}))
    .toThrow("record is invalid");
  expect(() => parseFacebookContextCompetition({
    ...valid,
    members: [{userId: A, joinedAtMs: START, active: false}],
  })).toThrow("host election is invalid");
});

it("rolls an expired context into a fresh board while archiving no identities", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "rolling-group", contextType: "GROUP", locale: "ar", nowMs: START,
  }, fixture.db);
  await joinFacebookContextCompetition({
    userId: B, contextId: "rolling-group", contextType: "GROUP", locale: "ar", nowMs: START + 1,
  }, fixture.db);
  const key = facebookContextKey("rolling-group");
  fixture.documents.set(`facebookContextCompetitions/${key}/entries/${A}`, {adjustedTimeMs: 1});
  fixture.documents.set(`facebookContextCompetitions/${key}/entries/${B}`, {adjustedTimeMs: 2});

  const rolled = await joinFacebookContextCompetition({
    userId: B,
    contextId: "rolling-group",
    contextType: "THREAD",
    locale: "ja",
    nowMs: START + FACEBOOK_CONTEXT_BOARD_DURATION_MS,
  }, fixture.db);
  expect(rolled).toMatchObject({contextType: "THREAD", locale: "ja", hostUserId: B, members: [{userId: B}]});
  expect(fixture.documents.has(`facebookContextCompetitions/${key}/entries/${A}`)).toBe(false);
  expect(fixture.documents.has(`facebookContextCompetitions/${key}/entries/${B}`)).toBe(false);
  const archived = fixture.documents.get(`facebookContextCompetitionHistory/${key}_${START}`);
  expect(archived).toMatchObject({locale: "ar", participantCount: 2, rewardsEnabled: false});
  expect(JSON.stringify(archived)).not.toMatch(/facebook_|userId|memberIds/);
});

it("rejects non-Facebook identities before touching Firestore", async () => {
  const fixture = database();
  await expect(joinFacebookContextCompetition({
    userId: "jest_attacker", contextId: "group-1", contextType: "GROUP", locale: "en", nowMs: START,
  }, fixture.db)).rejects.toThrow("Facebook identity is required");
  expect(fixture.documents.size).toBe(0);
});

it("removes deleted members, re-elects the host, and deletes empty contexts", async () => {
  const fixture = database();
  await joinFacebookContextCompetition({
    userId: A, contextId: "deletion-group", contextType: "GROUP", locale: "en", nowMs: START,
  }, fixture.db);
  await joinFacebookContextCompetition({
    userId: B, contextId: "deletion-group", contextType: "GROUP", locale: "en", nowMs: START + 1,
  }, fixture.db);
  await joinFacebookContextCompetition({
    userId: C, contextId: "deletion-group", contextType: "GROUP", locale: "en", nowMs: START + 2,
  }, fixture.db);

  await removeUserFromFacebookContextCompetitions(A, fixture.db);
  const contextEntry = [...fixture.documents.entries()].find(([path]) =>
    path.startsWith("facebookContextCompetitions/"));
  expect(contextEntry?.[1]).toMatchObject({hostUserId: B, memberIds: [B, C]});
  expect(JSON.stringify(contextEntry?.[1])).not.toContain(A);

  await removeUserFromFacebookContextCompetitions(B, fixture.db);
  await removeUserFromFacebookContextCompetitions(C, fixture.db);
  expect([...fixture.documents.keys()].filter((path) =>
    path.startsWith("facebookContextCompetitions/"))).toHaveLength(0);
});

it("ignores non-Facebook deletion identities without querying context state", async () => {
  const fixture = database();
  await removeUserFromFacebookContextCompetitions("jest_user", fixture.db);
  expect(fixture.documents.size).toBe(0);
});
