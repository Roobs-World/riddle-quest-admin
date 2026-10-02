import {updateLiveRaceForUser} from "../../race/raceLiveService";
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
    const player = {displayName: "Alice", avatarUrl: null, bot: false, correctCount: 0};
    /** Provides ticket behavior. */
    const ticket: LiveTicket = {userId: OWNER, pool: "pool", createdAtMs: startsAtMs - 5000,
      seenAtMs: startsAtMs, matchId: ticketId, player, run: liveRun(base, OWNER, ticketId, startsAtMs)};
    /** Provides match behavior. */
    const match: LiveMatch = {tickets: [ticketId, rivalId], startsAtMs, observedAtMs: NOW,
      players: [player, {...player, displayName: "Bob"}],
      runs: [liveRun(base, OWNER, ticketId, startsAtMs), liveRun(base, RIVAL, rivalId, startsAtMs)]};
    /** Every independent database read incurs the same deterministic 200ms RPC cost. */
    const documents = new Map<string, unknown>([[`liveRaceTickets/${ticketId}`, {...ticket, expiresAt: "expiry"}],
      [`liveRaceMatches/${ticketId}`, match]]);
    /** Provides reads behavior. */
    const reads: string[] = [];
    /** Provides transaction behavior. */
    const transaction = {
      get: async (ref: {/** Stores path. */
      /** Stores path. */
      path: string}) => {
        reads.push(ref.path);
        await new Promise(resolve => setTimeout(resolve, 200));
        return {exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path))};
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
      ...(action === "guess" ? {riddleId: "q0", guess: "piano"} : {})}, {db, nowMs: NOW}).then(value => ({value}), error => ({error}));
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({value: {phase: "racing", player: {correctCount: action === "guess" ? 1 : 0}}});
    expect(reads).toHaveLength(action === "guess" ? 7 : 6);
    expect(Date.now() - NOW).toBe(600);
  } finally {jest.useRealTimers();}
});
