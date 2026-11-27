import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {LIVE_RACE_WAIT_MS, type LiveRaceView, type RaceLocale} from "../../../../src/races/contracts/index.js";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/invitations/raceLiveInvitation";
import {requestDocumentId} from "../../race/raceSetupService";
import {raceDeckContentVersion} from "../../race/runs/raceDeckSnapshot";
import type {LiveMatch, LiveTicket} from "../../race/live/raceLiveState";

/** Every canonical mutation belongs to this pass's private loopback demo. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `facebook_${"a".repeat(40)}`, B = `facebook_${"b".repeat(40)}`, C = `facebook_${"c".repeat(40)}`, NOW = 1_800_000_000_000;
/** Real SDK exercises queue transactions, immutable decks, signals and settlement. */
let db: FirebaseFirestore.Firestore;
/** New match boundaries share frozen content without constraining accepted journeys. */
type Entry = "public" | "private" | "bot";
/** Only collections owned by the isolated demo are cleared. */
async function clear() {
  for (const path of ["liveRaceTickets", "liveRacePlayers", "liveRaceMatches", "liveRaceQueues", "liveRaceSignals", "users", "localizedRiddles"])
    await db.recursiveDelete(db.collection(path));
  for (const owner of [A, B, C]) await db.doc(`jestAccountDeletionTombstones/${owner}`).delete();
}
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Catalog answers are playable and unique; only retained tickets are changed by the negative fixtures. */
  const batch = db.batch();
  for (const locale of ["en", "fr", "hi"]) for (let index = 0; index < 30; index++) {
    /** Letters avoid introducing an unrelated keyboard-policy assumption into these tests. */
    const suffix = String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26);
    batch.set(db.doc(`localizedRiddles/${locale}/riddles/history-${index}`), {
      riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
      text: `Original historical question ${index} follows its own trail`, answer: `word${suffix}`,
      difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1",
    });
  }
  for (const [index, owner] of [A, B, C].entries()) batch.set(db.doc(`users/${owner}`), {username: ["Alice", "Bob", "Charlie"][index], coins: 100});
  await batch.commit();
});
afterAll(async () => {await clear(); await db.terminate();});
/** Creates the original canonical seat through the production service. */
const reserve = (entry: Entry, locale: RaceLocale = "en") => joinLiveRaceForUser(A,
  {locale, categoryId: "history", requestId: "frozen-source-seat", ...(entry === "private" ? {createChallenge: true} : {})}, {db, nowMs: NOW});
/** The new journey selects the source deck at exactly one of the three production boundaries. */
const enter = (entry: Entry, original: LiveRaceView, locale: RaceLocale = "en") => entry === "bot"
  ? updateLiveRaceForUser(A, {ticketId: original.ticketId, action: "poll", requestId: "frozen-bot-entry"}, {db, nowMs: NOW + LIVE_RACE_WAIT_MS})
  : joinLiveRaceForUser(B, {locale, categoryId: "history", requestId: "frozen-recipient-seat",
    ...(entry === "private" ? {challengeId: original.challengeId!} : {})}, {db, nowMs: NOW + 1000});
/** Test-only archive replacement retains original clue identities, ordering and its matching fingerprint. */
async function replaceAnswer(ticketId: string, answer: string, position: number) {
  /** Real stored ticket provides the exact deck being reused. */
  const ref = db.doc(`liveRaceTickets/${ticketId}`), ticket = (await ref.get()).data() as LiveTicket;
  /** No production repair, normalization or catalog mutation occurs. */
  const riddles = ticket.run.riddles.map((riddle, index) => index === position ? {...riddle, answer} : riddle);
  await ref.update({"run.riddles": riddles, "run.contentVersion": raceDeckContentVersion(riddles)});
  return (await ref.get()).data() as LiveTicket;
}
/** Record versions prove a rejected entry has no canonical side effects. */
async function versions() {
  /** Canonical root versions include signals and player pointers. */
  const values: Record<string, string> = {};
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceMatches", "liveRaceQueues", "liveRaceSignals", "users"]) {
    for (const snapshot of (await db.collection(collection).get()).docs) values[snapshot.ref.path] = snapshot.updateTime.valueOf();
  }
  return values;
}
/** Both malformed first and future questions must be rejected before a countdown can conceal them. */
const invalid = [0, 14].flatMap(position => [" cat ", "a" + "\u0301".repeat(128)].map(answer => ({position, answer})));

