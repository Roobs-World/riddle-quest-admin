import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {createHash} from "node:crypto";

type Stored = Record<string, any>;
const mockDocuments = new Map<string, Stored>();
const snapshot = (path: string) => ({exists: mockDocuments.has(path), data: () => mockDocuments.get(path)});
const documentRef = (path: string): any => ({
  path,
  get: async () => snapshot(path),
  collection: (name: string) => collectionRef(`${path}/${name}`),
});
const collectionRef = (path: string): any => ({doc: (id: string) => documentRef(`${path}/${id}`)});
const mockTransaction = {
  get: jest.fn(async (ref: {path: string}) => snapshot(ref.path)),
  update: jest.fn((ref: {path: string}, value: Stored) => {
    mockDocuments.set(ref.path, {...(mockDocuments.get(ref.path) ?? {}), ...value});
  }),
  create: jest.fn((ref: {path: string}, value: Stored) => mockDocuments.set(ref.path, {...value})),
  set: jest.fn((ref: {path: string}, value: Stored) => {
    mockDocuments.set(ref.path, {...(mockDocuments.get(ref.path) ?? {}), ...value});
  }),
  delete: jest.fn((ref: {path: string}) => mockDocuments.delete(ref.path)),
};
const mockFirestore = Object.assign(
  jest.fn(() => ({
    collection: (name: string) => collectionRef(name),
    runTransaction: async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction),
  })),
  {
    FieldValue: {serverTimestamp: () => "server-time"},
    Timestamp: {
      fromDate: (value: Date) => value.toISOString(),
      fromMillis: (value: number) => ({millis: value}),
    },
  },
);
const mockFinalizeAuthoritativeSession = jest.fn();
const mockUpdateLeaderboardEntry = jest.fn();
const mockTriggerClassicRiddleGenerationIfNeeded = jest.fn();

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
jest.mock("../gameplay/singlePlayerSession", () => ({
  finalizeAuthoritativeSession: (...args: unknown[]) => mockFinalizeAuthoritativeSession(...args),
}));
jest.mock("../gameplay/firestoreService", () => ({
  ensureUserDocumentComplete: jest.fn(),
  getUser: async (userId: string) => mockDocuments.get(`users/${userId}`),
}));
jest.mock("../gameplay/achievements", () => ({findNewAchievements: () => []}));
jest.mock("../gameplay/leaderboard", () => ({
  updateLeaderboardEntry: (...args: unknown[]) => mockUpdateLeaderboardEntry(...args),
}));
jest.mock("../riddles/riddleSupply", () => ({
  triggerClassicRiddleGenerationIfNeeded: (...args: unknown[]) =>
    mockTriggerClassicRiddleGenerationIfNeeded(...args),
}));

import {
  completeAuthoritativeGame,
  LOSS_COMPLETION_RECEIPT_TTL_MS,
} from "../gameplay/completeGameLogic";

const USER_ID = "player-1";
const TOKEN_A = "00000000-0000-4000-8000-000000000001";
const TOKEN_B = "00000000-0000-4000-8000-000000000002";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const completionBindingPath = (
  completionKey: string,
  gameMode: "classic" | "challenge" = "classic",
) => `users/${USER_ID}/singlePlayerCompletionBindings/${hash(`${gameMode}\0${completionKey}`)}`;
const completionReceiptPath = (
  completionKey: string,
  gameMode: "classic" | "challenge" = "classic",
) => `gameCompletionReceipts/${hash(`${USER_ID}\0${gameMode}\0${completionKey}`)}`;
const stats = () => ({
  xp: 0,
  level: 1,
  dailyPuzzlesCompleted: 0,
  bestStreak: 0,
  totalWordsGuessed: 0,
  winRate: 0,
  averageGuesses: 0,
  totalScore: 0,
  highestLevelClassic: 0,
  gamesPlayed: 0,
  wins: 0,
  challengeWins: 0,
  winStreak: 0,
  totalWins: 0,
  totalGuessesInWins: 0,
  totalHintsUsed: 0,
  multiplayerGamesPlayed: 0,
  multiplayerWins: 0,
  multiplayerChallengesCreated: 0,
});
const user = () => ({
  userId: USER_ID,
  email: "player@example.com",
  username: "player",
  coins: 300,
  stats: stats(),
  progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
  unlockedAchievements: [],
});

