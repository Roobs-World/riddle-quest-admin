import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {LIVE_RACE_WAIT_MS, type LiveRaceView} from "../../../../src/races/contracts/index.js";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {requestDocumentId} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";

/** Distinct deterministic Jest accounts used for public pairing and ownership checks. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
/** Fixed server time shared by joins, leases and expiry boundary assertions. */
const NOW = 1_800_000_000_000;
/** Isolated emulator database used by the production matchmaking functions. */
let db: FirebaseFirestore.Firestore;

/** Removes race, account and content fixtures plus deterministic deletion guards. */
async function clear() {
  for (const path of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "liveRaceSignals", "users", "localizedRiddles/en/riddles"])
    await db.recursiveDelete(db.collection(path));
  await Promise.all([A, B, C].map(userId => getJestAccountDeletionRef(db, userId).delete()));
}
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Local Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-live"});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Atomic fixture batch containing the reviewed category deck and player profiles. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const userId of [A, B, C]) batch.set(db.doc(`users/${userId}`), {username: userId === A ? "Alice" : "Bob", coins: 100});
  await batch.commit();
});
afterAll(async () => {await clear(); await db.terminate();});

/** Starts an authenticated resumable public search with a bounded bot fallback. */
const join = (userId: string, requestId: string, nowMs = NOW) => joinLiveRaceForUser(userId,
  {locale: "en", categoryId: "history", requestId, waitForPlayer: true, retirementAware: true}, {db, nowMs});
/** Polls or leaves the supplied owned seat at a controlled server time. */
const update = (userId: string, view: LiveRaceView, nowMs: number, action: "poll" | "leave" = "poll", requestId = `update-${nowMs}`) =>
  updateLiveRaceForUser(userId, {ticketId: view.ticketId, action, requestId}, {db, nowMs});
/** Attempts exact recovery of the original public player-wait ticket. */
const resume = (userId: string, view: LiveRaceView, requestId: string, nowMs: number) => joinLiveRaceForUser(userId,
  {locale: "en", categoryId: "history", waitForPlayer: true, resumeTicketId: view.ticketId, requestId, retirementAware: true}, {db, nowMs});

it("pairs a real player before the six-second public fallback deadline", async () => {
  /** Both modern and legacy public seats use the short authoritative search window. */
  const first = await join(A, "human-wait-first");
  expect(first.searchEndsAtMs).toBe(NOW + 6000);
  expect(await update(A, first, NOW + 4000)).toMatchObject({phase: "searching", waitForPlayer: true, opponent: null});
  /** A human arriving before fallback shares the original waiter's countdown. */
  const second = await join(B, "human-wait-second", NOW + 5000);
  expect(second).toMatchObject({phase: "countdown", opponent: {displayName: "Alice", bot: false}});
  /** Original seat recovered without replacing its ticket or shared countdown. */
  const recovered = await resume(A, first, "human-wait-reload", NOW + 5500);
  expect(recovered.ticketId).toBe(first.ticketId);
  expect(recovered.startsAtMs).toBe(second.startsAtMs);
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
});

it("lets an upgraded client finish its canonical legacy public seat without changing its bot deadline", async () => {
  /** Existing public seat issued before the client requested resumable waiting. */
  const legacy = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "legacy-before-upgrade"}, {db, nowMs: NOW});
  /** Upgraded client response that must retain the legacy ticket and bot deadline. */
  const upgraded = await join(A, "modern-after-upgrade", NOW + 1000);
  expect(upgraded.ticketId).toBe(legacy.ticketId);
  expect(upgraded.waitForPlayer).toBeUndefined();
  expect(upgraded.searchEndsAtMs).toBe(legacy.searchEndsAtMs);
  expect((await join(A, "modern-after-upgrade", NOW + 2000)).ticketId).toBe(legacy.ticketId);
  expect(await update(A, legacy, NOW + LIVE_RACE_WAIT_MS)).toMatchObject({phase: "countdown", opponent: {bot: true}});
  expect((await db.doc(`liveRaceTickets/${legacy.ticketId}`).get()).data()?.waitForPlayer).toBeUndefined();
  expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
});