it.each((["public", "private", "bot"] as const).flatMap(entry => ["null", "answer-type", "short", "order", "duplicate"].map(shape => ({entry, shape}))))(
  "rejects malformed retained deck shape $shape at the new $entry boundary", async ({entry, shape}) => {
    /** Shape corruption belongs only to the retained fixture, never to the valid catalog or authenticated request. */
    const source = await reserve(entry), ref = db.doc(`liveRaceTickets/${source.ticketId}`), stored = (await ref.get()).data() as LiveTicket;
    /** Untyped SDK writes deliberately simulate malformed server records before the production storage cast. */
    const riddles = shape === "null" ? null : shape === "short" ? stored.run.riddles.slice(0, 14) : stored.run.riddles.map((riddle, index) =>
      index !== 14 ? riddle : shape === "answer-type" ? {...riddle, answer: 42} : shape === "order" ? {...riddle, position: 0} :
        {...riddle, riddleId: stored.run.riddles[0]!.riddleId, canonicalRiddleId: stored.run.riddles[0]!.canonicalRiddleId});
    await ref.update({"run.riddles": riddles});
    /** Malformed candidates cannot interrupt healthy queue entry; private and bot entries reject without committing. */
    if (entry === "public") expect((await enter(entry, source)).phase).toBe("searching");
    else expect(await enter(entry, source).then(() => null, error => error)).toMatchObject({code: "data-loss"});
    expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
    expect((await ref.get()).data()?.run.riddles).toEqual(riddles);
  });

it.each(["public", "private", "bot"] as const)("rejects an incompatible future clue before new %s gameplay can commit", async entry => {
  /** A concealed countdown would otherwise accept this deck and abort the first correct advancement. */
  const source = await reserve(entry), ref = db.doc(`liveRaceTickets/${source.ticketId}`), stored = (await ref.get()).data() as LiveTicket;
  /** Only the second question is incompatible; the current clue, all answers and catalog remain valid. */
  const riddles = stored.run.riddles.map((riddle, index) => index === 1 ? {...riddle, text: "x".repeat(2001)} : riddle);
  await ref.update({"run.riddles": riddles, "run.contentVersion": raceDeckContentVersion(riddles)});
  /** Selection checks the complete original deck before issuing a new opponent or bot. */
  if (entry === "public") expect((await enter(entry, source)).phase).toBe("searching");
  else expect(await enter(entry, source).then(() => null, error => error)).toMatchObject({code: "data-loss"});
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
  expect((await ref.get()).data()?.run.riddles).toEqual(riddles);
});

