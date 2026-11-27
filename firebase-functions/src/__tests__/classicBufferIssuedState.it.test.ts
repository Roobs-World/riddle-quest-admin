import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {ensureAuthoritativeSession} from "../gameplay/sessions/singlePlayerSession";
import {getSinglePlayerContentKey} from "../gameplay/sessions/singlePlayerAnswerPolicy";
import {getClassicRiddleBuffer} from "../daily/classicRiddleBuffer";

/** Current reconciliation and catalog selection are isolated; issuance, reads and account leases remain real. */
const mockCurrent = jest.fn();
/** Catalog gaps can be introduced independently of canonical issuance. */
const mockPlayable = jest.fn();
jest.mock("../daily/dailyChallenge", () => ({getCurrentClassicRiddle: {run: (...args: unknown[]) => mockCurrent(...args)}}));
jest.mock("../gameplay/content/classicRiddleFallback", () => ({getPlayableClassicRiddle: (...args: unknown[]) => mockPlayable(...args)}));
/** Only this private loopback demo emulator may hold the fixture account and sessions. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** A fixed private account owns each issued content binding and mutation lease. */
const OWNER = `facebook_${"f".repeat(40)}`;
/** Real Admin SDK instance supplies every session issuance transaction. */
let db: FirebaseFirestore.Firestore;
/** Current session token is established through the normal token-only API. */
let currentToken: string;
/** Only this fixture's account and deletion-lease subtrees are removed. */
const clear = async () => {await db.recursiveDelete(db.doc(`users/${OWNER}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${OWNER}`));};
/** Fixture references use the same opaque hash as canonical token/content bindings. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Authored content is trusted by issuance rather than supplied as a gameplay outcome. */
const riddle = (index: number) => ({riddleId: `classic-${index}`, text: "What has keys?", answer: "piano"});
/** Exact canonical binding lets observation and abort fixtures target one successor. */
const bindingPath = (index: number) => `users/${OWNER}/singlePlayerSessionBindings/${hash(getSinglePlayerContentKey(riddle(index), "classic", "en"))}`;
/** Exact private session path contains only this fixture's opaque identity. */
const sessionPath = (token: string) => `users/${OWNER}/singlePlayerSessions/${hash(token)}`;
/** Normal issuance is used to seed resumed session states. */
const issue = (index: number) => ensureAuthoritativeSession(OWNER, "classic", `classic-${index}`, "en",
  getSinglePlayerContentKey(riddle(index), "classic", "en"), `classic:${index}`, "piano", {classicIndex: index});
/** The actual callable wrapper retains request/response validation and its account-operation lease. */
const load = () => getClassicRiddleBuffer.run({auth: {uid: OWNER, token: {}}, data: {locale: "en", includeHintRecovery: true, includeGuessRecovery: true}} as never);
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear(); mockCurrent.mockReset(); mockPlayable.mockReset();
  await db.doc(`users/${OWNER}`).set({coins: 550, hasPurchasedApp: true, progress: {classicIndex: 1}, stats: {multiplayerWins: 9}});
  currentToken = await issue(1);
  mockCurrent.mockResolvedValue({classicIndex: 1, challenge: {questions: [{riddleId: "classic-1", text: "What has keys?", answerLength: 5,
    sessionToken: currentToken, questionNumber: 1, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}], totalQuestions: 1}});
  mockPlayable.mockImplementation(async (index: number) => ({contentLocale: "en", riddle: riddle(index)}));
});
afterAll(clear);

