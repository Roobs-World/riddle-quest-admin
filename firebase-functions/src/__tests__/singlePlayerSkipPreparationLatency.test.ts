import {createHash} from "node:crypto";
import {jest, it, expect, beforeEach} from "@jest/globals";

/** Actual callable and skip transaction share this deterministic persistence seam. */
const mockDocuments = new Map<string, Record<string, any>>();
/** Every entry identifies one document read, including a redundant standalone session fetch. */
const mockReads: string[] = [];
/** One simulated transport stage costs 200 ms; commit latency is outside this fixture. */
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));
/** Snapshots copy stored state so later mutations cannot change an earlier observation. */
const mockSnapshot = (path: string) => ({exists: mockDocuments.has(path), data: () => {
  /** Stored expiry retains its SDK-like conversion method while other state is copied. */
  const value = mockDocuments.get(path);
  return value ? {...structuredClone({...value, expiresAt: undefined}), expiresAt: value.expiresAt} : undefined;
}});
/** Document references retain actual nested session paths. */
const mockRef = (path: string): any => ({path,
  get: async () => {mockReads.push(`direct:${path}`); await mockDelay(); return mockSnapshot(path);},
  collection: (name: string) => ({doc: (id: string) => mockRef(`${path}/${name}/${id}`)}),
});
/** The real skip callback uses parallel account/session reads and its normal writes. */
const mockTransaction = {
  get: async (ref: any) => {mockReads.push(`transaction:${ref.path}`); await mockDelay(); return mockSnapshot(ref.path);},
  update: (ref: any, patch: Record<string, any>) => {
    /** Applies Firestore dotted field patches without replacing unrelated counters. */
    const value = mockDocuments.get(ref.path)!;
    for (const [key, item] of Object.entries(patch)) {
      /** Nested update cursor follows the canonical field path. */
      const parts = key.split(".");
      /** Traverses the stored map while applying the real transaction patch. */
      let cursor = value;
      for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
      cursor[parts.at(-1)!] = item;
    }
  },
  set: (ref: any, value: Record<string, any>) => mockDocuments.set(ref.path, value),
};
/** Only the database transport and derived supply task are simulated. */
const mockFirestore = Object.assign(() => ({collection: (name: string) => ({doc: (id: string) => mockRef(`${name}/${id}`)}),
  runTransaction: async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction)}),
  {FieldValue: {serverTimestamp: () => "server-time"}});
/** Captures the canonical supply inputs delivered after the skip commits. */
const mockSupply = jest.fn(async (_user: string, _index: number, _locale: string) => new Promise(resolve => setTimeout(resolve, 400)));
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
// Account leases and HTTP transport are outside this timing fixture; domain request/response validation stays real.
jest.mock("../shared/sentryHandlers", () => ({onCallWithSentry: (_name: string, _options: unknown, handler: unknown) => ({run: handler})}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: (...args: [string, number, string]) => mockSupply(...args)}));
import {skipRiddle} from "../gameplay/callables/gameLogic";

/** A valid immutable opaque token binds the same Classic request on every replay. */
const TOKEN = "00000000-0000-4000-8000-000000000001";
/** Production token hashing is duplicated only to seed the private fixture document. */
const SESSION = `users/player-1/singlePlayerSessions/${createHash("sha256").update(TOKEN).digest("hex")}`;
/** Real callable validation receives the normal authenticated request shape. */
const skip = () => skipRiddle.run({auth: {uid: "player-1"}, data: {gameMode: "classic", riddleId: "classic-1", sessionToken: TOKEN, requestId: "skip-context-request"}} as never);
beforeEach(() => {mockDocuments.clear(); mockReads.length = 0; mockSupply.mockClear();});

it("prepares skipped Classic content with one parallel transaction read stage", async () => {
  jest.useFakeTimers().setSystemTime(1_800_000_000_000);
  try {
    mockDocuments.set("users/player-1", {coins: 550, hasPurchasedApp: true, progress: {classicIndex: 1}, stats: {classicSkipped: 2, multiplayerWins: 9}});
    mockDocuments.set(SESSION, {gameMode: "classic", riddleId: "classic-1", locale: "fr", contentKey: "classic-fr-1", completionKey: "classic:1",
      answer: "piano", classicIndex: 1, terminal: false, expiresAt: {toDate: () => new Date(1_800_000_060_000)}});
    /** Deterministic elapsed time includes the real ordering of reads and awaited content preparation. */
    const start = Date.now();
    /** Starts the actual handler before advancing its deterministic read/supply timers. */
    const pending = skip(); await jest.runAllTimersAsync();
    /** Validated public response contains only the normal skip fields. */
    const result = await pending;
    if (process.env.SINGLE_PLAYER_SKIP_TRACE) console.info(JSON.stringify({elapsedMs: Date.now() - start, reads: mockReads}));
    expect(Date.now() - start).toBe(600);
    expect(mockReads).toHaveLength(2);
    expect(result).toMatchObject({success: true, costDeducted: 100, newCoins: 450, newProgress: {classicIndex: 2}});
    expect(result).not.toHaveProperty("classicSupply");
    expect(mockSupply).toHaveBeenCalledWith("player-1", 2, "fr");
    expect(mockDocuments.get("users/player-1")).toMatchObject({coins: 450, hasPurchasedApp: true, stats: {classicSkipped: 3, multiplayerWins: 9}});
  } finally {jest.useRealTimers();}
});
