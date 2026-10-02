import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {RACE_RULES, type LiveRaceView} from "@qwordly/core/race";
import type {LiveMatch} from "../../race/raceLiveState";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";

/** Renders the a interface. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
/** Renders the now interface. */
const NOW = 1_800_000_000_000;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;
/** Provides clear behavior. */
async function clear() {
  for (const path of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "users", "localizedRiddles/en/riddles", "localizedRiddles/fr/riddles"])
    await db.recursiveDelete(db.collection(path));
  await Promise.all([A, B, C].map(user => getJestAccountDeletionRef(db, user).delete()));
}
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Local Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-live"});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const user of [A, B, C]) batch.set(db.doc(`users/${user}`), {username: user === A ? "Alice" : user === B ? "Bob" : "Charlie", coins: 100,
    avatarUrl: "https://example.com/avatar.png"});
  await batch.commit();
});
afterAll(clear);
/** Provides join behavior. */
const join = (user: string, requestId: string, nowMs = NOW) => joinLiveRaceForUser(user, {locale: "en", categoryId: "history", requestId}, {db, nowMs});
/** Provides update behavior. */
const update = (user: string, view: LiveRaceView, nowMs: number, action: "poll" | "leave" = "poll", requestId = `poll-${nowMs}`) =>
  updateLiveRaceForUser(user, {ticketId: view.ticketId, action, requestId}, {db, nowMs});