it("selects a compatible waiting candidate behind an incompatible retained source", async () => {
  /** Alice's retained seat keeps a live lease inside its search window, so only deck compatibility excludes it. */
  const source = await reserve("public");
  /** Incompatible first candidate retains its original archive before any other player searches. */
  const stored = await replaceAnswer(source.ticketId, " cat ", 14);
  /** The healthy candidate is issued through the production public queue and cannot pair with the bad source. */
  const c = await joinLiveRaceForUser(C, {locale: "en", categoryId: "history", requestId: "behind-valid-seat"}, {db, nowMs: NOW + 1000});
  expect(c.phase).toBe("searching");
  /** The fixture restores both queue IDs in order so the malformed source leads the shared queue. */
  await db.doc(`liveRaceQueues/${stored.pool}`).update({tickets: [source.ticketId, c.ticketId]});
  /** One malformed leading source must not hide a valid human opponent behind it. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "behind-fresh-seat"}, {db, nowMs: NOW + 2000});
  expect(b).toMatchObject({phase: "countdown", startsAtMs: NOW + 7000, opponent: {displayName: "Charlie"}});
  expect((await db.collection("liveRaceMatches").get()).docs.map(snapshot => snapshot.id)).toEqual([c.ticketId]);
  expect((await db.doc(`liveRaceQueues/${stored.pool}`).get()).data()?.tickets).toEqual([]);
  expect((await db.doc(`liveRaceTickets/${source.ticketId}`).get()).data()).toEqual(stored);
});

it.each(invalid)("keeps healthy public search usable when a retained candidate is incompatible at $position", async ({position, answer}) => {
  /** New catalog validation succeeds, then the already-issued queue candidate retains incompatible original content. */
  const source = await reserve("public"), stored = await replaceAnswer(source.ticketId, answer, position);
  /** Filtering the bad candidate must not abort or match the newcomer. */
  const b = await enter("public", source);
  expect(b).toMatchObject({phase: "searching", opponent: null, run: null});
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
  expect((await db.doc(`liveRaceQueues/${stored.pool}`).get()).data()?.tickets).toEqual([b.ticketId]);
  expect((await db.doc(`liveRaceTickets/${source.ticketId}`).get()).data()).toEqual(stored);
  expect((await db.doc(`liveRacePlayers/${requestDocumentId(A, "active-live-race")}`).get()).data()?.ticketId).toBe(source.ticketId);
  /** The same healthy newcomer can pair with another valid player on the next transaction. */
  const c = await joinLiveRaceForUser(C, {locale: "en", categoryId: "history", requestId: "healthy-third-seat"}, {db, nowMs: NOW + 2000});
  expect(c).toMatchObject({phase: "countdown", startsAtMs: NOW + 7000, opponent: {displayName: "Bob"}});
  /** The resulting deck comes from Bob, not the rejected candidate's immutable archive. */
  const match = (await db.doc(`liveRaceMatches/${b.ticketId}`).get()).data() as LiveMatch;
  expect(match.runs.map(run => run.riddles.some(riddle => riddle.answer === answer))).toEqual([false, false]);
  expect((await db.doc(`liveRaceTickets/${source.ticketId}`).get()).data()).toEqual(stored);
  expect((await updateLiveRaceForUser(A, {ticketId: source.ticketId, action: "leave", requestId: "leave-bad-source"}, {db, nowMs: NOW + 3000})).phase).toBe("cancelled");
});

it.each(invalid)("rejects new private acceptance and hides incompatible availability at $position", async ({position, answer}) => {
  /** Private source is canonical and live before a recipient attempts acceptance. */
  const source = await reserve("private"), stored = await replaceAnswer(source.ticketId, answer, position), before = await versions();
  /** Preview is a read-only new-entry signal; accepted and owner notices have separate recovery semantics. */
  const preview = await getLiveRaceChallengeForUser(B, source.challengeId!, {db, nowMs: NOW + 1000});
  /** Capture rejection before verifying all receipt, membership, signal and account effects. */
  const error = await enter("private", source).then(() => null, failure => failure);
  expect(error).toMatchObject({code: "data-loss"});
  expect(preview.status).toBe("unavailable"); expect(await versions()).toEqual(before);
  expect((await db.doc(`liveRaceTickets/${source.ticketId}`).get()).data()).toEqual(stored);
  expect((await getLiveRaceChallengeForUser(A, source.challengeId!, {db, nowMs: NOW + 1000})).status).toBe("own");
  expect((await updateLiveRaceForUser(A, {ticketId: source.ticketId, action: "leave", requestId: "leave-private-source"}, {db, nowMs: NOW + 2000})).phase).toBe("cancelled");
});

