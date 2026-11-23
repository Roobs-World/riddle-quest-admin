import {Timestamp} from "firebase-admin/firestore";
import {cloneLiveRaceFixture} from "./raceLiveFixtureClone";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {liveRun, type LiveMatch, type LiveTicket} from "../../race/raceLiveState";

/** Fixed authoritative observation clock and authenticated provider subjects. */
const NOW = 1_800_000_000_000, OWNER = `jest_${"a".repeat(40)}`, RIVAL = `jest_${"b".repeat(40)}`;

it.each(["poll", "guess"] as const)("delivers a human %s within three database round trips", async action => {
  jest.useFakeTimers().setSystemTime(NOW);
  try {
    /** Valid private deck exercises the real action engine and safe projection. */
    const base = {locale: "en" as const, categoryId: "history" as const, contentVersion: "latency-v1",
      riddles: Array.from({length: 30}, (_, position) => ({position, riddleId: `q${position}`,
        canonicalRiddleId: `history:${position}`, text: `Historical clue number ${position}`, answer: "piano"}))};
    /** Matched tickets and runs retain the same atomic authority as production. */
    const ticketId = "a".repeat(64), rivalId = "b".repeat(64), startsAtMs = NOW - 1000;
    /** Provides player behavior. */
    const player = {displayName: "Alice", avatarUrl: null, level: 36, bot: false, correctCount: 0};
    /** Provides ticket behavior. */
    const ticket: LiveTicket = {userId: OWNER, pool: "pool", createdAtMs: startsAtMs - 5000,
      seenAtMs: startsAtMs, matchId: ticketId, player, run: liveRun(base, OWNER, ticketId, startsAtMs)};
    /** Provides match behavior. */
    const match: LiveMatch = {tickets: [ticketId, rivalId], startsAtMs, observedAtMs: NOW,
      players: [player, {...player, displayName: "Bob", level: 10}],
      runs: [liveRun(base, OWNER, ticketId, startsAtMs), liveRun(base, RIVAL, rivalId, startsAtMs)]};
    /** Every independent database read incurs the same deterministic 200ms RPC cost. */
    const documents = new Map<string, unknown>([[`liveRaceTickets/${ticketId}`, {...ticket, expiresAt: Timestamp.fromMillis(NOW + 86_400_000)}],
      [`liveRaceMatches/${ticketId}`, {...match, expiresAt: Timestamp.fromMillis(NOW + 86_400_000)}]]);
    /** Provides reads behavior. */
    const reads: string[] = [];
    /** Provides transaction behavior. */
    const transaction = {
      get: async (ref: {/** Stores path. */
      /** Stores path. */
      path: string}) => {
        reads.push(ref.path);
        await new Promise(resolve => setTimeout(resolve, 200));
        return {exists: documents.has(ref.path), data: () => cloneLiveRaceFixture(documents.get(ref.path))};
      },
      set: (ref: {/** Stores path. */
      /** Stores path. */
      path: string}, value: unknown) => documents.set(ref.path, value),
      create: (ref: {/** Stores path. */
      /** Stores path. */
      path: string}, value: unknown) => documents.set(ref.path, value),
      update: () => { throw new Error("This observation must not grant rewards or change the seat"); },
    };
    /** Injected transport retains the real transaction callback and all privacy reads. */
    const db = {doc: (path: string) => ({path}), collection: (path: string) => ({doc: (id: string) => ({path: `${path}/${id}`})}),
      runTransaction: async (operation: (value: typeof transaction) => unknown) => operation(transaction)} as unknown as FirebaseFirestore.Firestore;
    /** Provides result behavior. */
    const result = updateLiveRaceForUser(OWNER, {ticketId, action, requestId: "latency-request",
      ...(action === "guess" ? {riddleId: "q0", guess: "piano"} : {})}, {db, nowMs: NOW,
      authorize: async () => {await new Promise(resolve => setTimeout(resolve, 200));},
    }).then(value => ({value}), error => ({error}));
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({value: {phase: "racing", player: {level: 36, correctCount: action === "guess" ? 1 : 0}, opponent: {level: 10}}});
    expect(reads).toHaveLength(action === "guess" ? 7 : 6);
    expect(Date.now() - NOW).toBe(600);
  } finally {jest.useRealTimers();}
});

it("rejects denied access before any live action or transaction write", async () => {
  /** Even an otherwise invalid seat must not bypass the supplied authoritative access gate. */
  const write = jest.fn();
  /** Reads can overlap authorization, but no mutations may run before it succeeds. */
  const transaction = {get: async () => ({exists: true, data: () => ({userId: OWNER})}),
    set: write, create: write, update: write};
  /** Isolated callback exercises the real service ordering without committing state. */
  const db = {doc: (path: string) => ({path}), collection: (path: string) => ({doc: (id: string) => ({path: `${path}/${id}`})}),
    runTransaction: async (operation: (value: typeof transaction) => unknown) => operation(transaction),
  } as unknown as FirebaseFirestore.Firestore;
  await expect(updateLiveRaceForUser(OWNER, {ticketId: "a".repeat(64), action: "leave", requestId: "denied-leave"},
    {db, nowMs: NOW, authorize: async () => {throw new Error("rollout denied");}})).rejects.toThrow("rollout denied");
  expect(write).not.toHaveBeenCalled();
});

it("validates one deck per join even when the queue transaction retries", async () => {
  /** Real pool validation consumes these unique authored records. */
  const docs = Array.from({length: 30}, (_, index) => ({id: `history-${index}`,
    ref: {path: `localizedRiddles/en/riddles/history-${index}`}, data: () => ({
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  })}));
  /** A catalog RPC must not be repeated while Firestore retries the shared queue lock. */
  const contentRead = jest.fn(async () => ({docs}));
  /** Projection remains one catalog RPC in this immutable-deck retry fixture. */
  const projectedQuery = {get: contentRead, select: () => ({get: contentRead})};
  /** The catalog and deletion collection share the normal database API. */
  const collection = (path: string): unknown => ({doc: (id: string) => ({path: `${path}/${id}`}),
    where: () => ({...projectedQuery, where: () => projectedQuery})});
  /** Failed transaction attempts discard their queued writes before retrying. */
  const transaction = {get: async (ref: {
    /** Owned or shared document path. */
    path: string;
  }) => ({
    exists: ref.path === `users/${OWNER}`, data: () => ref.path === `users/${OWNER}` ? {username: "Alice"} : undefined,
  }), create: jest.fn(), set: jest.fn(), update: jest.fn()};
  /** Masked profile transport retains the same single physical read in this catalog-retry fixture. */
  const maskedTransaction = {...transaction, getAll: async (ref: Parameters<typeof transaction.get>[0], _options: unknown) => [await transaction.get(ref)]};
  /** Firestore retries the callback without committing the first attempt's writes. */
  const db = {doc: (path: string) => ({path}), collection,
    runTransaction: async (operation: (value: typeof transaction) => unknown) => {
      await operation(maskedTransaction);
      transaction.create.mockClear(); transaction.set.mockClear(); transaction.update.mockClear();
      return operation(maskedTransaction);
    }} as unknown as FirebaseFirestore.Firestore;
  expect(await joinLiveRaceForUser(OWNER, {locale: "en", categoryId: "history", requestId: "retry-latency-join"}, {db, nowMs: NOW}))
    .toMatchObject({phase: "searching", player: {displayName: "Alice"}});
  expect(contentRead).toHaveBeenCalledTimes(1);
  expect(transaction.create).toHaveBeenCalledTimes(1);
});