/** Provides pair behavior. */
async function pair() {
  /** Provides a behavior. */
  const a = await join(A, "join-alice-1");
  /** Provides b behavior. */
  const b = await join(B, "join-bob-001", NOW + 1000);
  return {a: await update(A, a, NOW + 1000), b};
}
/** Provides answer behavior. */
async function answer(user: string, view: LiveRaceView, nowMs: number, requestId: string) {
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${(await db.doc(`liveRaceTickets/${view.ticketId}`).get()).data()!.matchId}`).get()).data() as LiveMatch;
  /** Provides seat behavior. */
  const seat = match.tickets[0] === view.ticketId ? 0 : 1;
  /** Provides riddle behavior. */
  const riddle = match.runs[seat].riddles[match.runs[seat].currentPosition]!;
  return updateLiveRaceForUser(user, {ticketId: view.ticketId, action: "guess", requestId, riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs});
}

it("observes an unchanged human match without rewriting shared state", async () => {
  /** Matched players share one authoritative gameplay document. */
  const {a} = await pair();
  // The first observed transition to racing is durable; later steady progress reads are read-only.
  await update(A, a, NOW + 7000);
  /** Ordinary progress reads should leave both document versions untouched. */
  const refs = [db.doc(`liveRaceMatches/${a.ticketId}`), db.doc(`liveRaceTickets/${a.ticketId}`)];
  /** Document versions before a read-only observation. */
  const before = await db.getAll(...refs);
  expect(await update(A, a, NOW + 8000)).toMatchObject({phase: "racing", player: {correctCount: 0}});
  /** A poll must not compete with answers by changing the match version. */
  const after = await db.getAll(...refs);
  expect(after.map((item, index) => item.updateTime!.isEqual(before[index]!.updateTime!))).toEqual([true, true]);
});

it("keeps unchanged bot observations read-only and never rewinds its server score", async () => {
  /** Waiting alone selects exactly one server-controlled bot. */
  const ticket = await join(A, "read-only-bot-seat");
  await update(A, ticket, NOW + 60000);
  expect((await update(A, ticket, NOW + 77000)).opponent?.correctCount).toBe(1);
  /** Bot progress changes only at the next authoritative score boundary. */
  const ref = db.doc(`liveRaceMatches/${ticket.ticketId}`);
  /** Version after the first server-awarded bot point. */
  const before = await ref.get();
  expect((await update(A, ticket, NOW + 78000)).opponent?.correctCount).toBe(1);
  expect((await update(A, ticket, NOW + 70000)).opponent?.correctCount).toBe(1);
  expect((await ref.get()).updateTime!.isEqual(before.updateTime!)).toBe(true);
  expect((await update(A, ticket, NOW + 89000)).opponent?.correctCount).toBe(2);
});

it("accepts one answer amid concurrent polls without losing scores or duplicating rewards", async () => {
  /** Both browsers may observe the same match while an answer commits. */
  const {a, b} = await pair();
  await Promise.all([answer(A, a, NOW + 7000, "answer-under-poll-load"),
    ...Array.from({length: 20}, (_, index) => update(index % 2 ? A : B, index % 2 ? a : b, NOW + 7000))]);
  expect(await update(A, a, NOW + 8000)).toMatchObject({player: {correctCount: 1}, rewardCoins: 0});
  expect(await update(B, b, NOW + 8000)).toMatchObject({opponent: {correctCount: 1}});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
});

it("pairs two live seats with shared riddles, usernames, avatars and a five-second countdown", async () => {
  /** Provides {a, b} behavior. */
  const {a, b} = await pair();
  expect(a.phase).toBe("countdown"); expect(b.phase).toBe("countdown");
  expect(a.startsAtMs).toBe(NOW + 6000); expect(b.startsAtMs).toBe(a.startsAtMs);
  expect(a.opponent).toMatchObject({displayName: "Bob", avatarUrl: "https://example.com/avatar.png", bot: false});
  expect(b.opponent?.displayName).toBe("Alice");
  expect(a.run?.currentRiddle?.riddleId).toBe(b.run?.currentRiddle?.riddleId);
  expect(JSON.stringify(a)).not.toContain('"answer"');
  expect(a.run?.preloadedRiddles).toBeUndefined();
  await expect(answer(A, a, NOW + 5999, "too-early-guess")).rejects.toMatchObject({code: "failed-precondition"});
  /** Provides progress behavior. */
  const progress = await answer(A, a, NOW + 6000, "first-live-guess");
  expect(progress.player.correctCount).toBe(1);
  expect((await update(B, b, NOW + 7000)).opponent?.correctCount).toBe(1);
});

it("withholds both players' first prompt until the shared server start", async () => {
  /** Both viewers receive identity and countdown data without an early puzzle preview. */
  const {a, b} = await pair();
  expect(a.run?.currentRiddle).toBeNull();
  expect(b.run?.currentRiddle).toBeNull();
  expect((await update(A, a, NOW + 5999)).run?.currentRiddle).toBeNull();
  /** At the shared start both seats receive the same first question, without its answer. */
  const started = await Promise.all([update(A, a, NOW + 6000), update(B, b, NOW + 6000)]);
  expect(started.every(view => view.phase === "racing" && Boolean(view.run?.currentRiddle))).toBe(true);
  expect(started[0]!.run!.currentRiddle!.riddleId).toBe(started[1]!.run!.currentRiddle!.riddleId);
  expect(JSON.stringify(started)).not.toContain('"answer"');
});

it("ends both players immediately on the tenth solved riddle and grants 50 coins once", async () => {
  /** Provides {a, b} behavior. */
  await db.doc(`users/${A}`).update({"stats.multiplayerWins": 4, "stats.totalWins": 12});
  /** Matched live seats for an existing multiplayer winner. */
  const {a, b} = await pair();
  /** Latest accepted progress for this seat. */
  let current = a;
  for (let i = 0; i < 10; i++) current = await answer(A, current, NOW + 6000 + i * 1000, `answer-alice-${i}`);
  expect(current).toMatchObject({phase: "result", result: "win", rewardCoins: 50, newCoins: 150});
  expect((await update(B, b, NOW + 16000))).toMatchObject({phase: "result", result: "loss", rewardCoins: 0});
  /** Provides replay behavior. */
  const replay = await answer(A, a, NOW + 17000, "answer-alice-9").catch(() => update(A, a, NOW + 17000));
  expect(replay.phase).toBe("result");
  await Promise.all([update(A, a, NOW + 18000), update(A, a, NOW + 18000)]);
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(150);
  expect((await db.doc(`users/${B}`).get()).data()!.coins).toBe(100);
  expect((await db.doc(`users/${A}`).get()).data()!.stats).toMatchObject({multiplayerWins: 5, totalWins: 12});
  expect((await db.doc(`users/${B}`).get()).data()!.stats?.multiplayerWins ?? 0).toBe(0);
});

it("serializes simultaneous finishes into one winner and one grant", async () => {
  /** Provides {a, b} behavior. */
  let {a, b} = await pair();
  for (let i = 0; i < 9; i++) {a = await answer(A, a, NOW + 6000 + i * 1000, `a-racing-${i}`); b = await answer(B, b, NOW + 6000 + i * 1000, `b-racing-${i}`);}
  await Promise.all([answer(A, a, NOW + 16000, "a-final-answer"), answer(B, b, NOW + 16000, "b-final-answer")]);
  /** Provides results behavior. */
  const results = await Promise.all([update(A, a, NOW + 17000), update(B, b, NOW + 17000)]);
  expect(results.map(result => result.result).sort()).toEqual(["loss", "win"]);
  /** Provides balances behavior. */
  const balances = await db.getAll(db.doc(`users/${A}`), db.doc(`users/${B}`));
  expect(balances.reduce((sum, item) => sum + item.data()!.coins, 0)).toBe(250);
  expect(balances.reduce((sum, item) => sum + (item.data()!.stats?.multiplayerWins ?? 0), 0)).toBe(1);
});

it("waits exactly one minute before creating a bot and then starts a five-second countdown", async () => {
  /** Provides a behavior. */
  const a = await join(A, "bot-wait-request");
  expect((await update(A, a, NOW + 59999)).phase).toBe("searching");
  /** Provides bot behavior. */
  const bot = await update(A, a, NOW + 60000);
  expect(bot).toMatchObject({phase: "countdown", startsAtMs: NOW + 65000, opponent: {bot: true, correctCount: 0}});
  expect((await update(A, a, NOW + 77000)).opponent?.correctCount).toBe(1);
  expect((await update(A, a, NOW + 185000))).toMatchObject({phase: "result", result: "loss", rewardCoins: 0});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
});

it("replays queue joins and final guesses without duplicate seats or rewards", async () => {
  /** Provides [a, duplicate] behavior. */
  const [a, duplicate] = await Promise.all([join(A, "duplicate-join"), join(A, "duplicate-join")]);
  expect(a.ticketId).toBe(duplicate.ticketId);
  expect((await join(A, "new-tab-rejoin")).ticketId).toBe(a.ticketId);
  /** Provides b behavior. */
  const b = await join(B, "opponent-for-replay", NOW + 1000);
  /** Provides first behavior. */
  const first = await answer(A, a, NOW + 6000, "guess-idempotency");
  /** Provides replay behavior. */
  const replay = await answer(A, a, NOW + 7000, "guess-idempotency").catch(error => {expect(error.code).toBe("invalid-argument"); return update(A, a, NOW + 7000);});
  expect(first.player.correctCount).toBe(1); expect(replay.player.correctCount).toBe(1);
  expect((await update(B, b, NOW + 7000)).opponent?.correctCount).toBe(1);
});

it("rejects another account's ticket and excludes blocked or cancelled players", async () => {
  /** Provides a behavior. */
  const a = await join(A, "private-seat-one");
  await expect(update(B, a, NOW + 1000)).rejects.toMatchObject({code: "permission-denied"});
  await db.doc(`users/${A}/blockedRivals/${B}`).set({blocked: true});
  /** Provides b behavior. */
  const b = await join(B, "blocked-seat-two", NOW + 1000); expect(b.phase).toBe("searching");
  await update(A, a, NOW + 2000, "leave", "cancel-search-one");
  /** Provides c behavior. */
  const c = await join(C, "third-seat-three", NOW + 2500); expect(c.opponent?.displayName).toBe("Bob");
  expect((await update(A, a, NOW + 60000)).phase).toBe("cancelled");
});

it("keeps provider, language and category pools separate while pairing eligible waiting players", async () => {
  /** Additional identities cannot move themselves between authenticated provider namespaces. */
  const foreign = `facebook_${"d".repeat(40)}`, eligible = `jest_${"e".repeat(40)}`;
  /** Equivalent catalogs are available so the test isolates matchmaking scope. */
  const content = await db.collection("localizedRiddles/en/riddles").get();
  /** Fixture content and two more owned profiles are prepared atomically. */
  const batch = db.batch();
  for (const document of content.docs) {
    batch.set(db.doc(`localizedRiddles/fr/riddles/${document.id}`), document.data());
    batch.set(db.doc(`localizedRiddles/en/riddles/science-${document.id}`), {...document.data(),
      riddleId: `science-${document.id}`, canonicalRiddleId: String(document.data().canonicalRiddleId).replace("history:", "science:"), categoryId: "science"});
  }
  batch.set(db.doc(`users/${foreign}`), {username: "Facebook player", coins: 100});
  batch.set(db.doc(`users/${eligible}`), {username: "Eligible player", coins: 100});
  await batch.commit();
  /** Four unrelated queues have usable content but cannot be merged. */
  const original = await join(A, "scope-original-seat");
  expect((await joinLiveRaceForUser(B, {locale: "fr", categoryId: "history", requestId: "scope-french-seat"}, {db, nowMs: NOW + 1000})).phase).toBe("searching");
  expect((await joinLiveRaceForUser(C, {locale: "en", categoryId: "science", requestId: "scope-science-seat"}, {db, nowMs: NOW + 1000})).phase).toBe("searching");
  expect((await join(foreign, "scope-facebook-seat", NOW + 1000)).phase).toBe("searching");
  expect((await db.collection("liveRaceMatches").get()).size).toBe(0);
  expect(await join(eligible, "scope-eligible-seat", NOW + 2000)).toMatchObject({phase: "countdown", opponent: {displayName: "Alice"}});
  expect(await update(A, original, NOW + 2000)).toMatchObject({phase: "countdown", opponent: {displayName: "Eligible player"}});
});

it.each(["block", "delete"] as const)("settles an active %s privacy boundary without awarding a forfeit win", async boundary => {
  /** A live opponent's withdrawal through a privacy boundary is not a competitive victory. */
  const {a, b} = await pair();
  await answer(A, a, NOW + 7000, "before-privacy-boundary");
  if (boundary === "block") await db.doc(`users/${A}/blockedRivals/${B}`).set({blocked: true});
  else await getJestAccountDeletionRef(db, B).set({deleted: true});
  /** The remaining browser sees an anonymous rival and a no-reward draw. */
  const result = await update(A, a, NOW + 8000);
  expect(result).toMatchObject({phase: "result", result: "tie", rewardCoins: 0,
    opponent: {displayName: "Riddle Quest player", avatarUrl: null}});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
  expect((await db.doc(`users/${B}`).get()).data()!.coins).toBe(100);
  if (boundary === "delete") await expect(update(B, b, NOW + 9000)).rejects.toThrow("account-deleted");
  else expect(await update(B, b, NOW + 9000)).toMatchObject({phase: "result", result: "tie", rewardCoins: 0});
});

it("cancels a countdown without paying a win and rewards an in-game forfeit only once", async () => {
  /** Provides {a, b} behavior. */
  const {a, b} = await pair();
  expect((await update(B, b, NOW + 2000, "leave", "countdown-leave"))).toMatchObject({result: "tie", rewardCoins: 0});
  expect((await db.doc(`users/${A}`).get()).data()!.stats?.multiplayerWins ?? 0).toBe(0);
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
  /** Provides next a behavior. */
  const nextA = await join(A, "next-after-cancel", NOW + 10000);
  /** Provides next b behavior. */
  const nextB = await join(B, "next-b-after-cancel", NOW + 11000);
  await update(B, nextB, NOW + 17000, "leave", "forfeit-after-start");
  expect((await update(A, nextA, NOW + 18000))).toMatchObject({result: "win", rewardCoins: 50});
});

it("counts skips toward race progress and restores the same question on reload", async () => {
  const {a, b} = await pair();
  let current = await update(A, a, NOW + 6000);
  for (let i = 0; i < 7; i++) {
    const command = {ticketId: current.ticketId, action: "skip" as const,
      riddleId: current.run!.currentRiddle!.riddleId, requestId: `skip-answer-${i}`};
    current = await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 6000 + i * 1000});
    // Replaying the same accepted skip cannot advance the question or add another penalty.
    expect(await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 6000 + i * 1000})).toEqual(current);
  }
  expect(current).toMatchObject({phase: "racing", player: {correctCount: 7},
    run: {correctCount: 7, totalPenaltyMs: 7 * RACE_RULES.skipPenaltyMs, currentRiddle: {position: 7}}});
  expect((await update(B, b, NOW + 13000)).opponent?.correctCount).toBe(7);
  const restored = await join(A, "reload-after-skips", NOW + 14000);
  expect(restored.ticketId).toBe(a.ticketId);
  expect(restored.run!.currentRiddle!.riddleId).toBe(current.run!.currentRiddle!.riddleId);
  expect(restored.player.correctCount).toBe(7);
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
});

it.each(["skip", "exhaust"] as const)("resets question state after %s and settles the tenth completed riddle once", async action => {
  const {a, b} = await pair();
  let current = a;
  for (let index = 0; index < 8; index++) current = await answer(A, current, NOW + 6000 + index * 1000, `eight-solves-${index}`);
  const oldRiddleId = current.run!.currentRiddle!.riddleId;
  current = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "hint", requestId: "old-question-hint", riddleId: oldRiddleId}, {db, nowMs: NOW + 15000});
  const guessAtMs = NOW + 16000;
  for (let index = 0; index < (action === "skip" ? 1 : 5); index++) current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "guess", requestId: `old-question-wrong-${index}`, riddleId: oldRiddleId,
    guess: "x".repeat(current.run!.currentRiddle!.answerLength),
  }, {db, nowMs: guessAtMs + index * 1000});
  if (action === "skip") current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "skip", requestId: "skip-ninth-question", riddleId: oldRiddleId,
  }, {db, nowMs: guessAtMs + 5000});
  expect(current).toMatchObject({phase: "racing", player: {correctCount: 9}, rewardCoins: 0});
  expect(current.run!.currentRiddle).toMatchObject({position: 9, guessesUsed: 0, guessesRemaining: 5, revealedLetters: [], confirmedGuesses: []});
  expect(current.run!.currentRiddle!.riddleId).not.toBe(oldRiddleId);
  const command = {ticketId: a.ticketId, action: "skip" as const,
    requestId: "skip-tenth-question", riddleId: current.run!.currentRiddle!.riddleId};
  current = await updateLiveRaceForUser(A, command, {db, nowMs: guessAtMs + 6000});
  expect(current).toMatchObject({phase: "racing", result: null, player: {correctCount: 10}, rewardCoins: 0,
    run: {currentRiddle: null, totalPenaltyMs: RACE_RULES.hintPenaltyMs + 2 * RACE_RULES.skipPenaltyMs}});
  expect(await updateLiveRaceForUser(A, command, {db, nowMs: guessAtMs + 7000})).toMatchObject({result: null, rewardCoins: 0});
  /** Rival allowance includes every hint and skip cost on the completed run. */
  const deadline = current.startsAtMs! + current.run!.adjustedElapsedMs;
  expect(await update(B, b, deadline - 1)).toMatchObject({phase: "racing", opponent: {correctCount: 10}, rewardCoins: 0});
  expect(await update(B, b, deadline)).toMatchObject({result: "loss", rewardCoins: 0});
  expect(await update(A, a, deadline + 1)).toMatchObject({result: "win", newCoins: 150});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(150);
});

it("lets the rival beat ten rapid skips, including after the finisher reloads and closes", async () => {
  /** Matched seats recover the same authoritative shared match. */
  const {a, b} = await pair();
  /** Accepted progress for the first finisher. */
  let current = await update(A, a, NOW + 6000);
  for (let index = 0; index < 10; index++) current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "skip", requestId: `rapid-skip-${index}`,
    riddleId: current.run!.currentRiddle!.riddleId,
  }, {db, nowMs: NOW + 6000 + index * 1000});
  expect(current).toMatchObject({phase: "racing", result: null, rewardCoins: 0,
    run: {status: "completed", totalPenaltyMs: 10 * RACE_RULES.skipPenaltyMs, wallElapsedMs: 9000}});
  expect(await join(A, "reload-finished-seat", NOW + 16000)).toMatchObject({ticketId: a.ticketId,
    phase: "racing", run: {status: "completed", adjustedElapsedMs: current.run!.adjustedElapsedMs}});
  expect(await update(A, a, NOW + 17000, "leave", "close-finished-seat")).toMatchObject({phase: "racing", result: null});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
  /** Rival continues solving after the first run has completed. */
  let rival = await update(B, b, NOW + 18000);
  for (let index = 0; index < 10; index++) rival = await answer(B, rival, NOW + 19000 + index * 1000, `rival-after-skips-${index}`);
  expect(rival).toMatchObject({phase: "result", result: "win", rewardCoins: 50, newCoins: 150});
  expect(await update(A, a, NOW + 29000)).toMatchObject({result: "loss", rewardCoins: 0});
  await Promise.all([update(A, a, NOW + 30000), update(B, b, NOW + 30000)]);
  expect((await db.doc(`users/${B}`).get()).data()!.coins).toBe(150);
});

it("lets a later unassisted finish beat an earlier hinted finish", async () => {
  /** Matched seats recover the same authoritative shared match. */
  const {a, b} = await pair();
  /** Accepted progress for the first finisher. */
  let current = await update(A, a, NOW + 6000);
  current = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "hint", requestId: "hint-before-finish",
    riddleId: current.run!.currentRiddle!.riddleId}, {db, nowMs: NOW + 6000});
  for (let index = 0; index < 10; index++) current = await answer(A, current, NOW + 7000 + index * 1000, `hinted-finish-${index}`);
  expect(current).toMatchObject({phase: "racing", result: null, rewardCoins: 0, run: {status: "completed"}});
  /** Rival continues solving after the first run has completed. */
  let rival = await update(B, b, NOW + 17000);
  for (let index = 0; index < 10; index++) rival = await answer(B, rival, NOW + 18000 + index * 1000, `unassisted-finish-${index}`);
  expect(rival).toMatchObject({result: "win", rewardCoins: 50});
  expect(await update(A, a, NOW + 28000)).toMatchObject({result: "loss", rewardCoins: 0});
});

it("adds hint time without blocking the next live action", async () => {
  const {a} = await pair();
  const started = await update(A, a, NOW + 7000);
  const hinted = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "hint", requestId: "time-only-hint", riddleId: started.run!.currentRiddle!.riddleId}, {db, nowMs: NOW + 7000});
  expect(hinted).toMatchObject({player: {correctCount: 0}, rewardCoins: 0, run: {totalPenaltyMs: RACE_RULES.hintPenaltyMs}});
  const solved = await answer(A, hinted, NOW + 8000, "immediate-hinted-guess");
  expect(solved).toMatchObject({player: {correctCount: 1}, run: {totalPenaltyMs: RACE_RULES.hintPenaltyMs}});
  expect(solved.run!.adjustedElapsedMs).toBe(solved.run!.wallElapsedMs + RACE_RULES.hintPenaltyMs);
});

it.each(["skip", "exhaust"] as const)("adds skip time after %s while immediately allowing hint, submit and skip", async action => {
  const {a} = await pair();
  let current = await update(A, a, NOW + 7000);
  if (action === "skip") current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "skip", requestId: "time-only-skip", riddleId: current.run!.currentRiddle!.riddleId,
  }, {db, nowMs: NOW + 7000});
  else for (let index = 0; index < 5; index++) current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "guess", requestId: `time-only-exhaust-${index}`, riddleId: current.run!.currentRiddle!.riddleId,
    guess: "x".repeat(current.run!.currentRiddle!.answerLength),
  }, {db, nowMs: NOW + 7000 + index * 1000});
  const nextAtMs = NOW + (action === "skip" ? 8000 : 12000);
  expect(current).toMatchObject({player: {correctCount: 1}, rewardCoins: 0, run: {totalPenaltyMs: RACE_RULES.skipPenaltyMs}});
  current = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "hint", requestId: "hint-immediately-after-skip", riddleId: current.run!.currentRiddle!.riddleId}, {db, nowMs: nextAtMs});
  current = await answer(A, current, nextAtMs + 1000, "submit-immediately-after-skip");
  current = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "skip", requestId: "skip-again-without-waiting", riddleId: current.run!.currentRiddle!.riddleId}, {db, nowMs: nextAtMs + 2000});
  const penalties = 2 * RACE_RULES.skipPenaltyMs + RACE_RULES.hintPenaltyMs;
  expect(current).toMatchObject({player: {correctCount: 3}, rewardCoins: 0, run: {totalPenaltyMs: penalties}});
  expect(current.run!.adjustedElapsedMs).toBe(current.run!.wallElapsedMs + penalties);
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
});

it("scores wrong answers on the server and advances after exhausting attempts", async () => {
  /** A browser supplies only guesses against the current server-owned question. */
  const {a} = await pair();
  /** All attempts target the same issued question and use independent request IDs. */
  let current = await update(A, a, NOW + 6000);
  for (let index = 0; index < 5; index++) current = await updateLiveRaceForUser(A, {
    ticketId: a.ticketId, action: "guess", requestId: `incorrect-answer-${index}`,
    riddleId: current.run!.currentRiddle!.riddleId, guess: "x".repeat(current.run!.currentRiddle!.answerLength),
  }, {db, nowMs: NOW + 7000 + index * 1000});
  expect(current).toMatchObject({phase: "racing", player: {correctCount: 1}, rewardCoins: 0});
  expect(current.run!.currentRiddle!.position).toBe(1);
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(100);
});

it("recovers an expired search on reload and grants a bot victory once", async () => {
  /** Original owned lobby remains selected across a reload. */
  const original = await join(A, "original-bot-search");
  /** New delivery id must recover the original one-minute deadline. */
  const restored = await join(A, "reload-bot-search", NOW + 60000);
  expect(restored.ticketId).toBe(original.ticketId);
  /** Authority selects one bot and one immutable countdown. */
  let current = await update(A, restored, NOW + 60000);
  expect((await update(A, restored, NOW + 61000)).startsAtMs).toBe(NOW + 65000);
  for (let i = 0; i < 10; i++) current = await answer(A, current, NOW + 65000 + i * 1000, `bot-win-answer-${i}`);
  expect(current).toMatchObject({phase: "result", result: "win", rewardCoins: 50});
  await answer(A, current, NOW + 78000, "bot-win-answer-9");
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(150);
});

it("keeps human matching and a simultaneous deadline poll exclusive", async () => {
  /** One unmatched seat at its authoritative deadline. */
  const a = await join(A, "deadline-race-search");
  await update(A, a, NOW + 59000);
  await Promise.all([update(A, a, NOW + 60000), join(B, "deadline-human-search", NOW + 59999)]);
  /** Both racing transactions share and revalidate the original ticket lock. */
  const matches = await db.collection("liveRaceMatches").get();
  expect(matches.size).toBe(1);
  expect(matches.docs[0]!.data().tickets.filter((id: string | null) => id === a.ticketId)).toHaveLength(1);
});

it("recovers searching and matched seats from their immutable decks when the catalog is unavailable", async () => {
  /** Existing search owns its validated deck independently of later catalog availability. */
  const searching = await join(A, "catalog-search-original");
  await db.recursiveDelete(db.collection("localizedRiddles/en/riddles"));
  expect(await join(A, "catalog-search-reload", NOW + 1000)).toMatchObject({ticketId: searching.ticketId, phase: "searching"});
  expect(await join(A, "catalog-search-original", NOW + 2000)).toMatchObject({ticketId: searching.ticketId, phase: "searching"});
  await expect(join(B, "catalog-new-seat", NOW + 2000)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
});

it("recovers live progress and a settled result without rereading the current content catalog", async () => {
  /** Both accounts already own the validated immutable match deck. */
  const {a, b} = await pair();
  /** Accepted first solve remains authoritative across catalog removal and reconnect. */
  let current = await answer(A, a, NOW + 6000, "catalog-first-answer");
  await db.recursiveDelete(db.collection("localizedRiddles/en/riddles"));
  expect(await join(A, "catalog-match-reload", NOW + 7000)).toMatchObject({ticketId: a.ticketId, phase: "racing", player: {correctCount: 1}});
  expect(await join(B, "catalog-rival-reload", NOW + 7000)).toMatchObject({ticketId: b.ticketId, phase: "racing", opponent: {correctCount: 1}});
  for (let index = 1; index < 10; index++) current = await answer(A, current, NOW + 7000 + index * 1000, `catalog-answer-${index}`);
  expect(current).toMatchObject({phase: "result", result: "win", rewardCoins: 50});
  expect(await join(A, "join-alice-1", NOW + 19000)).toMatchObject({ticketId: a.ticketId, phase: "result", result: "win", rewardCoins: 50});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(150);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
});

it("keeps bot progress and rejoined phase monotonic across older clock samples", async () => {
  /** Bot's accepted progress must survive an older poll and older reconnect. */
  const a = await join(A, "clock-bot-search");
  await update(A, a, NOW + 60000);
  expect((await update(A, a, NOW + 89000)).opponent?.correctCount).toBe(2);
  /** Older sample cannot rewind the already accepted two bot solves. */
  const older = await update(A, a, NOW + 70000);
  expect(older).toMatchObject({phase: "racing", opponent: {correctCount: 2}});
  expect(older.serverNowMs).toBeGreaterThanOrEqual(NOW + 89000);
  expect(await join(A, "clock-bot-rejoin", NOW + 60000)).toMatchObject({phase: "racing", serverNowMs: older.serverNowMs});
});

it("does not turn an in-game forfeit back into a countdown cancellation", async () => {
  /** Observing the shared start commits the live phase even without a guess. */
  const {a, b} = await pair();
  await update(A, a, NOW + 7000);
  /** A rival's older poll observes the same shared accepted clock. */
  const older = await update(B, b, NOW + 2000);
  expect(older.phase).toBe("racing");
  expect(older.serverNowMs).toBeGreaterThanOrEqual(NOW + 7000);
  await update(B, b, NOW + 2000, "leave", "clock-late-forfeit");
  expect(await update(A, a, NOW + 2000)).toMatchObject({phase: "result", result: "win", rewardCoins: 50});
  expect((await db.doc(`users/${A}`).get()).data()!.coins).toBe(150);
});

it("admits reordered guesses after already accepted live progress without rewinding their event clocks", async () => {
  /** First accepted solve proves the shared match has already started. */
  const {a} = await pair();
  await answer(A, a, NOW + 7000, "clock-first-solve");
  /** Older sampled request still acts at the persisted authoritative progress floor. */
  const next = await answer(A, a, NOW + 2000, "clock-reordered-solve");
  expect(next.player.correctCount).toBe(2);
  expect(next.phase).toBe("racing");
  expect(next.serverNowMs).toBeGreaterThanOrEqual(NOW + 7000);
  expect(next.run!.events.map(event => event.wallElapsedMs)).toEqual([1000, 1000]);
});

it("preserves a searching seat heartbeat when an older poll arrives afterward", async () => {
  /** Renewed lobby lease cannot be shortened by a reordered request. */
  const a = await join(A, "clock-search-heartbeat");
  await update(A, a, NOW + 1000);
  expect((await update(A, a, NOW - 1000)).serverNowMs).toBeGreaterThanOrEqual(NOW + 1000);
  expect((await db.doc(`liveRaceTickets/${a.ticketId}`).get()).data()!.seenAtMs).toBe(NOW + 1000);
  expect((await join(B, "clock-search-opponent", NOW + 10001)).opponent?.displayName).toBe("Alice");
});

it("derives a safe bot clock floor for records without an observation marker", async () => {
  /** Persisted bot count remains evidence of previously accepted elapsed time. */
  const a = await join(A, "clock-legacy-bot");
  await update(A, a, NOW + 60000);
  await update(A, a, NOW + 89000);
  /** Simulates an existing match predating the explicit shared observation marker. */
  const ref = db.doc(`liveRaceMatches/${a.ticketId}`);
  /** Untyped historical persisted document permits removing newer optional fields. */
  const legacy = (await ref.get()).data()!;
  delete legacy.observedAtMs;
  for (const run of legacy.runs) delete run.lastActionAtMs;
  await ref.set(legacy);
  await db.doc(`liveRaceTickets/${a.ticketId}`).update({seenAtMs: NOW + 60000});
  expect(await update(A, a, NOW + 61000)).toMatchObject({phase: "racing", serverNowMs: NOW + 89000, opponent: {correctCount: 2}});
});
