import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Query} from "firebase-admin/firestore";
import {getLeaderboard} from "../gameplay/leaderboard";

/** Only this loopback demo fixture may hold these canonical accounts and public projections. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** IDs reserved exclusively for the private test's account and projection documents. */
const IDS = ["leaderboard-profile-a", "leaderboard-profile-b", "leaderboard-profile-c"] as const;
/** Real Admin SDK account batch reads include the actual Firestore field-mask behavior. */
let db: FirebaseFirestore.Firestore;
/** Removes only this fixture's fixed account IDs and corresponding projections. */
const clear = async () => {await Promise.all(IDS.flatMap(id => [db.doc(`users/${id}`).delete(), db.doc(`leaderboard/${id}`).delete()]));};
/** Executes the real callable wrapper with synthetic verified transport claims. */
const readBoard = (type: "xp" | "totalWins" | "bestStreak" | "multiplayerWins" = "xp") => getLeaderboard.run({auth: {uid: "leaderboard-profile-viewer", token: {}}, data: {type, limit: 10}} as never);
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  await db.doc(`users/${IDS[0]}`).set({username: "Current name", avatarUrl: "https://example.invalid/current.png", stats: {level: 99, xp: 100, totalWins: 99}});
  await db.doc(`leaderboard/${IDS[0]}`).set({userId: IDS[0], subjectUserId: IDS[0], username: "Old name", avatarUrl: "https://example.invalid/old.png",
    level: 2, xp: 50, progressScore: 2_000_000_050, totalWins: 10, bestStreak: 5, updatedAt: 123});
});
afterAll(clear);

it.each(["xp", "totalWins", "bestStreak"] as const)("hydrates current identity for %s while keeping projection score semantics", async type => {
  /** Read-only identity repair must neither update the public projection nor mutate the account. */
  const before = (await db.doc(`leaderboard/${IDS[0]}`).get()).data();
  /** Actual account batch read already performed for canonical existence now supplies display fields. */
  const result = await readBoard(type);
  expect(result).toMatchObject({entries: [{userId: IDS[0], username: "Current name", avatarUrl: "https://example.invalid/current.png",
    level: 2, xp: 50, totalWins: 10, bestStreak: 5, updatedAt: 123}]});
  expect((await db.doc(`leaderboard/${IDS[0]}`).get()).data()).toEqual(before);
});
it("omits a removed canonical avatar even when its copied projection still contains one", async () => {
  await db.doc(`users/${IDS[0]}`).update({avatarUrl: FieldValue.delete()});
  expect((await readBoard()).entries[0]).not.toHaveProperty("avatarUrl");
});
it("uses the current display-name fallback without exposing an earlier copied username", async () => {
  await db.doc(`users/${IDS[0]}`).update({username: FieldValue.delete(), displayName: "Current display name"});
  expect((await readBoard()).entries[0]?.username).toBe("Current display name");
});
it("keeps an existing account with no display fields live under the field mask", async () => {
  await db.doc(`users/${IDS[0]}`).set({coins: 550});
  /** The projection score distinguishes a live masked account from a fallback account scan. */
  const result = await readBoard();
  expect(result).toMatchObject({entries: [{userId: IDS[0], username: "Player", level: 2, xp: 50}]});
  expect(result.entries[0]).not.toHaveProperty("avatarUrl");
});
it("retains deletion and subject ownership checks before hydrating remaining accounts", async () => {
  await db.doc(`users/${IDS[0]}`).delete();
  await db.doc(`users/${IDS[1]}`).set({username: "Unrelated account"});
  await db.doc(`leaderboard/${IDS[1]}`).set({userId: IDS[1], subjectUserId: IDS[0], username: "Unrelated account", progressScore: 3_000_000_000});
  await db.doc(`users/${IDS[2]}`).set({username: "Remaining player"});
  await db.doc(`leaderboard/${IDS[2]}`).set({userId: IDS[2], subjectUserId: IDS[2], username: "Remaining player", progressScore: 1_000_000_000});
  expect((await readBoard()).entries.map(entry => entry.userId)).toEqual([IDS[2]]);
});
it("loads only display fields in the existing single account batch read", async () => {
  await db.doc(`users/${IDS[0]}`).update({privateBlob: "x".repeat(100_000), coins: 550});
  /** Calls the actual SDK beneath the seam so field masking is verified by the real emulator. */
  const original = db.getAll.bind(db);
  /** Records only synthetic fixture data sizes, never user account contents. */
  let readCalls = 0, documentBytes = 0, loadedFields: string[] = [];
  /** Read seam observes the SDK's real filtered result without replacing any database operation. */
  const spy = jest.spyOn(db, "getAll").mockImplementation(async (...args) => {
    /** Canonical snapshots returned by the actual account batch operation. */
    const documents = await original(...args);
    readCalls++;
    documentBytes = Buffer.byteLength(JSON.stringify(documents.map(document => document.data())));
    loadedFields = Object.keys(documents[0]!.data()!).sort();
    return documents;
  });
  try {
    await readBoard();
    if (process.env.LEADERBOARD_PROFILE_TRACE) console.info(JSON.stringify({readCalls, documentBytes, loadedFields}));
    expect(readCalls).toBe(1);
    expect(loadedFields).toEqual(["avatarUrl", "username"]);
    expect(documentBytes).toBeLessThan(256);
  } finally {spy.mockRestore();}
});

it.each(["fallback", "multiplayerWins"] as const)("limits %s account query payload to public ranking fields", async mode => {
  await db.doc(`users/${IDS[0]}`).update({privateBlob: "x".repeat(100_000), coins: 550, "stats.multiplayerWins": 999_999});
  if (mode === "fallback") await db.doc(`leaderboard/${IDS[0]}`).delete();
  /** Real SDK query execution preserves indexes, ordering and the actual projection field mask. */
  const original = Query.prototype.get;
  /** Records only this synthetic account's decoded document size and field names. */
  let readCalls = 0, documentBytes = 0, loadedFields: string[] = [];
  /** Canonical users queries are observed underneath the actual callable and SDK. */
  const spy = jest.spyOn(Query.prototype, "get").mockImplementation(async function(this: FirebaseFirestore.Query) {
    /** The original SDK handles server-side select fields and returns genuine query snapshots. */
    const result = await original.call(this);
    /** Only this fixture's canonical account contributes payload measurements. */
    const account = result.docs.find(document => document.ref.path === `users/${IDS[0]}`);
    if (account) {
      readCalls++;
      documentBytes = Buffer.byteLength(JSON.stringify(account.data()));
      loadedFields = Object.keys(account.data()).sort();
    }
    return result;
  });
  try {
    /** The response keeps canonical score semantics for fallback and multiplayer rankings. */
    const result = await readBoard(mode === "fallback" ? "xp" : "multiplayerWins");
    expect(result.entries.find(entry => entry.userId === IDS[0])).toMatchObject({username: "Current name", level: 99, xp: 100, multiplayerWins: 999_999});
    if (process.env.LEADERBOARD_PROFILE_TRACE) console.info(JSON.stringify({mode, readCalls, documentBytes, loadedFields}));
    expect(readCalls).toBe(1);
    expect(loadedFields).toEqual(["avatarUrl", "stats", "username"]);
    expect(documentBytes).toBeLessThan(256);
  } finally {spy.mockRestore();}
});