it.each([false, true])("returns committed future state with resumed %s without fetching the three documents again", async resumed => {
  if (resumed) await Promise.all([2, 3, 4].map(issue));
  /** Existing document SDK method is forwarded so the observer cannot fabricate fewer reads. */
  const prototype = Object.getPrototypeOf(db.doc(sessionPath(currentToken))), original = prototype.get;
  /** Only standalone private-session reads contribute to this count; transaction reads stay real. */
  let directReads = 0;
  /** Actual SDK snapshots are observed beneath the callable and lease. */
  const spy = jest.spyOn(prototype, "get").mockImplementation(function(this: FirebaseFirestore.DocumentReference, ...args: unknown[]) {
    if (this.path.startsWith(`users/${OWNER}/singlePlayerSessions/`)) directReads++;
    return original.apply(this, args);
  });
  try {
    /** Canonical account must not advance or change economy while future content is prepared. */
    const profile = (await db.doc(`users/${OWNER}`).get()).data();
    /** Public schema validates prepared tokens, expiries and recovered status. */
    const result = await load();
    expect(directReads).toBe(1);
    expect(result.riddles.map(item => item.classicIndex)).toEqual([1, 2, 3, 4]);
    expect(result.riddles.every(item => item.expiresAtMs > Date.now() && item.question.attemptsUsed === 0)).toBe(true);
    expect(result).not.toHaveProperty("state");
    expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
    for (const item of result.riddles.slice(1)) {
      /** Persisted private state matches the token and expiry projected by the committed issuance. */
      const state = (await db.doc(sessionPath(item.question.sessionToken)).get()).data()!;
      expect(state).toMatchObject({classicIndex: item.classicIndex, answer: "piano", locale: "en", terminal: false});
      expect(state.expiresAt.toMillis()).toBe(item.expiresAtMs);
    }
  } finally {spy.mockRestore();}
});

it("shares the same canonical successor tokens across concurrent real buffers", async () => {
  /** Four lease-protected requests contend on the same three content bindings. */
  const results = await Promise.all(Array.from({length: 4}, load));
  expect(results.every(result => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 550, progress: {classicIndex: 1}, stats: {multiplayerWins: 9}});
  expect((await db.collection(`users/${OWNER}/singlePlayerSessions`).get()).size).toBe(4);
});

it("projects existing hint and attempt recovery from the issuance snapshot", async () => {
  /** Existing state is genuine private authority created through normal issuance. */
  const token = await issue(2);
  await db.doc(sessionPath(token)).update({attempts: 1, hintRevealedIndices: [0]});
  expect((await load()).riddles[1]?.question).toMatchObject({sessionToken: token, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}]});
});

it("keeps first-gap ordering without issuing a later entitlement", async () => {
  mockPlayable.mockImplementation(async (index: number) => index === 3 ? undefined : {contentLocale: "en", riddle: riddle(index)});
  expect((await load()).riddles.map(item => item.classicIndex)).toEqual([1, 2]);
  expect((await db.doc(bindingPath(4)).get()).exists).toBe(false);
});

it("keeps an unavailable current question from issuing successors", async () => {
  mockCurrent.mockResolvedValue({error: "content unavailable"});
  expect((await load()).riddles).toEqual([]);
  expect(mockPlayable).not.toHaveBeenCalled();
  expect((await db.doc(bindingPath(2)).get()).exists).toBe(false);
});

it("projects the retry's canonical state after an actual SDK abort", async () => {
  /** Resume gives both attempts the same opaque identity while recovery fields change between them. */
  const token = await issue(2), original = db.runTransaction.bind(db);
  /** Only the targeted successor transaction is aborted; account leases and other issuance stay original. */
  let attempts = 0;
  /** Read seam detects the canonical binding without replacing any SDK snapshot or commit. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    /** Restored after each SDK attempt to avoid nested wrappers. */
    const get = transaction.get.bind(transaction);
    /** Callback ownership identifies the targeted transaction even when siblings run concurrently. */
    let targeted = false;
    transaction.get = async (...args: Parameters<typeof get>) => {
      if ((args[0] as FirebaseFirestore.DocumentReference).path === bindingPath(2)) {
        targeted = true; attempts++;
        if (attempts === 2) await db.doc(sessionPath(token)).update({attempts: 1, hintRevealedIndices: [0]});
      }
      return get(...args);
    };
    try {
      /** Actual issuance callback chooses its snapshot in the real transaction attempt. */
      const result = await operation(transaction);
      if (targeted && attempts === 1) throw Object.assign(new Error("Fixture retryable issuance abort"), {code: 10});
      return result;
    } finally {transaction.get = get;}
  }, options));
  try {
    expect((await load()).riddles[1]?.question).toMatchObject({sessionToken: token, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}]});
    expect(attempts).toBe(2);
  } finally {spy.mockRestore();}
});

