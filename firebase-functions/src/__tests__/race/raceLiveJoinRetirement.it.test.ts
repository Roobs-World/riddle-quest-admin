import {initializeApp, deleteApp, type App} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {retireLiveRaceJoinForUser} from "../../race/raceLiveRetirement";
import {liveJoinIntentRef} from "../../race/raceLiveJoinIntent";
import {requestDocumentId} from "../../race/raceSetupService";

/** This suite mutates only an owned loopback demo and two fixture accounts. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual Admin SDK transactions exercise intent publication, replay, conditional leave and settlement. */
let db: FirebaseFirestore.Firestore;
/** Only this suite owns and terminates its SDK client. */
let app: App;
/** SDK reads started alongside an expected authorization failure must settle before Jest tears down modules. */
const ownedReads = new Set<Promise<unknown>>();
/** Original and replacement requests are deliberately distinct under the same authenticated identity. */
const FIRST = "first-owned-join", NEXT = "newer-owned-join";
/** Approved modern join records its immutable identity under the account. */
const join = (owner = A, requestId = FIRST, nowMs = NOW, extra = {}) => joinLiveRaceForUser(owner,
  {locale: "en", categoryId: "history", requestId, retirementAware: true, expectedOwnerId: owner, ...extra}, {db, nowMs});
/** Retirement never accepts a browser-selected ticket. */
const retire = (owner = A, requestId = FIRST, nowMs = NOW + 10) => retireLiveRaceJoinForUser(owner,
  {requestId, expectedOwnerId: owner}, {db, nowMs});
