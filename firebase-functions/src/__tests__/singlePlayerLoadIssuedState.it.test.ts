import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getDailyDate} from "../../../src/core/validation/dailyCalendar.js";
import {getCurrentClassicRiddle, getCurrentDailyChallenge} from "../daily/dailyChallenge";
import {ensureAuthoritativeSession, submitAuthoritativeGuess, finalizeAuthoritativeSession} from "../gameplay/singlePlayerSession";
import {baseAttemptLimit} from "../gameplay/singlePlayerGuessTransition";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";

/** Catalog selection is controlled; current loaders, issuance, completion and account leases stay real. */
const mockPlayable = jest.fn();
jest.mock("../gameplay/classicRiddleFallback", () => ({...jest.requireActual("../gameplay/classicRiddleFallback"), getPlayableClassicRiddle: (...args: unknown[]) => mockPlayable(...args)}));
// Early recovery is isolated so terminal cases exercise the post-issuance branch, not the earlier binding-recovery branch.
jest.mock("../gameplay/singlePlayerTerminalRecovery", () => ({recoverPendingAuthoritativeCompletion: async () => false}));
jest.mock("../daily/dailyRolloverRecovery", () => ({reconcilePreviousDailyBinding: async (_uid: string, user: unknown) => user}));
// Derived ranking and content-generation side effects are outside the canonical load/completion fixture.
jest.mock("../gameplay/leaderboard", () => ({updateLeaderboardEntry: async () => undefined}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: async () => undefined}));
/** Fixture writes are restricted to a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** This account and its hashed receipts are the only canonical fixture records removed. */
const OWNER = `jest_${"e".repeat(40)}`;
/** Real SDK provides canonical snapshots, commits and retries. */
let db: FirebaseFirestore.Firestore;
/** Both targets share the same regional entitlement calendar. */
let day: string;
/** Modes use the existing immutable public content shape. */
type Mode = "classic" | "challenge";
/** Opaque identities match production document reference construction. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Canonical catalog data is authored, never supplied by a gameplay client. */
const riddle = (mode: Mode, index = 1) => ({riddleId: mode === "classic" ? `classic-${index}` : `daily-${day}`, text: "What has keys?", answer: "piano", ...(mode === "challenge" ? {challengeKey: day} : {})});
/** Exact private reference targets only this fixture's session. */
const sessionPath = (token: string) => `users/${OWNER}/singlePlayerSessions/${hash(token)}`;
/** Exact content binding identifies the issuance transaction for retry observation. */
const bindingPath = (mode: Mode) => `users/${OWNER}/singlePlayerSessionBindings/${hash(getSinglePlayerContentKey(riddle(mode), mode, "en"))}`;
/** All seed states are created through the normal canonical issuance API. */
const issue = (mode: Mode) => ensureAuthoritativeSession(OWNER, mode, riddle(mode).riddleId, "en", getSinglePlayerContentKey(riddle(mode), mode, "en"),
  getSinglePlayerCompletionKey(mode, mode === "classic" ? 1 : day), "piano", mode === "classic" ? {classicIndex: 1} : {challengeDate: day});
/** Real callable wrappers validate requests/responses and hold account-operation leases. */
const load = (mode: Mode, token?: string) => (mode === "classic" ? getCurrentClassicRiddle : getCurrentDailyChallenge).run({auth: {uid: OWNER, token: {}},
  data: {locale: "en", ...(mode === "classic" ? {includeClassicIndex: true} : {}), includeEvaluation: true, includeHintRecovery: true, includeGuessRecovery: true,
    ...(token ? {sessionToken: token, riddleId: riddle(mode).riddleId} : {})}} as never);
/** Observer forwards original SDK reads and counts only standalone private-session fetches. */
async function observedLoad(mode: Mode, token?: string) {
  /** Existing SDK method remains responsible for producing every snapshot. */
  const prototype = Object.getPrototypeOf(db.doc(`users/${OWNER}`)), original = prototype.get;
  /** Transaction reads are independent and excluded from this standalone count. */
  let directReads = 0;
  /** Nothing in this seam replaces snapshots or avoids a requested read. */
  const spy = jest.spyOn(prototype, "get").mockImplementation(function(this: FirebaseFirestore.DocumentReference, ...args: unknown[]) {
    if (this.path.startsWith(`users/${OWNER}/singlePlayerSessions/`)) directReads++;
    return original.apply(this, args);
  });
  try {return {result: await load(mode, token), directReads};} finally {spy.mockRestore();}
}
/** Own terminal receipt identities are deterministic and bounded to both modes and outcomes. */
const receiptIds = new Set<string>();
/** Removes only this fixture's account, deletion leases, dated content and known receipt identities. */
const clear = async () => {
  await db.recursiveDelete(db.doc(`users/${OWNER}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${OWNER}`));
  await Promise.all([...receiptIds].map(id => db.doc(`gameCompletionReceipts/${id}`).delete())); receiptIds.clear();
  if (day) await db.doc(`localizedRiddles/en/riddles/daily-${day}`).delete();
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear(); day = getDailyDate("en"); mockPlayable.mockReset();
  await db.doc(`users/${OWNER}`).set({userId: OWNER, coins: 550, hasPurchasedApp: true, progress: {classicIndex: 1}, stats: {gamesPlayed: 9, multiplayerWins: 2}});
  await db.doc(`localizedRiddles/en/riddles/daily-${day}`).set({...riddle("challenge"), challengeKey: day});
  mockPlayable.mockImplementation(async (index: number) => ({contentLocale: "en", riddle: riddle("classic", index)}));
});
afterAll(clear);

