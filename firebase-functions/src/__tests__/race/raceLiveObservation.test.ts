import {updateLiveRaceForUser} from "../../race/raceLiveService";
import {liveRun, type LiveMatch, type LiveTicket} from "../../race/raceLiveState";

/** Fixed authoritative clock and provider subjects. */
const NOW = 1_800_000_000_000, OWNER = `jest_${"a".repeat(40)}`, RIVAL = `jest_${"b".repeat(40)}`;
/** Seat identifiers. */
const ticketId = "a".repeat(64), rivalId = "b".repeat(64);

/** Valid private deck exercising the real engine. */
const base = {locale: "en" as const, categoryId: "history" as const, contentVersion: "observation-v1",
  riddles: Array.from({length: 30}, (_, position) => ({position, riddleId: `q${position}`,
    canonicalRiddleId: `history:${position}`, text: `Historical clue number ${position}`, answer: "piano"}))};

/** Database fake recording transaction modes and writes. */
function createDb(documents: Map<string, unknown>) {
  /** Modes of every transaction started. */
  const modes: string[] = [];
  /** Paths written by committed transactions. */
  const writes: string[] = [];
  /** Records a write. */
  const write = (ref: {
    /** Document path. */
    path: string;
  }, value?: unknown) => {
    writes.push(ref.path);
    if (value !== undefined) documents.set(ref.path, value);
  };
  /** Transaction stub backed by the document map. */
  const transaction = {
    get: async (ref: {
    /** Document path. */
    path: string;
  }) =>
      ({exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path))}),
    set: write, create: write, delete: write,
    update: (ref: {
    /** Document path. */
    path: string;
  }, value: object) =>
      write(ref, {...documents.get(ref.path) as object, ...value}),
  };
  /** Minimal Firestore surface used by the live service. */
  const db = {
    doc: (path: string) => ({path}),
    collection: (path: string) => ({doc: (id: string) => ({path: `${path}/${id}`})}),
    runTransaction: async (operation: (value: typeof transaction) => unknown, options?: {
      /** Read-only flag. */
      readOnly?: boolean;
    }) => {
      modes.push(options?.readOnly ? "read-only" : "read-write");
      return operation(transaction);
    },
  } as unknown as FirebaseFirestore.Firestore;
  return {db, modes, writes};
}

/** Racing human match whose start was already observed. */
function racingDocuments(): Map<string, unknown> {
  /** Shared starting time. */
  const startsAtMs = NOW - 1000;
  /** Public player projection. */
  const player = {displayName: "Alice", avatarUrl: null, level: 3, bot: false, correctCount: 0};
  /** Owner ticket. */
  const ticket: LiveTicket = {userId: OWNER, pool: "pool", createdAtMs: startsAtMs - 5000, seenAtMs: startsAtMs,
    matchId: ticketId, player, run: liveRun(base, OWNER, ticketId, startsAtMs)};
  /** Shared match. */
  const match: LiveMatch = {tickets: [ticketId, rivalId], startsAtMs, observedAtMs: NOW, participantIds: [OWNER, RIVAL],
    players: [player, {...player, displayName: "Bob"}],
    runs: [liveRun(base, OWNER, ticketId, startsAtMs), liveRun(base, RIVAL, rivalId, startsAtMs)]};
  return new Map<string, unknown>([[`liveRaceTickets/${ticketId}`, {...ticket, expiresAt: "expiry"}],
    [`liveRaceMatches/${ticketId}`, match]]);
}

/** Polls the owner's seat. */
const poll = (db: FirebaseFirestore.Firestore, requestId: string) =>
  updateLiveRaceForUser(OWNER, {ticketId, action: "poll", requestId}, {db, nowMs: NOW});

it("serves repeat unchanged racing polls from lock-free read-only transactions", async () => {
  /** Fake database. */
  const {db, modes, writes} = createDb(racingDocuments());
  await expect(poll(db, "poll-1")).resolves.toMatchObject({phase: "racing", opponent: {displayName: "Bob"}});
  await expect(poll(db, "poll-2")).resolves.toMatchObject({phase: "racing", opponent: {displayName: "Bob"}});
  await expect(poll(db, "poll-3")).resolves.toMatchObject({phase: "racing"});
  expect(modes).toEqual(["read-write", "read-only", "read-only"]);
  expect(writes).toEqual([]);
});

it("re-evaluates a hinted poll that must persist state in a read-write transaction", async () => {
  /** Shared documents mutated between polls. */
  const documents = racingDocuments();
  /** Fake database. */
  const {db, modes, writes} = createDb(documents);
  await poll(db, "poll-1");
  // The shared start has not been persisted yet, so the next observation must write it.
  (documents.get(`liveRaceMatches/${ticketId}`) as LiveMatch).observedAtMs = NOW - 2000;
  await expect(poll(db, "poll-2")).resolves.toMatchObject({phase: "racing"});
  expect(modes).toEqual(["read-write", "read-only", "read-write"]);
  expect(writes).toContain(`liveRaceMatches/${ticketId}`);
  await poll(db, "poll-3");
  await poll(db, "poll-4");
  // The write clears the hint; one pure read-write observation restores lock-free polling.
  expect(modes.slice(3)).toEqual(["read-write", "read-only"]);
});

it("keeps lease-refreshing lobby polls on the read-write path", async () => {
  /** Unmatched seat whose lease is refreshed by every poll. */
  const ticket: LiveTicket = {userId: OWNER, pool: "pool", createdAtMs: NOW - 1000, seenAtMs: NOW - 1000,
    player: {displayName: "Alice", avatarUrl: null, level: 3, bot: false, correctCount: 0},
    run: liveRun(base, OWNER, ticketId, NOW)};
  /** Fake database. */
  const {db, modes, writes} = createDb(new Map([[`liveRaceTickets/${ticketId}`, {...ticket, expiresAt: "expiry"}]]));
  await expect(poll(db, "poll-1")).resolves.toMatchObject({phase: "searching"});
  await expect(poll(db, "poll-2")).resolves.toMatchObject({phase: "searching"});
  expect(modes).toEqual(["read-write", "read-write"]);
  expect(writes).toEqual([`liveRaceTickets/${ticketId}`, `liveRaceTickets/${ticketId}`]);
});

it("does not retry a rejected read-only observation as a write", async () => {
  /** Shared documents mutated between polls. */
  const documents = racingDocuments();
  /** Fake database. */
  const {db, modes} = createDb(documents);
  await poll(db, "poll-1");
  documents.delete(`liveRaceTickets/${ticketId}`);
  await expect(poll(db, "poll-2")).rejects.toMatchObject({code: "not-found"});
  expect(modes).toEqual(["read-write", "read-only"]);
});

it("commits player commands directly in a read-write transaction", async () => {
  /** Fake database. */
  const {db, modes, writes} = createDb(racingDocuments());
  await poll(db, "poll-1");
  await expect(updateLiveRaceForUser(OWNER, {ticketId, action: "guess", requestId: "guess-1", riddleId: "q0", guess: "piano"},
    {db, nowMs: NOW})).resolves.toMatchObject({player: {correctCount: 1}});
  expect(modes).toEqual(["read-write", "read-write"]);
  expect(writes).toContain(`liveRaceMatches/${ticketId}`);
});