describe("atomic authoritative completion", () => {
  beforeEach(() => {
    mockDocuments.clear();
    jest.clearAllMocks();
    mockDocuments.set(`users/${USER_ID}`, user());
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2,
      lastGuess: "piano",
      terminal: true,
      answer: "piano",
      locale: "en",
      completionKey: "classic:1",
      classicIndex: 1,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("commits rewards, progression, and receipt once across completion retries", async () => {
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    mockDocuments.set(completionBindingPath("classic:1"), {
      sessionToken: TOKEN_A,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-1",
      terminal: true,
      isCorrect: true,
    });
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    const afterFirst = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    expect(mockDocuments.has(completionBindingPath("classic:1"))).toBe(false);
    const newerPointer = {
      sessionToken: TOKEN_B,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-fr",
      terminal: true,
      isCorrect: true,
    };
    mockDocuments.set(completionBindingPath("classic:1"), newerPointer);
    const replay = await completeAuthoritativeGame(request, {uid: USER_ID});

    expect(first).toMatchObject({attempts: 2, isCorrect: true, coinsEarned: 25});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(afterFirst);
    expect(afterFirst).toMatchObject({coins: 325, progress: {classicIndex: 2}, stats: {gamesPlayed: 1, wins: 1}});
    expect(mockDocuments.get(completionBindingPath("classic:1"))).toEqual(newerPointer);
    expect(mockDocuments.get(completionReceiptPath("classic:1"))).not.toHaveProperty("expiresAt");
  });

  it("adds the idempotent Facebook first-win referral to the returned authoritative balance", async () => {
    const facebookUid = `facebook_${"a".repeat(40)}`;
    const inviterUid = `facebook_${"b".repeat(40)}`;
    mockDocuments.set(`users/${facebookUid}`, {...user(), userId: facebookUid});
    mockDocuments.set(`users/${inviterUid}`, {...user(), userId: inviterUid, coins: 500});
    mockDocuments.set(`facebookReferralBindings/${facebookUid}`, {
      provider: "facebook",
      inviteeUid: facebookUid,
      inviterUid,
      tokenId: "c".repeat(64),
      boundAtMs: Date.now() - 1,
      settledAtMs: null,
    });
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    const first = await completeAuthoritativeGame(request, {uid: facebookUid});
    const replay = await completeAuthoritativeGame(request, {uid: facebookUid});

    expect(first).toMatchObject({
      coinsEarned: 125,
      rewardBreakdown: {referralBonus: 100, totalAwarded: 125, newBalance: 425},
    });
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${facebookUid}`)?.coins).toBe(425);
    expect(mockDocuments.get(`users/${inviterUid}`)?.coins).toBe(600);
  });

  it("expires loss-only receipts after the session horizon and replays them idempotently", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 6,
      lastGuess: "crane",
      terminal: true,
      answer: "piano",
      locale: "en",
      completionKey: "classic:1",
      classicIndex: 1,
    });
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};

    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    const replay = await completeAuthoritativeGame(request, {uid: USER_ID});
    const lossKey = `classic:1:loss:${TOKEN_A}`;

    expect(first).toMatchObject({attempts: 6, isCorrect: false, coinsEarned: 0});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(completionReceiptPath(lossKey))).toMatchObject({
      completionKey: lossKey,
      expiresAt: {millis: Date.now() + LOSS_COMPLETION_RECEIPT_TTL_MS},
    });
    expect(mockDocuments.get(`users/${USER_ID}`)).toMatchObject({stats: {gamesPlayed: 1, wins: 0}});
  });

  it("deduplicates a win across locale-specific sessions using the canonical entitlement key", async () => {
    const first = await completeAuthoritativeGame(
      {riddleId: "classic-en", gameMode: "classic", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 1,
      lastGuess: "piano",
      terminal: true,
      answer: "piano",
      locale: "fr",
      completionKey: "classic:1",
      classicIndex: 1,
    });
    const second = await completeAuthoritativeGame(
      {riddleId: "classic-fr", gameMode: "classic", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );

    expect(second).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toMatchObject({
      coins: 325,
      progress: {classicIndex: 2},
      stats: {gamesPlayed: 1, wins: 1},
    });
  });

  it("receipts a parallel Classic loss as a replay-safe no-op after the entitlement already won", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
    await completeAuthoritativeGame(
      {riddleId: "classic-en", gameMode: "classic", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    const afterWin = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    const userUpdatesAfterWin = mockTransaction.update.mock.calls.length;
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 6,
      lastGuess: "crane",
      terminal: true,
      answer: "piano",
      locale: "fr",
      completionKey: "classic:1",
      classicIndex: 1,
    });
    mockDocuments.set(completionBindingPath("classic:1"), {
      sessionToken: TOKEN_B,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-fr",
      terminal: true,
      isCorrect: false,
    });

    const first = await completeAuthoritativeGame(
      {riddleId: "classic-fr", gameMode: "classic", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );
    const replay = await completeAuthoritativeGame(
      {riddleId: "classic-fr", gameMode: "classic", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );

    expect(first).toMatchObject({attempts: 6, isCorrect: false, coinsEarned: 0, newXp: 90, newLevel: 1});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(afterWin);
    expect(mockTransaction.update).toHaveBeenCalledTimes(userUpdatesAfterWin);
    expect(mockDocuments.get(completionReceiptPath(`classic:1:loss:${TOKEN_B}`))).toMatchObject({
      status: "completed",
      expiresAt: {millis: Date.now() + LOSS_COMPLETION_RECEIPT_TTL_MS},
    });
    expect(mockDocuments.has(completionBindingPath("classic:1"))).toBe(false);
  });

  it("receipts a terminal Classic win as a permanent no-op after a parallel skip advanced progress", async () => {
    mockDocuments.set(`users/${USER_ID}`, {
      ...user(),
      coins: 200,
      progress: {classicIndex: 2, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
      stats: {...stats(), classicSkipped: 1},
    });
    mockDocuments.set(completionBindingPath("classic:1"), {
      sessionToken: TOKEN_A,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-en",
      terminal: true,
      isCorrect: true,
    });
    const before = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    const userUpdatesBefore = mockTransaction.update.mock.calls.length;

    const first = await completeAuthoritativeGame(
      {riddleId: "classic-en", gameMode: "classic", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    const replay = await completeAuthoritativeGame(
      {riddleId: "classic-en", gameMode: "classic", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );

    expect(first).toMatchObject({
      attempts: 2,
      isCorrect: true,
      coinsEarned: 0,
      xpEarned: 0,
      newXp: 0,
      newLevel: 1,
      leveledUp: false,
    });
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(before);
    expect(mockTransaction.update).toHaveBeenCalledTimes(userUpdatesBefore);
    expect(mockDocuments.get(completionReceiptPath("classic:1"))).not.toHaveProperty("expiresAt");
    expect(mockDocuments.has(completionBindingPath("classic:1"))).toBe(false);
  });

  it("receipts a prior-day parallel Daily loss as a replay-safe no-op after a rollover win", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T00:05:00.000Z"));
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2,
      lastGuess: "piano",
      terminal: true,
      terminalAt: {toDate: () => new Date("2026-08-11T23:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });
    await completeAuthoritativeGame(
      {riddleId: "daily-en", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    const afterWin = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    const userUpdatesAfterWin = mockTransaction.update.mock.calls.length;
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 6,
      lastGuess: "crane",
      terminal: true,
      answer: "piano",
      locale: "fr",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });
    mockDocuments.set(completionBindingPath("challenge:2026-08-11", "challenge"), {
      sessionToken: TOKEN_B,
      gameMode: "challenge",
      completionKey: "challenge:2026-08-11",
      riddleId: "daily-fr",
      terminal: true,
      isCorrect: false,
    });

    const first = await completeAuthoritativeGame(
      {riddleId: "daily-fr", gameMode: "challenge", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );
    const replay = await completeAuthoritativeGame(
      {riddleId: "daily-fr", gameMode: "challenge", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );

    expect(first).toMatchObject({
      attempts: 6,
      isCorrect: false,
      coinsEarned: 0,
      newWinStreak: 1,
      newXp: 140,
      newLevel: 2,
    });
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(afterWin);
    expect(mockTransaction.update).toHaveBeenCalledTimes(userUpdatesAfterWin);
    expect(mockDocuments.get(completionReceiptPath(
      `challenge:2026-08-11:loss:${TOKEN_B}`,
      "challenge",
    ))).toMatchObject({
      status: "completed",
      expiresAt: {millis: Date.now() + LOSS_COMPLETION_RECEIPT_TTL_MS},
    });
    expect(mockDocuments.has(completionBindingPath("challenge:2026-08-11", "challenge"))).toBe(false);
  });

  it("fails a stale daily completion closed before any reward write", async () => {
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2,
      lastGuess: "piano",
      terminal: true,
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2020-01-01",
      challengeDate: "2020-01-01",
    });
    const before = structuredClone(mockDocuments.get(`users/${USER_ID}`));

    await expect(completeAuthoritativeGame(
      {riddleId: "current", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    )).rejects.toMatchObject({code: "permission-denied"});
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(before);
  });

  it("recovers a server-proven 23:59 Daily win just after UTC rollover", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T00:05:00.000Z"));
    mockDocuments.set(`users/${USER_ID}`, {
      ...user(),
      lastDailyChallengeCompletedAt: {toDate: () => new Date("2026-08-10T12:00:00.000Z")},
      lastCompletedDailyChallengeKey: "2026-08-10",
      stats: {...stats(), winStreak: 1},
    });
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2,
      lastGuess: "piano",
      terminal: true,
      terminalAt: {toDate: () => new Date("2026-08-11T23:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });

    const result = await completeAuthoritativeGame(
      {riddleId: "daily-2026-08-11", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );

    expect(result).toMatchObject({isCorrect: true, newWinStreak: 2});
    expect(mockDocuments.get(`users/${USER_ID}`)).toMatchObject({
      lastCompletedDailyChallengeKey: "2026-08-11",
      lastDailyChallengeCompletedAt: "2026-08-11T12:00:00.000Z",
      progress: {dailyChallengeIndex: 1},
    });
  });

  it("rejects rollover recovery after a newer Daily entitlement was attempted", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T00:05:00.000Z"));
    mockDocuments.set(`users/${USER_ID}`, {
      ...user(),
      lastDailyChallengeAttemptedKey: "2026-08-12",
    });
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 1,
      lastGuess: "piano",
      terminal: true,
      terminalAt: {toDate: () => new Date("2026-08-11T23:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });

    await expect(completeAuthoritativeGame(
      {riddleId: "daily-2026-08-11", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    )).rejects.toMatchObject({code: "permission-denied"});
  });
});