it.each((["classic", "challenge"] as const).flatMap(mode => [false, true].map(resumed => ({mode, resumed}))))(
  "projects $mode resumed $resumed without a standalone issued-session read", async ({mode, resumed}) => {
  if (resumed) await issue(mode);
  /** Read-only load must preserve the exact account document. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  /** Actual response contains only the existing public projection. */
  const {result, directReads} = await observedLoad(mode);
  expect(directReads).toBe(0);
  expect(result.challenge?.questions[0]).toMatchObject({riddleId: riddle(mode).riddleId, attemptsUsed: 0, awaitingContinue: false});
  expect(result).not.toHaveProperty("state");
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
  /** Persisted canonical state agrees with the opaque identity selected by the response. */
  const stored = await db.doc(sessionPath(result.challenge!.questions[0]!.sessionToken!)).get();
  expect(stored.data()).toMatchObject({gameMode: mode, answer: "piano", locale: "en", terminal: false});
  expect(stored.data()!.expiresAt.toMillis()).toBeGreaterThan(Date.now());
});

it.each(["classic", "challenge"] as const)("retains explicit %s resume-token validation and one standalone read", async mode => {
  /** Client resume validation remains separate from selecting the current entitlement. */
  const token = await issue(mode), {result, directReads} = await observedLoad(mode, token);
  expect(directReads).toBe(1); expect(result.challenge?.questions[0]?.sessionToken).toBe(token);
  await expect(load(mode, "wrong-opaque-token-at-least-20-characters")).rejects.toMatchObject({code: "permission-denied"});
});

it.each(["classic", "challenge"] as const)("projects resumed %s hints and attempts from committed state", async mode => {
  /** Recovery data is canonical private state updated independently of the public loader. */
  const token = await issue(mode); await db.doc(sessionPath(token)).update({attempts: 1, hintRevealedIndices: [0]});
  expect((await load(mode)).challenge?.questions[0]).toMatchObject({sessionToken: token, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}]});
});

it.each((["classic", "challenge"] as const).flatMap(mode => [false, true].map(win => ({mode, win}))))(
  "reconciles real terminal $mode win $win and rotates only retryable entitlements", async ({mode, win}) => {
  /** Real accepted guesses establish terminal state and its pending completion binding. */
  const token = await issue(mode), guesses = win ? ["piano"] : ["organ", "crane", "flute", "drums", "cello", "viola"].slice(0, baseAttemptLimit(mode));
  for (const [index, guess] of guesses.entries()) await submitAuthoritativeGuess(OWNER, {gameMode: mode, riddleId: riddle(mode).riddleId, sessionToken: token, guess, requestId: `load-guess-${index}`});
  if (!win) await finalizeAuthoritativeSession(OWNER, mode, riddle(mode).riddleId, token);
  /** Completion receipt identity follows the normal win or per-token loss policy. */
  const completionKey = getSinglePlayerCompletionKey(mode, mode === "classic" ? 1 : day);
  receiptIds.add(hash(`${OWNER}\0${mode}\0${win ? completionKey : `${completionKey}:loss:${token}`}`));
  /** Real completion updates progress and economy, then the actual loader reissues if needed. */
  const {result, directReads} = await observedLoad(mode);
  expect(directReads).toBe(0);
  if (win && mode === "challenge") expect(result).toMatchObject({hasCompletedToday: true, questionsCompleted: 1});
  else {
    expect(result.challenge?.questions[0]).toMatchObject({riddleId: mode === "classic" && win ? "classic-2" : riddle(mode).riddleId, attemptsUsed: 0});
    expect(result.challenge?.questions[0]?.sessionToken).not.toBe(token);
  }
  /** Replay cannot double-grant the reconciled completion. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  expect(profile).toMatchObject({hasPurchasedApp: true, stats: {gamesPlayed: 10, multiplayerWins: 2}, progress: {classicIndex: mode === "classic" && win ? 2 : 1}});
  await load(mode); expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
});

it.each(["classic", "challenge"] as const)("projects the fresh %s issuance attempt after actual SDK retry", async mode => {
  /** A genuine resumed session provides a fixed identity whose recovery fields can change. */
  const token = await issue(mode), original = db.runTransaction.bind(db);
  /** Account-lease transactions remain unaffected; only this content binding is targeted. */
  let attempts = 0;
  /** Actual SDK handles rollback and retry; observed reads and final commits are forwarded. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    /** Per-attempt read wrapper is restored before transaction reuse. */
    const get = transaction.get.bind(transaction);
    /** Only the issuance callback is eligible for the injected first-attempt abort. */
    let targeted = false;
    transaction.get = async (...args: Parameters<typeof get>) => {
      if ((args[0] as FirebaseFirestore.DocumentReference).path === bindingPath(mode)) {
        targeted = true; attempts++;
        if (attempts === 2) await db.doc(sessionPath(token)).update({attempts: 1, hintRevealedIndices: [0]});
      }
      return get(...args);
    };
    try {
      /** This is the original production issuance callback and its canonical SDK snapshots. */
      const result = await operation(transaction);
      if (targeted && attempts === 1) throw Object.assign(new Error("Fixture retryable current issuance abort"), {code: 10});
      return result;
    } finally {transaction.get = get;}
  }, options));
  try {
    expect((await load(mode)).challenge?.questions[0]).toMatchObject({sessionToken: token, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}]});
    expect(attempts).toBe(2);
  } finally {spy.mockRestore();}
});