it("gives a returning waiter a bot after its deadline while a newer public search stays open", async () => {
  /** A backgrounded seat passes its public fallback deadline without polling. */
  const first = await join(A, "background-wait-first");
  /** A later entrant cannot pair with the original seat's expired search window. */
  const second = await join(B, "background-wait-second", NOW + 12_000);
  expect(second.phase).toBe("searching");
  /** Returning after the deadline starts a bot without consuming the newer player's seat. */
  const recovered = await update(A, first, NOW + 13_000);
  expect(recovered).toMatchObject({phase: "countdown", opponent: {bot: true}});
  expect(await update(B, second, NOW + 13_000)).toMatchObject({phase: "searching", opponent: null});
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
});

it("recovers a pruned queue seat without a new join or replacement deck", async () => {
  /** Original public seat restored after its queue identifier is removed. */
  const first = await join(A, "pruned-wait-first");
  /** Owned ticket document inspected before queue pruning and recovery. */
  const ticketRef = db.doc(`liveRaceTickets/${first.ticketId}`);
  /** Original immutable ticket data used to verify deck preservation. */
  const before = (await ticketRef.get()).data()!;
  await db.doc(`liveRaceQueues/${before.pool}`).set({tickets: [], expiresAt: before.expiresAt});
  await update(A, first, NOW + 1000);
  expect((await db.doc(`liveRaceQueues/${before.pool}`).get()).data()?.tickets).toContain(first.ticketId);
  expect((await ticketRef.get()).data()?.run).toEqual(before.run);
});

it("starts one guest-named bot at the public deadline and resumes the same match", async () => {
  /** No human joins this resumable public seat during its six-second search. */
  const first = await join(A, "fallback-public-wait");
  expect(await update(A, first, NOW + 5999)).toMatchObject({phase: "searching", opponent: null});
  /** Exact deadline starts a server-owned bot with a guest display name. */
  const fallback = await update(A, first, NOW + 6000);
  expect(fallback).toMatchObject({phase: "countdown", waitForPlayer: true,
    opponent: {displayName: expect.stringMatching(/^Guest_[A-F0-9]{6}$/), bot: true}});
  /** A retry or reload must retain the bot match and its original countdown. */
  const recovered = await resume(A, first, "fallback-public-resume", NOW + 6001);
  expect(recovered).toMatchObject({ticketId: first.ticketId, startsAtMs: fallback.startsAtMs, opponent: fallback.opponent});
  expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
});

