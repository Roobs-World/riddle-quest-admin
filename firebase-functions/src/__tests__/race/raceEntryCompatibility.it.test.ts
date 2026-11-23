import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {startRaceRunForUser, submitRaceGuessForUser, resumeRaceRunForUser} from "../../race/raceService";
import {getRaceEntryForUser, claimRaceInviteForUser, reserveRaceInviteForUser, getRaceChallengeForUser} from "../../race/invitations/raceInvitation";
import {raceDeckContentVersion} from "../../race/runs/raceDeckSnapshot";
import {parseChallengeRecord, resolveChallengeRiddles, type RaceChallengeRecord} from "../../race/raceSetupService";
import type {RaceRunRecord} from "../../race/runs/raceEngine";

/** Canonical fixtures only touch a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual SDK provides original archives, locked eligibility reads and accepted publication/attempt writes. */
let db: FirebaseFirestore.Firestore;
/** Named authoritative source identities make every dependent mutation inspectable. */
const RUN = "recording-source", CHALLENGE = "recording-challenge", DECK = "recording-deck", INVITE = `jest-invite-${createHash("sha256").update(A).digest("hex")}-${"d".repeat(32)}`;
/** The dedicated demo owns all these collections; profiles remain bounded to two fixture accounts. */
const clear = async () => {
  for (const collection of ["raceRuns", "raceChallenges", "raceDecks", "raceStartRequests", "raceAttempts", "raceInviteRequests", "raceInviteLobbies", "raceMatchCandidates", "racePerformanceOutbox", "raceSettlementOutbox"]) await db.recursiveDelete(db.collection(collection));
  for (const owner of [A, B]) {await db.recursiveDelete(db.doc(`users/${owner}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));}
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(clear); afterAll(clear);
/** A valid creator timeline can skip an unplayable first question or finish before a later malformed question. */
const seed = async (modern: boolean, answer = "a b", position = 14, locale: "en" | "fr" | "hi" = "en", privateInvite = false) => {
  /** Original immutable deck is never reconstructed from the catalog. */
  const riddles = Array.from({length: 15}, (_, index) => ({riddleId: `recorded-${index}`, canonicalRiddleId: `history:${index}`,
    text: `Original question ${index}`, answer: index === position ? answer : "piano", position: index}));
  /** Skipping the first malformed clue retains the original authoritative penalty in the ghost. */
  const skipped = position === 0, skipPenaltyMs = skipped ? RACE_RULES.skipPenaltyMs : 0, wallFinishMs = skipped ? 11000 : 10000;
  /** Fully consistent recorded scoring events preserve original successful creator history. */
  const events: RaceRunRecord["events"] = [
    ...(skipped ? [{sequence: 0, type: "skip" as const, riddlePosition: 0, wallElapsedMs: 1000, penaltyAddedMs: skipPenaltyMs,
      totalPenaltyMs: skipPenaltyMs, adjustedElapsedMs: 1000+skipPenaltyMs, correctCount: 0}] : []),
    ...Array.from({length: 10}, (_, index) => ({sequence: index+(skipped ? 1 : 0), type: "correct" as const,
      riddlePosition: index+(skipped ? 1 : 0), wallElapsedMs: (index+(skipped ? 2 : 1))*1000, penaltyAddedMs: 0,
      totalPenaltyMs: skipPenaltyMs, adjustedElapsedMs: (index+(skipped ? 2 : 1))*1000+skipPenaltyMs, correctCount: index+1})),
  ];
  /** The source archive is completed, owned and linked to the exact challenge clocks and rules. */
  const run: RaceRunRecord = {runId: RUN, userId: A, role: "creator", status: "completed", result: "recorded", categoryId: "history", locale,
    rulesVersion: RACE_RULES.version, rulesSnapshot: RACE_RULES, deckId: DECK, riddles, currentPosition: skipped ? 10 : 9, correctCount: 10,
    guessesUsed: 0, guessHistory: [], hintUsed: false, revealedLetters: [], startedAtMs: NOW-50000,
    finishedAtMs: NOW-50000+wallFinishMs, wallFinishMs, hintPenaltyMs: 0, skipPenaltyMs, events, evaluationPolicy: "preloaded"};
  /** Modern snapshots and legacy hydration retain the same byte-exact ordered content. */
  const challenge: RaceChallengeRecord = {challengeId: privateInvite ? INVITE : CHALLENGE, ...(privateInvite ? {scope: "invitation" as const} : {scope: "public" as const}), creatorId: A, creatorRunId: RUN, creatorSnapshot: {displayName: "Recorded Alice"},
    categoryId: "history", locale, deckId: DECK, canonicalRiddleIds: riddles.map(riddle => riddle.canonicalRiddleId), targetCorrect: 10,
    creatorWallFinishMs: wallFinishMs, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: skipPenaltyMs, creatorTotalPenaltyMs: skipPenaltyMs,
    creatorAdjustedFinishMs: wallFinishMs+skipPenaltyMs, ghostEvents: events, rules: RACE_RULES, contentVersion: raceDeckContentVersion(riddles),
    status: "active", createdAtMs: NOW-30000, expiresAtMs: NOW+100000, ...(modern ? {riddles, snapshotVersion: 1 as const} : {})};
  await db.doc(`users/${A}`).set({username: "Recorded Alice", coins: 100}); await db.doc(`users/${B}`).set({username: "Recorded Bob", coins: 100});
  await db.doc(`raceRuns/${RUN}`).set(run); await db.doc(`raceChallenges/${challenge.challengeId}`).set(challenge);
  await db.doc(`raceDecks/${DECK}`).set({deckId: DECK, categoryId: "history", locale, canonicalRiddleIds: challenge.canonicalRiddleIds, rulesVersion: RACE_RULES.version, createdAtMs: NOW-50000});
  if (privateInvite) await db.doc(`raceInviteLobbies/${INVITE}`).set({challengeId: INVITE, creatorId: A, locale, status: "published",
    claimState: "unclaimed", publicationState: "published", createdAtMs: NOW-10000, expiresAtMs: NOW+100000});
  return {run, challenge};
};


/** Optional demo-only traces retain actual responses and original seat versions before assertions. */
const trace = (name: string, value: unknown) => {
  /** The invoking owned emulator command supplies its private evidence directory. */
  const directory = process.env.RACE_ENTRY_COMPAT_TRACE;
  if (!directory) return;
  mkdirSync(directory, {recursive: true});writeFileSync(join(directory, `${name}.json`), JSON.stringify(value, null, 2));
};
/** Original malformed content must be rejected even when its current prompt remains healthy. */
const badKinds = ["space", "oversized-answer", "oversized-clue"] as const;
/** Changes immutable fixture bytes explicitly and keeps its modern fingerprint consistent. */
const corrupt = async (modern: boolean, privateInvite: boolean, kind: typeof badKinds[number], position: number) => {
  /** Completed authoritative recording supplies the original ordered content. */
  const source = await db.doc(`raceRuns/${RUN}`).get();
  /** The fixture modifies only the chosen original question. */
  const riddles: RaceRunRecord["riddles"] = source.data()!.riddles.map((riddle: RaceRunRecord["riddles"][number], index: number) => index === position ? {
    ...riddle, ...(kind === "oversized-clue" ? {text: "Q".repeat(2001)} : {answer: kind === "space" ? "a b" : "x".repeat(129)}),
  } : riddle);
  await db.doc(`raceRuns/${RUN}`).update({riddles});
  /** Modern publication and legacy archive refer to their own original retained deck. */
  const id = privateInvite ? INVITE : CHALLENGE;
  await db.doc(`raceChallenges/${id}`).update({contentVersion: raceDeckContentVersion(riddles), ...(modern ? {riddles} : {})});
};
/** Captures real document versions as well as values so failed admission cannot secretly rewrite a seat. */
const state = async (id: string) => {
  /** Canonical source, recording, lobby and both profiles are the authoritative admission effects. */
  const snapshots = await Promise.all([`raceRuns/${RUN}`, `raceChallenges/${id}`, `raceInviteLobbies/${id}`, `users/${A}`, `users/${B}`].map(path => db.doc(path).get()));
  return snapshots.map(snapshot => ({path: snapshot.ref.path, data: snapshot.data() ?? null, version: snapshot.updateTime?.valueOf() ?? null}));
};
/** No rejected reader or claim may issue an attempt, match profile, new run or request receipt. */
const expectNoAcceptance = async () => {
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);expect((await db.collection("raceStartRequests").get()).empty).toBe(true);
  expect((await db.collection("raceRuns").get()).size).toBe(1);expect((await db.collection("raceDecks").get()).size).toBe(1);
  expect((await db.collection(`users/${B}/raceMatchProfiles`).get()).empty).toBe(true);
};
/** Fresh recipients must not see ready content or occupy a seat for an unplayable original deck. */
const entryCases = [true, false].flatMap(modern => [true, false].flatMap(privateInvite => [0, 14].flatMap(position => badKinds.map(kind => ({modern, privateInvite, position, kind})))));
it.each(entryCases)("refuses unplayable recorded entry, modern=$modern private=$privateInvite kind=$kind position=$position", async ({modern, privateInvite, kind, position}) => {
  await seed(modern, "piano", 14, "en", privateInvite);await corrupt(modern, privateInvite, kind, position);
  /** Readiness failure must leave exclusive reservations, original content and balances untouched. */
  const id = privateInvite ? INVITE : CHALLENGE, before = await state(id);
  for (const negotiated of [false, true]) {
    /** Both presentation protocols retain the same gameplay admission rule. */
    const result = await getRaceEntryForUser(B, id, "en", {db, nowMs: NOW, includeExistingAttempt: negotiated, includeViewerRole: negotiated});
    trace(`entry-${modern}-${privateInvite}-${kind}-${position}-${negotiated}`, {result, before, after: await state(id)});
    expect(result).toMatchObject({status: "unavailable", reason: "invalid"});
    expect(await state(id)).toEqual(before);await expectNoAcceptance();
  }
  /** Direct production hydration confirms that this is a compatibility failure, not a preview or identity fixture error. */
  await expect(seedRecord(id).then(record => resolveChallengeRiddles(db, "en", record))).rejects.toMatchObject({code: "data-loss"});
  /** Completed creators retain their existing outcome/cancellation journey rather than attempting to consume a new deck. */
  expect(await getRaceEntryForUser(A, id, "en", {db, nowMs: NOW, includeViewerRole: true})).toMatchObject(
    modern && kind === "oversized-clue" ? {status: "unavailable", reason: "invalid"} : {status: "ready", viewerRole: "creator"});
  expect(await state(id)).toEqual(before);
});
/** Reads the typed canonical recording at the same boundary used by public readiness. */
const seedRecord = async (id: string) => {
  /** Source document used solely by the explicit compatibility control. */
  const record = await db.doc(`raceChallenges/${id}`).get();
  return parseChallengeRecord(record.data(), id);
};
/** The older callable claims before requesting its public preview, so this is its actual write seam. */
const legacyCases = [true, false].flatMap(modern => [0, 14].flatMap(position => badKinds.map(kind => ({modern, position, kind}))));
it.each(legacyCases)("legacy preview claim rejects before binding, modern=$modern kind=$kind position=$position", async ({modern, kind, position}) => {
  await seed(modern, "piano", 14, "en", true);await corrupt(modern, true, kind, position);
  /** Failed older claims must preserve all durable seat and source facts. */
  const before = await state(INVITE), result = await claimRaceInviteForUser(B, INVITE, "en", {db, nowMs: NOW}).then(value => ({value}), error => ({error: {code: error.code, message: error.message}}));
  trace(`legacy-${modern}-${kind}-${position}`, {result, before, after: await state(INVITE)});
  expect(result).toMatchObject({error: {code: "data-loss"}});expect(await state(INVITE)).toEqual(before);await expectNoAcceptance();
});
/** Existing supported raw answers still preserve their original bytes through both archive formats. */
const validAnswers = [{locale: "en" as const, answer: "piano"}, {locale: "fr" as const, answer: "élément".normalize("NFD")}, {locale: "hi" as const, answer: "लक्ष्म्यां"}];
/** Public and exclusive readiness must remain usable for all supported native input examples. */
const validCases = [true, false].flatMap(modern => [true, false].flatMap(privateInvite => validAnswers.map(control => ({modern, privateInvite, ...control}))));
it.each(validCases)("preserves ready original entry, modern=$modern private=$privateInvite locale=$locale", async ({modern, privateInvite, locale, answer}) => {
  /** The original current question contains the locale-specific input control. */
  const original = await seed(modern, answer, 0, locale, privateInvite), id = privateInvite ? INVITE : CHALLENGE;
  /** Neither original creator readiness nor public recipient readiness consumes a private seat accidentally. */
  const creator = await getRaceEntryForUser(A, id, locale, {db, nowMs: NOW, includeViewerRole: true});
  expect(creator).toMatchObject({status: "ready", viewerRole: "creator"});
  if (privateInvite) expect((await db.doc(`raceInviteLobbies/${id}`).get()).data()).toMatchObject({claimState: "unclaimed"});
  for (const negotiated of [false, true]) {
    /** Capabilities affect only requested response fields, never canonical readiness. */
    const entry = await getRaceEntryForUser(B, id, locale, {db, nowMs: NOW, includeViewerRole: negotiated, includeExistingAttempt: negotiated});
    expect(entry).toMatchObject({status: "ready"});if (negotiated) expect(entry).toMatchObject({viewerRole: "recipient"});else expect(entry).not.toHaveProperty("viewerRole");
    expect(JSON.stringify(entry)).not.toContain('"answer"');expect(JSON.stringify(entry)).not.toContain('"creatorId"');expect(JSON.stringify(entry)).not.toContain('"recipientId"');
  }
  if (privateInvite) expect(await claimRaceInviteForUser(B, id, locale, {db, nowMs: NOW})).toBe(true);
  await expectNoAcceptance();
  /** The successful accepted run retains the exact original immutable deck. */
  const started = await startRaceRunForUser(B, {locale, challengeId: id, requestId: "compatible-entry-start", includeEvaluation: true}, {db, nowMs: NOW});
  expect((await db.doc(`raceRuns/${started.run.runId}`).get()).data()?.riddles).toEqual(original.run.riddles);
  /** Authoritative scoring consumes the complete native-normalized answer without a hint. */
  const correct = await submitRaceGuessForUser(B, {runId: started.run.runId, riddleId: original.run.riddles[0]!.riddleId, guess: answer.normalize("NFC").toLocaleLowerCase(locale), requestId: "compatible-entry-guess"}, {db, nowMs: NOW+1000});
  expect(correct.run.correctCount).toBe(1);expect(correct.run.totalPenaltyMs).toBe(0);
});
/** New frozen-content checks must not strand a run that was already accepted from a valid original recording. */
const recoveryCases = [true, false].flatMap(modern => [true, false].map(privateInvite => ({modern, privateInvite})));
it.each(recoveryCases)("recovers accepted original run after source corruption, modern=$modern private=$privateInvite", async ({modern, privateInvite}) => {
  /** Accepted commands retain their original question snapshot and idempotency receipt. */
  const original = await seed(modern, "piano", 14, "en", privateInvite), id = privateInvite ? INVITE : CHALLENGE;
  await getRaceEntryForUser(B, id, "en", {db, nowMs: NOW});
  /** Exact request replay proves that admission only affects new journeys. */
  const command = {locale: "en" as const, challengeId: id, requestId: "accepted-entry", includeEvaluation: true};
  /** The receipt precedes deliberate test-only corruption of the retained publication source. */
  const accepted = await startRaceRunForUser(B, command, {db, nowMs: NOW});
  await corrupt(modern, privateInvite, "space", 14);
  /** Existing owner-bound recovery remains independent of the now-unusable publication source. */
  const before = await state(id);
  for (const negotiated of [false, true]) {
    /** Both older and negotiated entry responses remain available for this accepted player. */
    const entry = await getRaceEntryForUser(B, id, "en", {db, nowMs: NOW+1000, includeViewerRole: negotiated, includeExistingAttempt: negotiated});
    expect(entry).toMatchObject({status: "ready"});if (negotiated) expect(entry).toMatchObject({existingRunId: accepted.run.runId});else expect(entry).not.toHaveProperty("existingRunId");
  }
  if (privateInvite) expect(await claimRaceInviteForUser(B, id, "en", {db, nowMs: NOW+1000})).toBe(true);
  expect(await state(id)).toEqual(before);
  /** Retry responses use the current authority clock while preserving the original accepted identity and content. */
  const replay = await startRaceRunForUser(B, command, {db, nowMs: NOW+1000});
  expect(replay.run).toMatchObject({runId: accepted.run.runId, status: accepted.run.status});expect(replay.run.preloadedRiddles).toEqual(accepted.run.preloadedRiddles);
  expect((await db.collection("raceAttempts").get()).size).toBe(1);expect((await db.collection("raceStartRequests").get()).size).toBe(1);
  expect(await resumeRaceRunForUser(B, accepted.run.runId, {db, nowMs: NOW+1000, includeEvaluation: true})).toMatchObject({run: {runId: accepted.run.runId, status: "active"}});
  expect((await db.doc(`raceRuns/${accepted.run.runId}`).get()).data()?.riddles).toEqual(original.run.riddles);
  /** The already-issued healthy current prompt still reaches the authority after corruption elsewhere. */
  const correct = await submitRaceGuessForUser(B, {runId: accepted.run.runId, riddleId: original.run.riddles[0]!.riddleId, guess: "piano", requestId: "accepted-entry-guess"}, {db, nowMs: NOW+1500});
  expect(correct.run.correctCount).toBe(1);
});

/** Reserving a pending recording remains useful before any immutable questions exist. */
it.each([false, true])("keeps pending invitations claimable without unpublished content, legacy=%s", async legacy => {
  /** Actual idempotent reservation creates the independent lobby before recording publication. */
  const reserved = await reserveRaceInviteForUser(A, {locale: "en", requestId: "pending-entry"}, {db, nowMs: NOW});
  await expect(getRaceChallengeForUser(A, reserved.challengeId, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()?.recipientId).toBeUndefined();
  if (legacy) expect(await claimRaceInviteForUser(B, reserved.challengeId, "en", {db, nowMs: NOW+1})).toBe(true);
  expect(await getRaceEntryForUser(B, reserved.challengeId, "en", {db, nowMs: NOW+2})).toMatchObject({status: "waiting", invitation: {claimState: "claimed", publicationState: "pending"}});
  await expect(getRaceChallengeForUser(B, reserved.challengeId, "en", {db, nowMs: NOW+3})).rejects.toMatchObject({code: "not-found"});
  expect((await db.collection("raceChallenges").get()).empty).toBe(true);expect((await db.collection("raceAttempts").get()).empty).toBe(true);
});
/** An earlier seat reservation alone is not proof that a completed recording was accepted. */
it.each([true, false])("rejects unplayable already-claimed entry without an accepted run, modern=%s", async modern => {
  await seed(modern, "a b", 14, "en", true);await db.doc(`raceInviteLobbies/${INVITE}`).update({recipientId: B, claimState: "claimed"});
  /** Invalid admission must preserve the original holder's seat for explicit recovery or cancellation. */
  const before = await state(INVITE);
  expect(await getRaceEntryForUser(B, INVITE, "en", {db, nowMs: NOW, includeExistingAttempt: true})).toMatchObject({status: "unavailable", reason: "invalid"});
  await expect(claimRaceInviteForUser(B, INVITE, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "data-loss"});
  expect(await state(INVITE)).toEqual(before);await expectNoAcceptance();
});
/** Rejection leaves a healthy recording eligible after an explicit fixture-only repair. */
it.each(recoveryCases)("admits a repaired recording without preserving a rejected seat, modern=$modern private=$privateInvite", async ({modern, privateInvite}) => {
  await seed(modern, "a b", 14, "en", privateInvite);
  /** The rejected first recipient must not retain an exclusive reservation. */
  const id = privateInvite ? INVITE : CHALLENGE;
  expect(await getRaceEntryForUser(B, id, "en", {db, nowMs: NOW})).toMatchObject({status: "unavailable", reason: "invalid"});
  await seed(modern, "piano", 14, "en", privateInvite);
  /** A second fixture identity competes through the same real transaction interface. */
  const other = `jest_${"c".repeat(40)}`, responses = await Promise.all([B, other].map(owner => getRaceEntryForUser(owner, id, "en", {db, nowMs: NOW+1})));
  expect(responses.filter(response => response.status === "ready")).toHaveLength(privateInvite ? 1 : 2);
  if (privateInvite) {
    expect(responses.filter(response => response.status === "unavailable" && response.reason === "claimed")).toHaveLength(1);
    /** The single durable winner can recover the same original seat. */
    const owner = (await db.doc(`raceInviteLobbies/${id}`).get()).data()!.recipientId;
    expect(await getRaceEntryForUser(owner, id, "en", {db, nowMs: NOW+2})).toMatchObject({status: "ready", invitation: {claimState: "claimed"}});
  }
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);
});
/** Authorization gates should reject earlier than legacy archive hydration or claim mutation. */
const privacyCases = [true, false].flatMap(modern => ["provider", "blocked", "deleted"].map(gate => ({modern, gate})));
it.each(privacyCases)("keeps private authorization precedence for malformed content, modern=$modern gate=$gate", async ({modern, gate}) => {
  await seed(modern, "a b", 14, "en", true);
  if (gate === "blocked") await db.doc(`users/${A}/blockedRivals/${B}`).set({blocked: true});
  if (gate === "deleted") await db.doc(`jestAccountDeletionTombstones/${B}`).set({deletedAtMs: NOW-1});
  /** Cross-provider callers cannot gain a seat or inspect the source archive. */
  const owner = gate === "provider" ? `facebook_${"b".repeat(40)}` : B, before = await state(INVITE);
  expect(await getRaceEntryForUser(owner, INVITE, "en", {db, nowMs: NOW, includeExistingAttempt: true})).toMatchObject({status: "unavailable", reason: gate === "provider" ? "inactive" : gate});
  await expect(claimRaceInviteForUser(owner, INVITE, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "permission-denied"});
  await expect(getRaceChallengeForUser(owner, INVITE, "en", {db, nowMs: NOW})).rejects.toMatchObject(gate === "deleted" ? {message: "account-deleted"} : {code: "permission-denied"});
  expect(await state(INVITE)).toEqual(before);await expectNoAcceptance();
});
/** Storage failures remain visible and must never be translated into successful legacy entry. */
it.each([false, true])("propagates unavailable legacy archive reads before a seat write, legacy=%s", async legacy => {
  await seed(false, "piano", 14, "en", true);
  /** Only the canonical archive read fails; all authorization and reservation reads use the actual SDK. */
  const failure = new Error("Owned demo archive read unavailable"), original = db.runTransaction.bind(db), before = await state(INVITE);
  /** A narrow transaction proxy retains all real locks, reads, writes and commit behavior. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation(update => original(transaction => update(new Proxy(transaction, {
    /** Only archive reads are fault-injected; all other real SDK members keep their receiver. */
    get(target, key) {
      if (key === "get") return async (reference: FirebaseFirestore.DocumentReference) => {
        if (reference.path === `raceRuns/${RUN}`) throw failure;
        return target.get(reference);
      };
      /** Other SDK methods retain their original receiver and private state. */
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }))));
  try {
    await expect(legacy ? claimRaceInviteForUser(B, INVITE, "en", {db, nowMs: NOW}) : getRaceEntryForUser(B, INVITE, "en", {db, nowMs: NOW})).rejects.toBe(failure);
    expect(await state(INVITE)).toEqual(before);
  } finally {spy.mockRestore();}
});
/** Legacy claim must use the same canonical creator identity that authorized its reservation. */
it.each([true, false])("rejects a recording whose creator no longer matches its reservation, modern=%s", async modern => {
  await seed(modern, "piano", 14, "en", true);await db.doc(`raceChallenges/${INVITE}`).update({creatorId: `jest_${"c".repeat(40)}`});
  /** The original exclusive identity cannot be silently rebound to a different creator. */
  const before = await state(INVITE);
  expect(await getRaceEntryForUser(B, INVITE, "en", {db, nowMs: NOW})).toMatchObject({status: "unavailable", reason: "invalid"});
  await expect(claimRaceInviteForUser(B, INVITE, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "data-loss"});expect(await state(INVITE)).toEqual(before);
});

/** The old callable's user-aware preview must enforce both public and private original-content admission. */
it.each(recoveryCases)("legacy user-bound preview refuses unusable recordings without seat writes, modern=$modern private=$privateInvite", async ({modern, privateInvite}) => {
  await seed(modern, "a b", 14, "en", privateInvite);
  /** One legacy API response cannot consume an unusable canonical seat before rejecting. */
  const id = privateInvite ? INVITE : CHALLENGE, before = await state(id);
  await expect(getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "data-loss"});
  expect(await state(id)).toEqual(before);await expectNoAcceptance();
});
/** Successful legacy previews use one authoritative transaction rather than a detached claim and metadata transaction. */
it.each(recoveryCases)("legacy preview is answer-safe and atomically claims only a healthy seat, modern=$modern private=$privateInvite", async ({modern, privateInvite}) => {
  await seed(modern, "piano", 14, "en", privateInvite);
  /** The SDK spy observes real transaction boundaries without replacing storage behavior. */
  const id = privateInvite ? INVITE : CHALLENGE, spy = jest.spyOn(db, "runTransaction");
  try {
    /** Schema-compatible public metadata never includes canonical player IDs or source answers. */
    const preview = await getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW});
    expect(preview).toMatchObject({challengeId: id, locale: "en", status: "active", adjustedTimeToBeatMs: 10000});expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(preview)).not.toContain('"answer"');expect(JSON.stringify(preview)).not.toContain('"creatorId"');expect(JSON.stringify(preview)).not.toContain('"recipientId"');
  } finally {spy.mockRestore();}
  if (privateInvite) expect((await db.doc(`raceInviteLobbies/${id}`).get()).data()).toMatchObject({recipientId: B, claimState: "claimed"});
  else expect((await db.doc(`raceInviteLobbies/${id}`).get()).exists).toBe(false);
  await expectNoAcceptance();
});
/** A legacy preview reader can still recover an accepted original snapshot after later publication-source corruption. */
it.each(recoveryCases)("legacy preview retains previously accepted source recovery, modern=$modern private=$privateInvite", async ({modern, privateInvite}) => {
  await seed(modern, "piano", 14, "en", privateInvite);
  /** Initial healthy legacy preview reserves the same exclusive recipient seat when present. */
  const id = privateInvite ? INVITE : CHALLENGE;
  await getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW});
  /** Original accepted attempt is the sole exception to new-entry compatibility rejection. */
  const accepted = await startRaceRunForUser(B, {locale: "en", challengeId: id, requestId: "accepted-legacy-preview"}, {db, nowMs: NOW});
  await corrupt(modern, privateInvite, "space", 14);
  /** Canonical source, balances and seat versions remain unchanged during legacy recovery. */
  const before = await state(id);
  expect(await getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW+1000})).toMatchObject({challengeId: id, status: "active"});expect(await state(id)).toEqual(before);
  expect(await resumeRaceRunForUser(B, accepted.run.runId, {db, nowMs: NOW+1000})).toMatchObject({run: {runId: accepted.run.runId, status: "active"}});
});
/** Inactive public metadata remains answer-free, while private closed reservations remain non-claimable. */
const closedCases = [true, false].flatMap(modern => [true, false].flatMap(privateInvite => ["expired", "revoked"].map(status => ({modern, privateInvite, status}))));
it.each(closedCases)("preserves legacy closed-recording contract, modern=$modern private=$privateInvite status=$status", async ({modern, privateInvite, status}) => {
  await seed(modern, "piano", 14, "en", privateInvite);
  /** Closed states are canonical lifecycle facts, not an excuse to claim a fresh seat. */
  const id = privateInvite ? INVITE : CHALLENGE;
  if (status === "expired") {
    await db.doc(`raceChallenges/${id}`).update({expiresAtMs: NOW-1});
    if (privateInvite) await db.doc(`raceInviteLobbies/${id}`).update({expiresAtMs: NOW-1});
  } else {
    await db.doc(`raceChallenges/${id}`).update({status: "revoked"});
    if (privateInvite) await db.doc(`raceInviteLobbies/${id}`).update({cancelledAtMs: NOW-1});
  }
  /** Read-only inactive metadata cannot consume a reservation or acceptance request. */
  const before = await state(id);
  if (privateInvite) await expect(getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW})).rejects.toMatchObject({code: "failed-precondition"});
  else expect(await getRaceChallengeForUser(B, id, "en", {db, nowMs: NOW})).toMatchObject({challengeId: id, status});
  expect(await state(id)).toEqual(before);await expectNoAcceptance();
});
