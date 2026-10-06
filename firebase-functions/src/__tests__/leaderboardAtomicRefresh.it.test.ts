import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {updateLeaderboardEntry} from "../gameplay/leaderboard";

/** These fixtures may remove only their own data on a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Stable account used only inside the private emulator. */
const OWNER = "leaderboard-refresh-player";
/** Real Admin SDK persistence, including optimistic transaction retries. */
let db: FirebaseFirestore.Firestore;
/** A delayed caller retains its old profile arguments in both baseline and fixed probes. */
const delayedRefresh: (id: string, username: string, stats: typeof oldStats, avatar?: string) => Promise<void> = updateLeaderboardEntry;
/** Snapshot captured before a competing game or profile mutation. */
const oldStats = {level: 2, xp: 50, totalWins: 4, bestStreak: 3};
/** Every probe issues the same delayed invocation after a competing canonical mutation. */
const refreshOldSnapshot = () => delayedRefresh(OWNER, "Old name", oldStats, "https://example.invalid/old.png");
/** Removes only the fixed fixture account and its public projection. */
const clear = async () => {await db.doc(`users/${OWNER}`).delete(); await db.doc(`leaderboard/${OWNER}`).delete();};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  await db.doc(`users/${OWNER}`).set({username: "Old name", avatarUrl: "https://example.invalid/old.png", stats: oldStats});
  await db.doc(`leaderboard/${OWNER}`).set({userId: OWNER, subjectUserId: OWNER, username: "Old name", avatarUrl: "https://example.invalid/old.png", ...oldStats});
});
afterAll(clear);

it("never rolls back the indexed score when an older completion arrives last", async () => {
  await db.doc(`users/${OWNER}`).update({stats: {level: 3, xp: 100, totalWins: 5, bestStreak: 4}});
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).toMatchObject({level: 3, xp: 100, progressScore: 3_000_000_100, totalWins: 5, bestStreak: 4});
});
it("preserves a canonical name and avatar change despite delayed completion", async () => {
  await db.doc(`users/${OWNER}`).update({username: "Current name", avatarUrl: "https://example.invalid/current.png"});
  await db.doc(`leaderboard/${OWNER}`).update({username: "Current name", avatarUrl: "https://example.invalid/current.png"});
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).toMatchObject({username: "Current name", avatarUrl: "https://example.invalid/current.png"});
});
it("clears an avatar removed from the canonical profile", async () => {
  await db.doc(`users/${OWNER}`).update({avatarUrl: FieldValue.delete()});
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).not.toHaveProperty("avatarUrl");
});
it("never recreates a leaderboard row after its account is removed", async () => {
  await clear();
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).exists).toBe(false);
  expect((await db.doc(`users/${OWNER}`).get()).exists).toBe(false);
});
it("converges on committed stats through concurrent refresh and account transactions", async () => {
  await Promise.all([
    refreshOldSnapshot(), refreshOldSnapshot(),
    db.runTransaction(async transaction => {
      /** The actual canonical account participates in the same transaction conflict boundary. */
      const ref = db.doc(`users/${OWNER}`), snapshot = await transaction.get(ref);
      transaction.update(ref, {"stats.totalWins": snapshot.data()!.stats.totalWins + 1, "stats.multiplayerWins": 7});
    }),
  ]);
  // Receipt replay refreshes from current authority even when passed an older captured snapshot.
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).toMatchObject({totalWins: 5, multiplayerWins: 7});
  expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({stats: {totalWins: 5, multiplayerWins: 7}});
});

