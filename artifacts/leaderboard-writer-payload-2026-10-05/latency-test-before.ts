import {jest, it, expect} from "@jest/globals";

/** Injected persistence retains the real profile preparation and completion transaction. */
const mockDocuments = new Map<string, Record<string, any>>();
/** Every trace entry denotes one physical document read or legacy repair write. */
const mockReads: string[] = [];
/** Deterministic 200ms transport cost makes sequential stages observable. */
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));
/** Immutable account and receipt snapshots match Firestore's document API. */
const mockSnapshot = (path: string) => ({exists: mockDocuments.has(path), data: () => structuredClone(mockDocuments.get(path))});
/** Canonical document API serves both standalone and transactional reads. */
const mockRef = (path: string): any => ({path,
  get: async () => {mockReads.push(`direct:${path}`); await mockDelay(); return mockSnapshot(path);},
  update: async (patch: Record<string, any>) => {mockReads.push(`repair-write:${path}`); await mockDelay(); mockDocuments.set(path, {...mockDocuments.get(path), ...patch});},
  collection: (name: string) => ({doc: (id: string) => mockRef(`${path}/${name}/${id}`)}),
});
/** Atomic completion writes stay synchronous after the final required read. */
const mockTransaction = {
  get: async (ref: {
    /** Canonical path identifies one fresh transactional read. */
    path: string;
  }) => {mockReads.push(`transaction:${ref.path}`); await mockDelay(); return mockSnapshot(ref.path);},
  update: (ref: any, patch: Record<string, any>) => mockDocuments.set(ref.path, {...mockDocuments.get(ref.path), ...patch}),
  create: (ref: any, value: Record<string, any>) => mockDocuments.set(ref.path, value),
  set: (ref: any, value: Record<string, any>) => mockDocuments.set(ref.path, value),
  delete: (ref: any) => mockDocuments.delete(ref.path),
};
/** Real profile preparation, completion and atomic ranking refresh share the same database. */
const mockFirestore = Object.assign(() => ({collection: (name: string) => ({doc: (id: string) => mockRef(`${name}/${id}`)}),
  runTransaction: async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction)}),
  {FieldValue: {serverTimestamp: () => "server-time"}, Timestamp: {fromMillis: (value: number) => ({millis: value})}});
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
jest.mock("../gameplay/singlePlayerSession", () => ({finalizeAuthoritativeSession: async () => ({
  attempts: 1, lastGuess: "piano", answer: "piano", locale: "en", completionKey: "classic:1", classicIndex: 1, terminal: true,
})}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: async () => new Promise(resolve => setTimeout(resolve, 400))}));

import {completeAuthoritativeGame} from "../gameplay/completeGameLogic";

it.each([false, true])("prepares Classic content from committed legacy profile %s without a duplicate read", async legacy => {
  jest.useFakeTimers().setSystemTime(1_800_000_000_000);
  try {
    /** A complete profile is prepared independently of the old helper to keep baseline controls valid. */
    const base = {coins: 550, hasPurchasedApp: true, stats: {gamesPlayed: 9, multiplayerWins: 2}, progress: {classicIndex: 1}, unlockedAchievements: []};
    /** Baseline service versions also export no pure helper, so the full fixture uses explicit canonical defaults. */
    const complete = {...base, stats: {xp: 0, level: 1, dailyPuzzlesCompleted: 0, bestStreak: 0, totalWordsGuessed: 0,
      winRate: 0, averageGuesses: 0, totalScore: 0, highestLevelClassic: 0, gamesPlayed: 9, wins: 0, challengeWins: 0,
      winStreak: 0, totalWins: 0, totalGuessesInWins: 0, totalHintsUsed: 0, multiplayerGamesPlayed: 0, multiplayerWins: 2,
      multiplayerChallengesCreated: 0}, progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0}};
    mockDocuments.clear(); mockReads.length = 0;
    mockDocuments.set("users/player-1", legacy ? base : complete);
    /** Actual completion derives the authoritative result and creates a durable win receipt. */
    const start = Date.now();
    /** Content preparation reuses the progress committed with the reward and receipt. */
    const result = completeAuthoritativeGame({gameMode: "classic", riddleId: "classic-1", sessionToken: "00000000-0000-4000-8000-000000000001"}, {uid: "player-1"});
    await jest.runAllTimersAsync();
    expect(await result).toMatchObject({isCorrect: true});
    if (process.env.SINGLE_PLAYER_CONTENT_TRACE) console.info(JSON.stringify({legacy, elapsedMs: Date.now() - start, reads: mockReads}));
    expect(mockReads.filter(read => read === "direct:users/player-1")).toHaveLength(0);
    expect(mockReads.filter(read => read.startsWith("repair-write:"))).toHaveLength(0);
    expect(Date.now() - start).toBe(600);
    expect(mockReads.filter(read => read === "transaction:users/player-1")).toHaveLength(2);
    expect(mockReads).toHaveLength(4);
    expect(mockDocuments.get("users/player-1")).toMatchObject({hasPurchasedApp: true,
      stats: {gamesPlayed: 10, multiplayerWins: 2}, progress: {classicIndex: 2, dailyChallengeIndex: 0}});
  } finally {jest.useRealTimers();}
});