it("does not resume a replaced account pointer or create a replacement ticket", async () => {
  /** Original owned lobby whose account pointer is replaced before recovery. */
  const first = await join(A, "replaced-human-wait");
  await db.doc(`liveRacePlayers/${requestDocumentId(A, "active-live-race")}`).set({ticketId: "f".repeat(64)});
  await expect(resume(A, first, "replaced-human-resume", NOW + 1000)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(update(A, first, NOW + 1000)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
});

it("rejects another player's exact resume without changing either account or creating a seat", async () => {
  /** Original player A lobby targeted by another account's invalid resume request. */
  const first = await join(A, "foreign-resume-original");
  /** Ticket and account references checked for changes after rejected foreign recovery. */
  const refs = [db.doc(`liveRaceTickets/${first.ticketId}`), db.doc(`users/${A}`), db.doc(`users/${B}`)];
  /** Original document versions used to detect unauthorized writes. */
  const before = await db.getAll(...refs);
  await expect(resume(B, first, "foreign-resume-attempt", NOW + 1000)).rejects.toMatchObject({code: "failed-precondition"});
  /** Document versions after the rejected foreign resume attempt. */
  const after = await db.getAll(...refs);
  expect(after.every((snapshot, index) => snapshot.updateTime?.isEqual(before[index].updateTime!))).toBe(true);
  expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
});

it("atomically pairs distinct players during concurrent joins and duplicate delivery", async () => {
  /** Concurrent responses for one duplicate join and two other distinct accounts. */
  const [first, duplicate, second, third] = await Promise.all([
    join(A, "concurrent-human-first"), join(A, "concurrent-human-first"), join(B, "concurrent-human-second"), join(C, "concurrent-human-third"),
  ]);
  expect(first.ticketId).toBe(duplicate.ticketId);
  expect(new Set([first.ticketId, second.ticketId, third.ticketId]).size).toBe(3);
  /** Authoritative post-join views used to count paired and still-searching seats. */
  const views = await Promise.all([update(A, first, NOW + 1000), update(B, second, NOW + 1000), update(C, third, NOW + 1000)]);
  expect(views.filter(view => view.phase === "countdown")).toHaveLength(2);
  expect(views.filter(view => view.phase === "searching")).toHaveLength(1);
  expect(views.every(view => view.opponent?.bot !== true)).toBe(true);
  expect((await db.collection("liveRaceTickets").get()).size).toBe(3);
  /** Committed match query used to verify exactly one distinct-player pairing. */
  const matches = await db.collection("liveRaceMatches").get();
  expect(matches.size).toBe(1);
  expect(new Set(matches.docs[0].data().participantIds).size).toBe(2);
});

it.each(["blocked", "reverse-blocked", "private", "expired", "noncanonical", "missing-profile", "deleted"])("does not select a %s seat left in the public queue", async mode => {
  /** Original queued seat modified to exercise each unsafe candidate condition. */
  const first = await join(A, "unsafe-candidate-first");
  if (mode === "blocked") await db.doc(`users/${A}/blockedRivals/${B}`).set({blocked: true});
  if (mode === "reverse-blocked") await db.doc(`users/${B}/blockedRivals/${A}`).set({blocked: true});
  if (mode === "private") await db.doc(`liveRaceTickets/${first.ticketId}`).update({privateChallenge: true});
  if (mode === "expired") await db.doc(`liveRaceTickets/${first.ticketId}`).update({expiresAt: Timestamp.fromMillis(NOW + 1000)});
  if (mode === "noncanonical") await db.doc(`liveRacePlayers/${requestDocumentId(A, "active-live-race")}`).set({ticketId: "f".repeat(64)});
  if (mode === "missing-profile") await db.doc(`users/${A}`).delete();
  if (mode === "deleted") await getJestAccountDeletionRef(db, A).set({deleted: true});
  expect(await join(B, "unsafe-candidate-second", NOW + 1000)).toMatchObject({phase: "searching", opponent: null});
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
});

it("rejects missing assigned matches rather than falling back to a bot", async () => {
  /** First human seat in a match whose shared document will be removed. */
  const first = await join(A, "missing-match-first");
  /** Second human seat bound to the same soon-missing match. */
  const second = await join(B, "missing-match-second", NOW + 1000);
  /** Canonical assigned match identifier read from the recipient ticket. */
  const matchId = (await db.doc(`liveRaceTickets/${second.ticketId}`).get()).data()!.matchId;
  await db.doc(`liveRaceMatches/${matchId}`).delete();
  await expect(update(A, first, NOW + 20_000)).rejects.toMatchObject({code: "not-found"});
  await expect(update(B, second, NOW + 20_000)).rejects.toMatchObject({code: "not-found"});
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
});

it("allows a fresh search after a dead pointer without reviving an exact historical join", async () => {
  /** Original seat whose missing match must invalidate exact recovery. */
  const first = await join(A, "dead-pointer-first");
  /** Second seat used to establish the shared match before its deletion. */
  const second = await join(B, "dead-pointer-second", NOW + 1000);
  /** Assigned match removed to simulate a dead retained account pointer. */
  const matchId = (await db.doc(`liveRaceTickets/${second.ticketId}`).get()).data()!.matchId;
  await db.doc(`liveRaceMatches/${matchId}`).delete();
  await expect(resume(A, first, "dead-pointer-resume", NOW + 2000)).rejects.toMatchObject({code: "failed-precondition"});
  /** New owned search allowed after the old shared match disappears. */
  const fresh = await join(A, "dead-pointer-new-search", NOW + 2000);
  expect(fresh.ticketId).not.toBe(first.ticketId);
  expect(fresh).toMatchObject({phase: "searching", opponent: null});
  await expect(update(A, first, NOW + 20_000)).rejects.toMatchObject({code: "not-found"});
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
});

it("treats TTL-expired tickets and matches as unavailable before their documents disappear", async () => {
  /** Owned seat retained in storage after its authority timestamp expires. */
  const first = await join(A, "expired-retention-first");
  await db.doc(`liveRaceTickets/${first.ticketId}`).update({expiresAt: Timestamp.fromMillis(NOW + 1000)});
  await expect(update(A, first, NOW + 1000)).rejects.toMatchObject({code: "not-found"});
});

it("rejects a retained assigned match whose TTL expired without changing its result or allocating a replacement", async () => {
  /** Two human seats whose shared match receives an earlier retention deadline. */
  const first = await join(A, "expired-match-first"), second = await join(B, "expired-match-second", NOW + 1000);
  /** Shared match document retained after its configured authority expires. */
  const matchRef = db.doc(`liveRaceMatches/${first.ticketId}`);
  await matchRef.update({expiresAt: Timestamp.fromMillis(NOW + 2000)});
  /** Match version used to detect writes or replacement after expiry rejection. */
  const before = await matchRef.get();
  await expect(update(A, first, NOW + 2000)).rejects.toMatchObject({code: "not-found"});
  await expect(update(B, second, NOW + 2000)).rejects.toMatchObject({code: "not-found"});
  await expect(resume(A, first, "expired-match-exact-resume", NOW + 2000)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await matchRef.get()).updateTime?.isEqual(before.updateTime!)).toBe(true);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
});

it("settles a zero-play forfeit without rewards or statistics and allocates no terminal no-op receipts", async () => {
  /** First participant in a match forfeited without either player answering. */
  const first = await join(A, "zero-play-first");
  /** Second participant who forfeits the otherwise unplayed match. */
  const second = await join(B, "zero-play-second", NOW + 1000);
  /** Terminal forfeit response that must grant no coins or statistics. */
  const result = await update(B, second, NOW + 7000, "leave", "zero-play-forfeit");
  expect(result).toMatchObject({phase: "result", result: "loss", rewardCoins: 0});
  expect(await update(A, first, NOW + 8000)).toMatchObject({phase: "result", result: "win", rewardCoins: 0});
  for (const userId of [A, B]) {
    /** Participant account inspected for unwanted zero-play rewards or achievements. */
    const profile = (await db.doc(`users/${userId}`).get()).data()!;
    expect(profile.coins).toBe(100);
    expect(profile.stats?.multiplayerGamesPlayed ?? 0).toBe(0);
    expect(profile.unlockedAchievements ?? []).toEqual([]);
  }
  /** Settled match identifier whose accepted command receipts are counted. */
  const matchId = (await db.doc(`liveRaceTickets/${first.ticketId}`).get()).data()!.matchId;
  /** Private command receipt collection for the terminal match. */
  const receipts = db.collection(`liveRaceMatches/${matchId}/requests`);
  /** Receipt count before repeated terminal leave commands that change nothing. */
  const before = await receipts.get();
  for (let index = 0; index < 5; index++) await update(A, first, NOW + 9000 + index, "leave", `terminal-noop-${index}`);
  expect((await receipts.get()).size).toBe(before.size);
});