it.each(invalid)("rejects new bot fallback while retaining cancellation and searching recovery at $position", async ({position, answer}) => {
  /** The original human seat was already accepted before its old deck became incompatible. */
  const source = await reserve("bot"), stored = await replaceAnswer(source.ticketId, answer, position);
  expect((await updateLiveRaceForUser(A, {ticketId: source.ticketId, action: "poll", requestId: "before-bot-deadline"}, {db, nowMs: NOW + LIVE_RACE_WAIT_MS - 1})).phase).toBe("searching");
  /** New fallback must not persist either bot match or a changed owner seat. */
  const before = await versions(), error = await enter("bot", source).then(() => null, failure => failure);
  expect(error).toMatchObject({code: "data-loss"}); expect(await versions()).toEqual(before);
  expect((await db.doc(`liveRaceTickets/${source.ticketId}`).get()).data()?.run).toEqual(stored.run);
  expect((await updateLiveRaceForUser(A, {ticketId: source.ticketId, action: "leave", requestId: "leave-bot-source"}, {db, nowMs: NOW + LIVE_RACE_WAIT_MS + 1000})).phase).toBe("cancelled");
});

it.each(["private", "bot"] as const)("allows the identical rejected %s request after explicit test-fixture repair", async entry => {
  /** Rejection must not reserve the new match, second seat or command namespace. */
  const source = await reserve(entry);
  await replaceAnswer(source.ticketId, " cat ", 14);
  expect(await enter(entry, source).then(() => null, error => error)).toMatchObject({code: "data-loss"});
  /** Repair is confined to the fixture; production never edits original frozen content. */
  const repaired = await replaceAnswer(source.ticketId, "piano", 14), accepted = await enter(entry, source);
  expect(accepted.phase).toBe("countdown");
  expect(await enter(entry, source)).toEqual(accepted);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
  expect((await db.doc(`liveRaceMatches/${source.ticketId}`).get()).data()?.runs.map((run: LiveTicket["run"]) => run.riddles))
    .toEqual([repaired.run.riddles, repaired.run.riddles]);
});

it.each((["public", "private", "bot"] as const).flatMap(entry => (["fr", "hi"] as const).map(locale => ({entry, locale}))))(
  "retains valid Unicode original decks and authoritative live actions for $entry $locale", async ({entry, locale}) => {
    /** NFD and multi-unit Indic graphemes stay byte-exact in both private seats. */
    const source = await reserve(entry, locale), originalAnswer = locale === "fr" ? "élément".normalize("NFD") : "लक्ष्म्यां";
    /** Retained originals are compared with both newly committed private match runs. */
    const stored = await replaceAnswer(source.ticketId, originalAnswer, 0), view = await enter(entry, source, locale);
    expect(view.phase).toBe("countdown"); expect(view.run?.currentRiddle).toBeNull();
    expect(view.run?.preloadedRiddles).toBeUndefined(); expect(JSON.stringify(view)).not.toContain('"answer"');
    /** Full immutable deck comparison catches trimming, normalization or catalog substitution. */
    const match = (await db.doc(`liveRaceMatches/${source.ticketId}`).get()).data() as LiveMatch;
    expect(match.runs.map(run => run.riddles)).toEqual([stored.run.riddles, stored.run.riddles]);
    expect(match.runs.map(run => run.contentVersion)).toEqual([stored.run.contentVersion, stored.run.contentVersion]);
    /** Accepted-seat recovery keeps the same original countdown and match identity. */
    expect(await enter(entry, source, locale)).toMatchObject({ticketId: view.ticketId, startsAtMs: view.startsAtMs});
    /** Server accepts the normalized equivalent only at its authoritative start. */
    const owner = entry === "bot" ? A : B, startedAt = view.startsAtMs!;
    expect((await updateLiveRaceForUser(owner, {ticketId: view.ticketId, action: "poll", requestId: "unicode-start-poll"}, {db, nowMs: startedAt})).run?.currentRiddle?.answerLength)
      .toBe(locale === "fr" ? 7 : 2);
    /** One owned answer command binds its idempotent receipt to the original first clue. */
    const command = {ticketId: view.ticketId, action: "guess" as const, requestId: "unicode-original-guess",
      riddleId: stored.run.riddles[0]!.riddleId, guess: originalAnswer.normalize("NFC")};
    /** Actual scoring response is retained for exact duplicate receipt comparison. */
    const correct = await updateLiveRaceForUser(owner, command, {db, nowMs: startedAt + 1000});
    expect(correct.player.correctCount).toBe(1);
    expect(await updateLiveRaceForUser(owner, command, {db, nowMs: startedAt + 1000})).toEqual(correct);
    expect((await db.doc(`liveRaceMatches/${source.ticketId}`).get()).data()?.runs.map((run: LiveTicket["run"]) => run.riddles)).toEqual([stored.run.riddles, stored.run.riddles]);
    expect((await db.doc(`users/${owner}`).get()).data()?.coins).toBe(100);
  });