it("loads only score and display inputs in one real writer transaction read", async () => {
  await db.doc(`users/${OWNER}`).update({privateBlob: "x".repeat(100_000), coins: 550, "stats.multiplayerWins": 7});
  /** The original SDK transaction still performs every read and write; the seam only observes returned data. */
  const original = db.runTransaction.bind(db);
  /** Captures decoded synthetic document size, without recording any account values. */
  let readCalls = 0, documentBytes = 0, loadedFields: string[] = [];
  /** Measures actual document snapshots returned beneath both the baseline and masked writer API. */
  const observe = (document: FirebaseFirestore.DocumentSnapshot) => {
    if (document.ref.path === `users/${OWNER}`) {
      readCalls++;
      documentBytes = Buffer.byteLength(JSON.stringify(document.data()));
      loadedFields = Object.keys(document.data()!).sort();
    }
  };
  /** Wraps one genuine transaction attempt while preserving its methods and commit behavior. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    /** Restored after every attempt so real SDK retries cannot nest observer wrappers. */
    const get = transaction.get.bind(transaction), getAll = transaction.getAll.bind(transaction);
    transaction.get = async (...args: Parameters<typeof get>) => {
      /** This baseline writer reads one document through the original SDK. */
      const result = await get(...args);
      observe(result as FirebaseFirestore.DocumentSnapshot);
      return result;
    };
    transaction.getAll = async (...args: Parameters<typeof getAll>) => {
      /** Field masking is performed by the original SDK and emulator, never fabricated by the fixture. */
      const documents = await getAll(...args);
      documents.forEach(observe);
      return documents;
    };
    try {return await operation(transaction);} finally {transaction.get = get; transaction.getAll = getAll;}
  }, options));
  try {
    await refreshOldSnapshot();
    if (process.env.LEADERBOARD_WRITER_TRACE) console.info(JSON.stringify({readCalls, documentBytes, loadedFields}));
    expect(readCalls).toBe(1);
    expect(loadedFields).toEqual(["avatarUrl", "stats", "username"]);
    expect(documentBytes).toBeLessThan(256);
    expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).toMatchObject({...oldStats, multiplayerWins: 7});
    expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 550, privateBlob: "x".repeat(100_000)});
  } finally {spy.mockRestore();}
});

it("preserves liveness and defaults for an account with no selected public fields", async () => {
  await db.doc(`users/${OWNER}`).set({coins: 550});
  await refreshOldSnapshot();
  expect((await db.doc(`leaderboard/${OWNER}`).get()).data()).toMatchObject({userId: OWNER, subjectUserId: OWNER,
    username: "Player", level: 1, xp: 0, totalWins: 0, bestStreak: 0, multiplayerWins: 0});
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual({coins: 550});
});

it.each([false, true])("re-reads canonical authority after an SDK abort (deleted %s)", async deleted => {
  await db.doc(`leaderboard/${OWNER}`).delete();
  /** Actual SDK rollback and retry are exercised after the first callback has queued its public row. */
  const original = db.runTransaction.bind(db);
  /** Only the final attempt may publish anything from its own fresh canonical snapshot. */
  let attempts = 0;
  /** Injects a retryable abort, then changes authority before the second attempt reads it. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    attempts++;
    if (attempts === 2) {
      if (deleted) await db.doc(`users/${OWNER}`).delete();
      else await db.doc(`users/${OWNER}`).update({username: "Retry current name", avatarUrl: FieldValue.delete(),
        stats: {level: 4, xp: 200, totalWins: 11, bestStreak: 8, multiplayerWins: 9}, coins: 550});
    }
    /** The real writer callback reads and queues its replacement within this real transaction attempt. */
    const result = await operation(transaction);
    if (attempts === 1) throw Object.assign(new Error("Fixture retryable transaction abort"), {code: 10});
    return result;
  }, options));
  try {
    await refreshOldSnapshot();
    expect(attempts).toBe(2);
    /** A first-attempt row must not survive the SDK's actual rollback. */
    const row = await db.doc(`leaderboard/${OWNER}`).get();
    if (deleted) {
      expect(row.exists).toBe(false);
      expect((await db.doc(`users/${OWNER}`).get()).exists).toBe(false);
    } else {
      expect(row.data()).toMatchObject({username: "Retry current name", level: 4, xp: 200, totalWins: 11, bestStreak: 8, multiplayerWins: 9});
      expect(row.data()).not.toHaveProperty("avatarUrl");
      expect((await db.doc(`users/${OWNER}`).get()).data()?.coins).toBe(550);
    }
  } finally {spy.mockRestore();}
});