it("fails a corrupt content binding instead of publishing a successor snapshot", async () => {
  await db.doc(bindingPath(2)).set({sessionToken: "bad"});
  /** Tracks original SDK transaction promises so the deliberately failing baseline cannot outlive fixture cleanup. */
  const original = db.runTransaction.bind(db), operations: Promise<unknown>[] = [];
  /** Every promise still executes through the actual Admin SDK. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => {
    /** Includes account leases and all sibling issuance transactions started by this request. */
    const pending = original(operation, options); operations.push(pending); return pending;
  });
  try {await expect(load()).rejects.toMatchObject({code: "internal"});}
  finally {await Promise.allSettled(operations); spy.mockRestore();}
});

it("holds the account lease until delayed sibling issuance settles after a required failure", async () => {
  /** A barrier distinguishes waiting for all writes from returning on the first rejected promise. */
  let release: () => void = () => {}, reached: () => void = () => {};
  /** Held issuance cannot proceed to its binding read or commit until cleanup releases it. */
  const barrier = new Promise<void>(resolve => {release = resolve;});
  /** Observation begins only after a genuine sibling transaction has reached the barrier. */
  const started = new Promise<void>(resolve => {reached = resolve;});
  /** Original SDK retains all transaction and account-lease behavior. */
  const original = db.runTransaction.bind(db);
  /** Original transaction promises must all settle even when the old handler returns early in the red probe. */
  const operations: Promise<unknown>[] = [];
  /** Tracks original SDK lifetime without changing its reads, retries or writes. */
  const tracked: typeof db.runTransaction = (operation, options) => {
    /** This promise covers all original SDK attempts and their final commit or failure. */
    const pending = original(operation, options); operations.push(pending); return pending;
  };
  /** Targeted get wrappers introduce one deterministic required failure and one delayed sibling. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => tracked(async transaction => {
    /** Restored before the SDK reuses this transaction object. */
    const get = transaction.get.bind(transaction);
    transaction.get = async (...args: Parameters<typeof get>) => {
      /** Reads are identified by their canonical document path, without reading or logging account values. */
      const path = (args[0] as FirebaseFirestore.DocumentReference).path;
      if (path === bindingPath(2)) {await started; throw Object.assign(new Error("Fixture required issuance failure"), {code: 3});}
      if (path === bindingPath(3)) {reached(); await barrier;}
      return get(...args);
    };
    try {return await operation(transaction);} finally {transaction.get = get;}
  }, options));
  /** Final response ownership is observed independently of eventual sibling transaction completion. */
  let settled = false;
  /** Immediate rejection handler keeps the injected failure from becoming unhandled. */
  const pending = load().catch(error => {settled = true; return error;});
  try {
    await started; await new Promise(resolve => setTimeout(resolve, 150));
    expect(settled).toBe(false);
    expect((await db.collection(`jestAccountDeletionTombstones/${OWNER}/activeOperations`).get()).size).toBe(1);
    release();
    expect(await pending).toMatchObject({message: "Fixture required issuance failure"});
    expect((await db.collection(`jestAccountDeletionTombstones/${OWNER}/activeOperations`).get()).empty).toBe(true);
    expect((await db.doc(bindingPath(3)).get()).exists).toBe(true);
  } finally {release(); await pending; await Promise.allSettled(operations); spy.mockRestore();}
});