it.each(["public", "private", "bot"] as const)("recovers and settles an already-accepted %s match despite incompatible future content", async entry => {
  /** Compatibility is required for a new match, never retroactively for a valid current prompt. */
  const source = await reserve(entry), view = await enter(entry, source), ref = db.doc(`liveRaceMatches/${source.ticketId}`);
  /** Post-acceptance fixture corruption must not strand recovery, forfeiture or terminal reward receipts. */
  const match = (await ref.get()).data() as LiveMatch;
  for (const run of match.runs) {
    run.riddles = run.riddles.map((riddle, index) => index === 14 ? {...riddle, answer: " cat "} : riddle);
    run.contentVersion = raceDeckContentVersion(run.riddles);
  }
  await ref.update({runs: match.runs}); await replaceAnswer(source.ticketId, " cat ", 14);
  /** Existing join/accept/fallback recovery keeps the original countdown. */
  expect(await enter(entry, source)).toMatchObject({ticketId: view.ticketId, startsAtMs: view.startsAtMs});
  if (entry === "private") expect((await getLiveRaceChallengeForUser(B, source.challengeId!, {db, nowMs: NOW + 2000})).status).toBe("accepted");
  /** Current answer-free prompt remains available and the server still handles terminal settlement. */
  const owner = entry === "bot" ? A : B, nowMs = view.startsAtMs! + 1000;
  expect((await updateLiveRaceForUser(owner, {ticketId: view.ticketId, action: "poll", requestId: "accepted-future-recovery"}, {db, nowMs})).phase).toBe("racing");
  /** Human seats that must record a correct answer before terminal rewards are eligible. */
  const participants = entry === "bot" ? [{seat: 0, userId: A, ticketId: source.ticketId}]
    : [{seat: 0, userId: A, ticketId: source.ticketId}, {seat: 1, userId: B, ticketId: view.ticketId}];
  for (const participant of participants) {
    /** First canonical riddle used to establish genuine play for this seat. */
    const riddle = match.runs[participant.seat].riddles[0];
    await updateLiveRaceForUser(participant.userId, {ticketId: participant.ticketId, action: "guess", requestId: `accepted-future-played-${participant.seat}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs});
  }
  /** Forfeiture still commits the original once-only match result and rewards. */
  const terminal = await updateLiveRaceForUser(owner, {ticketId: view.ticketId, action: "leave", requestId: "accepted-future-forfeit"}, {db, nowMs: nowMs + 1000});
  expect(terminal.phase).toBe("result");
  expect((await ref.get()).data()).toMatchObject({winner: entry === "bot" ? 1 : 0, rewardCoins: entry === "bot" ? 0 : 50});
  expect((await db.doc(`users/${A}`).get()).data()).toMatchObject({coins: entry === "bot" ? 125 : 200,
    stats: {multiplayerGamesPlayed: 1, multiplayerWins: entry === "bot" ? 0 : 1}});
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(entry === "bot" ? 100 : 125);
  /** Later terminal reads do not grant badges or victory coins again. */
  const accounts = (await db.getAll(db.doc(`users/${A}`), db.doc(`users/${B}`))).map(snapshot => snapshot.data());
  expect((await updateLiveRaceForUser(owner, {ticketId: view.ticketId, action: "poll", requestId: "accepted-terminal-recovery"}, {db, nowMs: nowMs + 2000})).phase).toBe("result");
  expect((await db.getAll(db.doc(`users/${A}`), db.doc(`users/${B}`))).map(snapshot => snapshot.data())).toEqual(accounts);
});