/** Complete private state dimensions make accidental forfeiture or economy writes observable. */
const state = async () => {
  /** Only ticket, match, signal and account collections are gameplay authority. */
  const result: Record<string, unknown> = {};
  for (const name of ["liveRaceTickets", "liveRaceMatches", "liveRaceSignals", "liveRacePlayers", "liveRaceQueues"])
    result[name] = (await db.collection(name).get()).docs.map(doc => ({id: doc.id, version: doc.updateTime?.valueOf(), data: doc.data()}));
  for (const owner of [A, B]) {
    /** Account versions must not change on superseded retirement. */
    const profile = await db.doc(`users/${owner}`).get(); result[owner] = {version: profile.updateTime?.valueOf(), data: profile.data()};}
  return result;
};
/** No other project or account shares this test's data or cleanup. */
const clear = async () => {
  for (const name of ["localizedRiddles", "liveRaceTickets", "liveRaceMatches", "liveRaceSignals", "liveRacePlayers", "liveRaceQueues"]) await db.recursiveDelete(db.collection(name));
  for (const owner of [A, B]) {await db.recursiveDelete(db.doc(`users/${owner}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));}
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Owned loopback demo required");
  app = initializeApp({projectId: PROJECT}, "live-join-retirement-sdk");
  /** Delegation retains real SDK transactions and records only their still-owned read promises. */
  const real = getFirestore(app);
  db = new Proxy(real, {
    /** Delegates database properties while retaining pending transaction reads. */
    get(target, key) {
    if (key === "runTransaction") return (operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) => target.runTransaction(tx => operation(new Proxy(tx, {
      /** Delegates original SDK methods without altering results or scheduling. */
      get(transaction, method) {
      /** Real SDK read results remain untouched; both settlements release observation ownership. */
      const value = Reflect.get(transaction, method, transaction);
      if (method === "get" || method === "getAll") return (...args: unknown[]) => {
        /** Pending read may finish after its parallel authorization sibling rejects. */
        const promise: Promise<unknown> = value.apply(transaction, args);
        ownedReads.add(promise); void promise.then(() => ownedReads.delete(promise), () => ownedReads.delete(promise)); return promise;
      };
      return typeof value === "function" ? value.bind(transaction) : value;
    }})));
    /** Other database calls bind directly to the actual SDK client. */
    const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value;
  }});
});
beforeEach(async () => {
  await clear();
  /** Balanced reviewed source creates real public and private seats through production authority. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/retirement-${index}`), {
    riddleId: `retirement-${index}`, canonicalRiddleId: `history:${index}`, text: `Original distinct question ${index} follows its own path`, answer: `a${String(index).padStart(6, "0")}`,
    categoryId: "history", difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
  for (const owner of [A, B]) batch.set(db.doc(`users/${owner}`), {username: owner === A ? "Alice" : "Bob", coins: 500}); await batch.commit();
});
afterEach(async () => {await Promise.allSettled([...ownedReads]); expect(ownedReads.size).toBe(0);});
afterAll(async () => {await clear(); await Promise.allSettled([...ownedReads]); await db.terminate(); await deleteApp(app);});

it.each(["public", "private", "matched"])("superseded %s cleanup preserves the recovered canonical ticket", async kind => {
  /** The original join has committed even if its client receipt is still delayed. */
  const extra = kind === "private" ? {createChallenge: true} : {}, original = await join(A, FIRST, NOW, extra);
  if (kind === "matched") await join(B, "rival-owned-join", NOW + 1);
  /** A newer explicit request recovers the same active server ticket. */
  const recovered = await join(A, NEXT, NOW + 2, extra); expect(recovered.ticketId).toBe(original.ticketId);
  /** Capture authority after the legitimate recovery writes. */
  const before = await state();
  expect(await retire(A, FIRST, NOW + 3)).toEqual({status: "superseded"}); expect(await state()).toEqual(before);
  expect((await liveJoinIntentRef(db, A, FIRST).get()).data()?.retired).toBe(true);
  expect((await db.doc(`liveRaceTickets/${original.ticketId}`).get()).data()?.activeJoinId).toBe(requestDocumentId(A, NEXT));
});
it("an old join retry cannot reclaim a newer accepted seat", async () => {
  /** Both identities refer to the same account's canonical active game. */
  const original = await join(); await join(A, NEXT, NOW + 1);
  expect((await join(A, FIRST, NOW + 2)).ticketId).toBe(original.ticketId);
  expect((await db.doc(`liveRaceTickets/${original.ticketId}`).get()).data()?.activeJoinId).toBe(requestDocumentId(A, NEXT));
  expect(await retire()).toEqual({status: "superseded"});
});
it("retirement before join publication prevents late creation and replay", async () => {
  /** Unknown original intent can be retired without guessing an account ticket. */
  const before = await state(); expect(await retire()).toEqual({status: "retired"}); expect(await state()).toEqual(before);
  await expect(join()).rejects.toMatchObject({code: "failed-precondition"}); expect(await state()).toEqual(before);
  /** Marker replay is read-only, including its account-owned receipt version. */
  const marker = await liveJoinIntentRef(db, A, FIRST).get(); await retire(A, FIRST, NOW + 20);
  expect((await liveJoinIntentRef(db, A, FIRST).get()).updateTime?.valueOf()).toBe(marker.updateTime?.valueOf());
  expect((await join(A, NEXT, NOW + 21)).phase).toBe("searching"); expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
});
it("closed original joins cannot follow a newly allocated account pointer", async () => {
  /** Authoritative cancellation precedes the replacement start. */
  const original = await join(); expect(await retire()).toEqual({status: "retired"});
  /** Fresh intent creates a different ticket after cancellation. */
  const replacement = await join(A, NEXT, NOW + 20); expect(replacement.ticketId).not.toBe(original.ticketId);
  await expect(join(A, FIRST, NOW + 21)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc(`liveRacePlayers/${requestDocumentId(A, "active-live-race")}`).get()).data()?.ticketId).toBe(replacement.ticketId);
});
it.each([false, true])("retirement replay does not duplicate signals or rewards (matched=%s)", async matched => {
  /** Original owned join retired once in either searching or matched state. */
  const original = await join();
  if (matched) {
    /** Human opponent paired with the original join before retirement. */
    const rival = await join(B, "rival-owned-join", NOW + 1);
    /** Canonical opponent question answered to establish reward eligibility. */
    const riddle = (await db.doc(`liveRaceMatches/${original.ticketId}`).get()).data()!.runs[1].riddles[0];
    await updateLiveRaceForUser(B, {ticketId: rival.ticketId, action: "guess", requestId: "retirement-rival-played",
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: NOW + 6000});
  }
  expect(await retire(A, FIRST, NOW + 7000)).toEqual({status: "retired"});
  /** The existing settlement authority may grant the rival exactly once after an active forfeit. */
  const before = await state(), marker = await liveJoinIntentRef(db, A, FIRST).get();
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(matched ? 600 : 500);
  expect(await retire(A, FIRST, NOW + 8000)).toEqual({status: "retired"}); expect(await state()).toEqual(before);
  expect((await liveJoinIntentRef(db, A, FIRST).get()).updateTime?.valueOf()).toBe(marker.updateTime?.valueOf());
});
it("authentication replacement fails before writing either account", async () => {
  await join();
  /** Expected identity is a precondition, never an authority to select another account. */
  const before = await state();
  await expect(retireLiveRaceJoinForUser(B, {requestId: FIRST, expectedOwnerId: A}, {db, nowMs: NOW + 1})).rejects.toMatchObject({code: "permission-denied"});
  await expect(joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: NEXT, retirementAware: true, expectedOwnerId: A}, {db, nowMs: NOW + 1})).rejects.toMatchObject({code: "permission-denied"});
  expect(await state()).toEqual(before); expect((await db.collection(`users/${B}/liveRaceJoinIntents`).get()).empty).toBe(true);
});
it("same request text under another account cannot select the original seat", async () => {
  await join();
  /** Caller path hashing binds the request to authenticated account B. */
  const before = await state(); expect(await retire(B)).toEqual({status: "retired"}); expect(await state()).toEqual(before);
  expect((await liveJoinIntentRef(db, A, FIRST).get()).data()?.retired).toBe(false);
});
it("a failed conditional leave remains recoverable after the durable marker commits", async () => {
  await join();
  /** The first transaction commits the marker; a transient failure precedes the separate leave. */
  let calls = 0;
  await expect(retireLiveRaceJoinForUser(A, {requestId: FIRST}, {db, nowMs: NOW + 1, authorize: async () => {if (++calls === 2) throw new HttpsError("unavailable", "Controlled transport failure");}})).rejects.toMatchObject({code: "unavailable"});
  expect((await liveJoinIntentRef(db, A, FIRST).get()).data()?.retired).toBe(true);
  expect(await retire()).toEqual({status: "retired"});
});
it("new recovery after a failed leave supersedes its later retry", async () => {
  /** This is the real authority counterpart of the injected native-browser race. */
  const original = await join();
  /** Second authorization runs in the conditional leave transaction after the durable marker. */
  let calls = 0;
  await expect(retireLiveRaceJoinForUser(A, {requestId: FIRST}, {db, nowMs: NOW + 1, authorize: async () => {if (++calls === 2) throw new HttpsError("unavailable", "Controlled failure");}})).rejects.toMatchObject({code: "unavailable"});
  expect((await join(A, NEXT, NOW + 2)).ticketId).toBe(original.ticketId);
  /** A delayed request must re-read the claim rather than apply a captured seat snapshot. */
  const before = await state(); expect(await retire(A, FIRST, NOW + 3)).toEqual({status: "superseded"}); expect(await state()).toEqual(before);
});
it("original selectors are immutable under a stable tracked request", async () => {
  await join();
  /** Request reuse must not transfer its retained ticket or claim to another game kind. */
  const before = await state(); await expect(join(A, FIRST, NOW + 1, {createChallenge: true})).rejects.toMatchObject({code: "invalid-argument"}); expect(await state()).toEqual(before);
});
it("malformed retained deck cannot block an owned unpaired retirement", async () => {
  /** Independent owner and join facts suffice to cancel unusable lobby content. */
  const original = await join(A, FIRST, NOW, {createChallenge: true}), ref = db.doc(`liveRaceTickets/${original.ticketId}`);
  /** Only future immutable content is corrupted; source catalog and ownership stay intact. */
  const riddles = (await ref.get()).data()!.run.riddles.map((value: Record<string, unknown>, index: number) => index === 14 ? {...value, answer: "x".repeat(129)} : value);
  await ref.update({"run.riddles": riddles}); expect(await retire()).toEqual({status: "retired"});
  expect((await ref.get()).data()).toMatchObject({cancelled: true, run: {riddles}});
  expect((await db.doc(`users/${A}`).get()).data()?.coins).toBe(500);
});
it("accepted invitation recovery preserves the newer recipient claim", async () => {
  /** Creator and recipient use the same ownership protocol on distinct server seats. */
  const creator = await join(A, FIRST, NOW, {createChallenge: true});
  /** Actual acceptance publishes the recipient's own original join receipt atomically. */
  const original = await join(B, FIRST, NOW + 1, {challengeId: creator.challengeId});
  expect((await join(B, NEXT, NOW + 2, {challengeId: creator.challengeId})).ticketId).toBe(original.ticketId);
  /** Superseded cleanup must not settle or modify this shared private match. */
  const before = await state(); expect(await retire(B, FIRST, NOW + 3)).toEqual({status: "superseded"}); expect(await state()).toEqual(before);
});
it("a pinned intent with a missing original ticket cannot create another game", async () => {
  /** TTL or account maintenance may remove the original document before its receipt. */
  const original = await join(); await db.doc(`liveRaceTickets/${original.ticketId}`).delete();
  /** A known original identity is never treated as a new unaccepted request. */
  const before = await state(); await expect(join()).rejects.toMatchObject({code: "not-found"}); expect(await state()).toEqual(before);
});
it("deleted accounts cannot publish retirement markers", async () => {
  await join(); await db.doc(`jestAccountDeletionTombstones/${A}`).set({deleted: true});
  /** Deletion is read again before either retirement transaction can mutate state. */
  const before = await state(); await expect(retire()).rejects.toThrow("account-deleted"); expect(await state()).toEqual(before);
  expect((await liveJoinIntentRef(db, A, FIRST).get()).data()?.retired).toBe(false);
});
