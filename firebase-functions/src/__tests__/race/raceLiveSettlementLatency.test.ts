import {Timestamp} from "firebase-admin/firestore";
import {cloneLiveRaceFixture} from "./raceLiveFixtureClone";
import {applyRaceGuess} from "../../race/raceEngine";
import {updateLiveRaceForUser} from "../../race/raceLiveService";
import {liveRun, type LiveMatch, type LiveTicket} from "../../race/raceLiveState";
import {JEST_ACCOUNT_DELETION_COLLECTION} from "../../shared/accountDeletion";

/** Fixed authoritative observation clock for every provider. */
const NOW = 1_800_000_000_000;

it.each(["jest", "reddit", "facebook"].flatMap(provider => [
  {provider, winner: 0 as const, retryDeletion: false, sourceReadFails: false},
  {provider, winner: 1 as const, retryDeletion: false, sourceReadFails: false},
  {provider, winner: 0 as const, retryDeletion: true, sourceReadFails: false},
  {provider, winner: 1 as const, retryDeletion: true, sourceReadFails: false},
  {provider, winner: 1 as const, retryDeletion: false, sourceReadFails: true},
]))("settles $provider seat $winner with retry deletion $retryDeletion and source failure $sourceReadFails", async ({provider, winner, retryDeletion, sourceReadFails}) => {
  jest.useFakeTimers().setSystemTime(NOW);
  try {
    /** A finished human match still needs its atomic economy settlement. */
    const base = {locale: "en" as const, categoryId: "history" as const, contentVersion: "settlement-latency-v1",
      riddles: Array.from({length: 30}, (_, position) => ({position, riddleId: `q${position}`,
        canonicalRiddleId: `history:${position}`, text: `Historical clue number ${position}`, answer: "piano"}))};
    /** Each provider retains two canonical authenticated human accounts. */
    const OWNER = `${provider}_${"a".repeat(40)}`, RIVAL = `${provider}_${"b".repeat(40)}`;
    /** Both tickets retain canonical account ownership and the shared match binding. */
    const ticketIds = ["a".repeat(64), "b".repeat(64)] as const, users = [OWNER, RIVAL] as const;
    /** The match began before this result observation. */
    const startsAtMs = NOW - 1000;
    /** Private runs retain the real engine and public projection. */
    const runs = users.map((user, seat) => applyRaceGuess(liveRun(base, user, ticketIds[seat]!, startsAtMs),
      {riddleId: "q0", guess: "piano"}, NOW).run) as LiveMatch["runs"];
    /** Public identity is still present until fresh privacy checks complete. */
    const players = users.map((_, seat) => ({displayName: seat ? "Bob" : "Alice", avatarUrl: null, bot: false, correctCount: 0})) as LiveMatch["players"];
    /** Terminal state has not granted either human account yet. */
    const match: LiveMatch = {tickets: [...ticketIds], startsAtMs, observedAtMs: NOW, players, runs, winner};
    /** In-memory persistence gives every read the same 200ms transport cost. */
    const documents = new Map<string, unknown>([[`liveRaceMatches/${ticketIds[0]}`, {...match, expiresAt: Timestamp.fromMillis(NOW + 86_400_000)}]]);
    users.forEach((userId, seat) => {
      /** Facebook destinations remain frozen independently for each private ticket. */
      const ticket: LiveTicket = {userId, pool: "pool", createdAtMs: startsAtMs - 5000, seenAtMs: startsAtMs,
        matchId: ticketIds[0], player: players[seat]!, run: runs[seat]!,
        ...(provider === "facebook" ? {facebookContext: {contextKey: ticketIds[seat]!, createdAtMs: startsAtMs - 5000, joinedAtMs: startsAtMs - 2000}} : {})};
      documents.set(`liveRaceTickets/${ticketIds[seat]}`, {...ticket, expiresAt: Timestamp.fromMillis(NOW + 86_400_000)});
      documents.set(`users/${userId}`, {coins: 100});
    });
    /** Read trace proves canonical checks remain present and no document is fetched twice. */
    const reads: string[] = [];
    /** Queued writes model Firestore's read-before-write requirement. */
    const writes: string[] = [];
    /** Implements the service's normal transactional document operations. */
    const transaction = {
      get: async (ref: {
        /** Canonical document path. */
        path: string;
      }) => {
        expect(writes).toHaveLength(0);
        reads.push(ref.path);
        await new Promise(resolve => setTimeout(resolve, 200));
        if (sourceReadFails && ref.path === `liveRaceTickets/${ticketIds[1]}`) throw new Error("Winner source read unavailable");
        return {ref, exists: documents.has(ref.path), data: () => cloneLiveRaceFixture(documents.get(ref.path))};
      },
      set: (ref: {
        /** Canonical document path. */
        path: string;
      }, value: unknown) => {writes.push(ref.path); documents.set(ref.path, value);},
      create: (ref: {
        /** Canonical document path. */
        path: string;
      }, value: unknown) => {writes.push(ref.path); documents.set(ref.path, value);},
      update: (ref: {
        /** Canonical document path. */
        path: string;
      }, value: unknown) => {writes.push(ref.path); documents.set(ref.path, {...documents.get(ref.path) as object, ...value as object});},
    };
    /** Discarding an attempt must also discard every tentative profile or match write. */
    const initialDocuments = new Map([...documents].map(([path, value]) => [path, cloneLiveRaceFixture(value)]));
    /** Only the first invocation retries; later polls exercise receipt idempotency. */
    let firstInvocation = true;
    /** Isolated database invokes the actual settlement implementation. */
    const db = {doc: (path: string) => ({path}), collection: (path: string) => ({doc: (id: string) => ({path: `${path}/${id}`})}),
      runTransaction: async (operation: (value: typeof transaction) => unknown) => {
        if (firstInvocation && retryDeletion) {
          await operation(transaction);
          documents.clear(); initialDocuments.forEach((value, path) => documents.set(path, cloneLiveRaceFixture(value)));
          documents.set(`${JEST_ACCOUNT_DELETION_COLLECTION}/${RIVAL}`, {recreationBlocked: true});
          writes.length = 0;
        }
        firstInvocation = false;
        return operation(transaction);
      }} as unknown as FirebaseFirestore.Firestore;
    /** Polling accepts no new command but must finish the existing authoritative result. */
    const result = updateLiveRaceForUser(OWNER, {ticketId: ticketIds[0], action: "poll", requestId: "result-latency"},
      {db, nowMs: NOW, authorize: async () => {await new Promise(resolve => setTimeout(resolve, 200));}})
      .then(value => ({value, error: undefined}), error => ({value: undefined, error}));
    await jest.runAllTimersAsync();
    if (process.env.LIVE_SETTLEMENT_TRACE) console.info(JSON.stringify({provider, winner, retryDeletion, sourceReadFails, elapsedMs: Date.now() - NOW, reads}));
    if (provider === "facebook" && sourceReadFails) {
      expect((await result).error).toEqual(new Error("Winner source read unavailable"));
      expect(writes).toHaveLength(0);
      expect(users.map(user => documents.get(`users/${user}`))).toEqual([{coins: 100}, {coins: 100}]);
      return;
    }
    expect(await result).toMatchObject({value: {phase: "result", result: winner === 0 ? "win" : "loss", rewardCoins: winner === 0 ? 50 : 0}});
    expect(reads.filter(path => path === `${JEST_ACCOUNT_DELETION_COLLECTION}/${OWNER}`)).toHaveLength(retryDeletion ? 2 : 1);
    expect(reads.filter(path => path === `${JEST_ACCOUNT_DELETION_COLLECTION}/${RIVAL}`)).toHaveLength(retryDeletion ? 2 : 1);
    expect(reads).toHaveLength((provider === "facebook" && winner === 1 ? 9 : 8) * (retryDeletion ? 2 : 1));
    expect(reads.includes(`liveRaceTickets/${ticketIds[1]}`)).toBe(provider === "facebook" && winner === 1);
    expect(Date.now() - NOW).toBe(800 * (retryDeletion ? 2 : 1));
    expect(writes).toContain(`users/${OWNER}`);
    if (retryDeletion) {
      expect(writes).not.toContain(`users/${RIVAL}`);
      expect(documents.get(`users/${RIVAL}`)).toEqual({coins: 100});
      expect((await result).value?.opponent).toMatchObject({displayName: "Riddle Quest player", avatarUrl: null});
    } else expect(writes).toContain(`users/${RIVAL}`);
    /** Provider delivery keeps only the accepted winner and its original destination. */
    const deliveries = [...documents.entries()].filter(([path]) => path.startsWith("racePerformanceOutbox/"));
    expect(deliveries).toHaveLength(provider === "jest" || retryDeletion && winner === 1 ? 0 : 1);
    if (deliveries.length) {
      expect(deliveries[0]![1]).toMatchObject({userId: users[winner], liveTicketId: ticketIds[winner], source: `${provider}_live`});
      if (provider === "facebook") expect(deliveries[0]![1]).toMatchObject({facebookContext: {
        contextKey: ticketIds[winner], createdAtMs: startsAtMs - 5000, joinedAtMs: startsAtMs - 2000,
      }});
      else expect(deliveries[0]![1]).not.toHaveProperty("facebookContext");
    }
    /** A repeated observation cannot pay either participant again. */
    const profiles = users.map(user => structuredClone(documents.get(`users/${user}`)));
    reads.length = 0; writes.length = 0;
    /** A committed result remains idempotent on the next independent request. */
    const replay = updateLiveRaceForUser(OWNER, {ticketId: ticketIds[0], action: "poll", requestId: "result-latency-replay"}, {db, nowMs: NOW});
    await jest.runAllTimersAsync(); await replay;
    expect(users.map(user => documents.get(`users/${user}`))).toEqual(profiles);
    expect(writes).toHaveLength(0);
  } finally {jest.useRealTimers();}
});
