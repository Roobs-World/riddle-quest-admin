import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {createHash} from "node:crypto";

/** Describes stored. */
type Stored = Record<string, any>;
/** Provides mock documents behavior. */
const mockDocuments = new Map<string, Stored>();
/** Provides snapshot behavior. */
const snapshot = (path: string) => ({exists: mockDocuments.has(path), data: () => mockDocuments.get(path)});
/** Provides document ref behavior. */
const documentRef = (path: string): any => ({
  path,
  get: async () => snapshot(path),
  collection: (name: string) => collectionRef(`${path}/${name}`),
});
/** Provides collection ref behavior. */
const collectionRef = (path: string): any => ({doc: (id: string) => documentRef(`${path}/${id}`)});
/** Provides mock transaction behavior. */
const mockTransaction = {
  get: jest.fn(
    async (ref: {
      /** Stores path. */ /** Stores path. */ /** Stores path. */
      /** Stores path. */
      path: string;
    }) => snapshot(ref.path),
  ),
  update: jest.fn(
    (
      ref: {
        /** Stores path. */
        path: string;
      },
      value: Stored,
    ) => {
      mockDocuments.set(ref.path, {...(mockDocuments.get(ref.path) ?? {}), ...value});
    },
  ),
  create: jest.fn(
    (
      ref: {
        /** Stores path. */
        path: string;
      },
      value: Stored,
    ) => mockDocuments.set(ref.path, {...value}),
  ),
  set: jest.fn(
    (
      ref: {
        /** Stores path. */
        path: string;
      },
      value: Stored,
    ) => {
      mockDocuments.set(ref.path, {...(mockDocuments.get(ref.path) ?? {}), ...value});
    },
  ),
  delete: jest.fn(
    (ref: {
      /** Stores path. */ /** Stores path. */ /** Stores path. */
      /** Stores path. */
      path: string;
    }) => mockDocuments.delete(ref.path),
  ),
};
/** Discarded attempts can be injected without moving projection context outside the transaction return value. */
const mockRunTransaction = jest.fn(async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction));
/** Provides mock firestore behavior. */
const mockFirestore = Object.assign(
  jest.fn(() => ({
    collection: (name: string) => collectionRef(name),
    runTransaction: mockRunTransaction,
  })),
  {
    FieldValue: {serverTimestamp: () => "server-time"},
    Timestamp: {
      fromDate: (value: Date) => value.toISOString(),
      fromMillis: (value: number) => ({millis: value}),
    },
  },
);
/** Provides mock finalize authoritative session behavior. */
const mockFinalizeAuthoritativeSession = jest.fn();
/** Provides mock update leaderboard entry behavior. */
const mockUpdateLeaderboardEntry = jest.fn();
/** Provides mock trigger classic riddle generation if needed behavior. */
const mockTriggerClassicRiddleGenerationIfNeeded = jest.fn();
/** Fresh post-commit account reads can be timed without replacing completion authority. */
const mockGetUser = jest.fn(async (userId: string) => mockDocuments.get(`users/${userId}`));

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
jest.mock("../gameplay/singlePlayerSession", () => ({
  finalizeAuthoritativeSession: (...args: unknown[]) => mockFinalizeAuthoritativeSession(...args),
}));
jest.mock("../gameplay/firestoreService", () => ({
  prepareUserDocumentCompletion: jest.requireActual<typeof import("../gameplay/firestoreService")>("../gameplay/firestoreService").prepareUserDocumentCompletion,
  getUser: (userId: string) => mockGetUser(userId),
}));
/** Deterministic achievement adapter isolates grants from completion/hint transaction assertions. */
const mockFindNewAchievements = jest.fn((..._args: unknown[]): Array<{
  /** Canonical achievement identity returned by the test grant adapter. */
achievementId: string;
  /** Server-owned unlock timestamp returned by the test grant adapter. */
unlockedAt: number}> => []);
jest.mock("../gameplay/achievements", () => ({findNewAchievements: (...args: unknown[]) => mockFindNewAchievements(...args)}));
jest.mock("../gameplay/leaderboard", () => ({
  updateLeaderboardEntry: (...args: unknown[]) => mockUpdateLeaderboardEntry(...args),
}));
jest.mock("../riddles/riddleSupply", () => ({
  triggerClassicRiddleGenerationIfNeeded: (...args: unknown[]) => mockTriggerClassicRiddleGenerationIfNeeded(...args),
}));

import {completeAuthoritativeGame, LOSS_COMPLETION_RECEIPT_TTL_MS} from "../gameplay/completeGameLogic";

/** Defines the user id value. */
const USER_ID = "player-1";
/** Defines the token a value. */
const TOKEN_A = "00000000-0000-4000-8000-000000000001";
/** Defines the token b value. */
const TOKEN_B = "00000000-0000-4000-8000-000000000002";
/** Provides hash behavior. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Provides completion binding path behavior. */
const completionBindingPath = (completionKey: string, gameMode: "classic" | "challenge" = "classic") =>
  `users/${USER_ID}/singlePlayerCompletionBindings/${hash(`${gameMode}\0${completionKey}`)}`;
/** Provides completion receipt path behavior. */
const completionReceiptPath = (completionKey: string, gameMode: "classic" | "challenge" = "classic") =>
  `gameCompletionReceipts/${hash(`${USER_ID}\0${gameMode}\0${completionKey}`)}`;
/** Provides stats behavior. */
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
/** Provides r. */
const user = () => ({
  hasPurchasedApp: false,
  userId: USER_ID,
  email: "player@example.com",
  username: "player",
  coins: 300,
  stats: stats(),
  progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
  unlockedAchievements: [],
});

describe("atomic authoritative completion", () => {
  it.each([['easy', 25], ['medium', 40], ['hard', 60]] as const)("settles a %s Classic reward once across replay", async (difficultyBand, expectedCoins) => {
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "classic:1", classicIndex: 1, terminal: true, difficultyBand,
    });
    /** Provides request behavior. */
    /** Canonical completion request whose receipt is replayed. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** Provides first behavior. */
    /** First authoritative settlement including the difficulty reward. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    /** Provides replay behavior. */
    /** Receipt replay that must not grant coins again. */
    const replay = await completeAuthoritativeGame(request, {uid: USER_ID});
    expect(first.rewardBreakdown?.baseWinCoins).toBe(expectedCoins);
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(300 + expectedCoins);
  });

  it.each([['easy', 75], ['medium', 100], ['hard', 125]] as const)("settles a %s Daily reward once with a separate streak bonus", async (difficultyBand, expectedCoins) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "challenge:2026-08-12", challengeDate: "2026-08-12", terminal: true, difficultyBand,
    });
    /** Provides request behavior. */
    /** Canonical completion request whose receipt is replayed. */
    const request = {riddleId: "daily-1", gameMode: "challenge" as const, sessionToken: TOKEN_A};
    /** Provides first behavior. */
    /** First authoritative settlement including the difficulty reward. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    expect(first.rewardBreakdown).toMatchObject({baseWinCoins: expectedCoins, dailyStreakBonus: 10, levelUpBonus: 10});
    await expect(completeAuthoritativeGame(request, {uid: USER_ID})).resolves.toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(300 + expectedCoins + 10 + 10);
  });

  beforeEach(() => {
    mockDocuments.clear();
    jest.clearAllMocks();
    mockRunTransaction.mockReset().mockImplementation(async operation => operation(mockTransaction));
    mockUpdateLeaderboardEntry.mockReset();
    mockTriggerClassicRiddleGenerationIfNeeded.mockReset();
    mockFindNewAchievements.mockReturnValue([]);
    mockGetUser.mockReset().mockImplementation(async userId => mockDocuments.get(`users/${userId}`));
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

  it.each((["classic", "challenge"] as const).flatMap(gameMode => [false, true].flatMap(win => [false, true].map(isAnonymous =>
    ({gameMode, win, isAnonymous})))))("reuses committed progress for $gameMode content preparation (win $win, anonymous $isAnonymous)", async ({gameMode, win, isAnonymous}) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    mockFinalizeAuthoritativeSession.mockResolvedValue({attempts: 1, lastGuess: win ? "piano" : "organ", answer: "piano", terminal: true,
      locale: "en", completionKey: gameMode === "classic" ? "classic:1" : "2026-08-12",
      ...(gameMode === "classic" ? {classicIndex: 1} : {challengeDate: "2026-08-12"})});
    mockGetUser.mockImplementation(userId => new Promise(resolve => setTimeout(() => resolve(mockDocuments.get(`users/${userId}`)), 200)));
    mockUpdateLeaderboardEntry.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 250)));
    mockTriggerClassicRiddleGenerationIfNeeded.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 400)));
    /** Required projections determine whether a post-commit read has useful work to supply. */
    const leaderboard = win && !isAnonymous, supply = win && gameMode === "classic";
    /** One receipt remains authoritative regardless of which projection tasks are eligible. */
    const request = {riddleId: gameMode === "classic" ? "classic-1" : "daily-2026-08-12", gameMode, sessionToken: TOKEN_A};
    /** Ranking reads current authority while supply reuses committed progression. */
    const start = Date.now(), completion = completeAuthoritativeGame(request, {uid: USER_ID, isAnonymous});
    await jest.runAllTimersAsync();
    /** Confirmed result and bank state remain independent of empty projection work. */
    const first = await completion;
    expect(first.isCorrect).toBe(win);
    if (process.env.SINGLE_PLAYER_PROJECTION_TRACE) console.info(JSON.stringify({mode: gameMode, win, isAnonymous,
      elapsedMs: Date.now() - start, profileReads: mockGetUser.mock.calls.length,
      leaderboardTasks: mockUpdateLeaderboardEntry.mock.calls.length, supplyTasks: mockTriggerClassicRiddleGenerationIfNeeded.mock.calls.length}));
    expect(mockGetUser).toHaveBeenCalledTimes(0);
    expect(mockUpdateLeaderboardEntry).toHaveBeenCalledTimes(leaderboard ? 1 : 0);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledTimes(supply ? 1 : 0);
    expect(Date.now() - start).toBe(Math.max(supply ? 400 : 0, leaderboard ? 250 : 0));
    /** Result replay must retain the committed balance and statistics. */
    const profile = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    expect(profile.coins).toBe(300 + first.coinsEarned);
    /** Receipt replay still runs only the projections required for this mode and identity. */
    const replay = completeAuthoritativeGame(request, {uid: USER_ID, isAnonymous});
    await jest.runAllTimersAsync();
    expect(await replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(profile);
    expect(mockGetUser).toHaveBeenCalledTimes(0);
  });

  it("finishes independent Classic projections in the slower task's latency", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    /** Provides started behavior. */
    const started = Date.now();
    mockUpdateLeaderboardEntry.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 250)));
    mockTriggerClassicRiddleGenerationIfNeeded.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 400)));
    /** Provides completion behavior. */
    const completion = completeAuthoritativeGame({riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN_A}, {uid: USER_ID});
    await jest.runAllTimersAsync();
    expect(await completion).toMatchObject({isCorrect: true});
    expect(mockUpdateLeaderboardEntry).toHaveBeenCalledTimes(1);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBe(400);
  });

  it("awaits supply recovery even when the independent leaderboard projection fails", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    /** Provides started behavior. */
    const started = Date.now();
    mockUpdateLeaderboardEntry.mockImplementationOnce(() => new Promise((_resolve, reject) => setTimeout(() => reject(new Error("projection offline")), 250)));
    mockTriggerClassicRiddleGenerationIfNeeded.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 400)));
    /** Provides completion behavior. */
    const completion = completeAuthoritativeGame({riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN_A}, {uid: USER_ID});
    await jest.runAllTimersAsync();
    expect(await completion).toMatchObject({isCorrect: true});
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBe(400);
  });

  it("awaits ranking even when the independent content supply check fails", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    mockTriggerClassicRiddleGenerationIfNeeded.mockRejectedValueOnce(new Error("content supply unavailable"));
    mockUpdateLeaderboardEntry.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 250)));
    /** Content failure cannot suppress ranking or leave it running past the response. */
    const start = Date.now(), completion = completeAuthoritativeGame({riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN_A}, {uid: USER_ID});
    await jest.runAllTimersAsync();
    expect(await completion).toMatchObject({isCorrect: true});
    expect(mockUpdateLeaderboardEntry).toHaveBeenCalledWith(USER_ID);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledWith(USER_ID, 2, "en");
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(Date.now() - start).toBe(250);
  });

  it("uses current account progression when replaying an older Classic receipt", async () => {
    /** The replay result stays immutable while the supply check follows current account authority. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** A completed win first advances and checks index two. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenLastCalledWith(USER_ID, 2, "en");
    mockDocuments.get(`users/${USER_ID}`)!.progress.classicIndex = 7;
    expect(await completeAuthoritativeGame(request, {uid: USER_ID})).toEqual(first);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenLastCalledWith(USER_ID, 7, "en");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("checks current progression for a superseded Classic win", async () => {
    mockDocuments.get(`users/${USER_ID}`)!.progress.classicIndex = 7;
    expect(await completeAuthoritativeGame({riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN_A}, {uid: USER_ID}))
      .toMatchObject({isCorrect: true, coinsEarned: 0});
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledWith(USER_ID, 7, "en");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("skips content when replaying a receipt whose account has been removed", async () => {
    /** Missing-account replay still returns its original public result without new projections of progress. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** Establishes an authoritative receipt before deleting the fixture account. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    mockDocuments.delete(`users/${USER_ID}`);
    mockTriggerClassicRiddleGenerationIfNeeded.mockClear();
    expect(await completeAuthoritativeGame(request, {uid: USER_ID})).toEqual(first);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("never leaks an abandoned transaction attempt's supply index", async () => {
    mockRunTransaction.mockImplementationOnce(async operation => {
      /** This Map snapshot models rollback of every first-attempt write before a retry. */
      const original = structuredClone(mockDocuments);
      await operation(mockTransaction);
      mockDocuments.clear();
      for (const [path, value] of original) mockDocuments.set(path, value);
      mockDocuments.get(`users/${USER_ID}`)!.progress.classicIndex = 9;
      return operation(mockTransaction);
    });
    expect(await completeAuthoritativeGame({riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN_A}, {uid: USER_ID}))
      .toMatchObject({isCorrect: true, coinsEarned: 0});
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledTimes(1);
    expect(mockTriggerClassicRiddleGenerationIfNeeded).toHaveBeenCalledWith(USER_ID, 9, "en");
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(300);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("commits rewards, progression, and receipt once across completion retries", async () => {
    /** Provides request behavior. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    mockDocuments.set(completionBindingPath("classic:1"), {
      sessionToken: TOKEN_A,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-1",
      terminal: true,
      isCorrect: true,
    });
    /** Provides first behavior. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    /** Provides after first behavior. */
    const afterFirst = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    expect(mockDocuments.has(completionBindingPath("classic:1"))).toBe(false);
    /** Provides newer pointer behavior. */
    const newerPointer = {
      sessionToken: TOKEN_B,
      gameMode: "classic",
      completionKey: "classic:1",
      riddleId: "classic-fr",
      terminal: true,
      isCorrect: true,
    };
    mockDocuments.set(completionBindingPath("classic:1"), newerPointer);
    /** Provides replay behavior. */
    const replay = await completeAuthoritativeGame(request, {uid: USER_ID});

    expect(first).toMatchObject({attempts: 2, isCorrect: true, coinsEarned: 25});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(afterFirst);
    expect(afterFirst).toMatchObject({coins: 325, progress: {classicIndex: 2}, stats: {gamesPlayed: 1, wins: 1}});
    expect(mockDocuments.get(completionBindingPath("classic:1"))).toEqual(newerPointer);
    expect(mockDocuments.get(completionReceiptPath("classic:1"))).not.toHaveProperty("expiresAt");
  });

  it("atomically grants the new win/play milestones and replays their coin rewards once", async () => {
    /** Real rules evaluate the post-completion player inside the reward transaction. */
    const actual = jest.requireActual<typeof import("../gameplay/achievements")>("../gameplay/achievements");
    mockFindNewAchievements.mockImplementation((...args) => actual.findNewAchievements(
      ...args as Parameters<typeof actual.findNewAchievements>,
    ));
    /** Nine wins place the next successful completion on both new boundaries. */
    const player = user();
    Object.assign(player.stats, {gamesPlayed: 9, wins: 9, totalWins: 9, totalGuessesInWins: 18});
    mockDocuments.set(`users/${USER_ID}`, {...player,
      unlockedAchievements: ["first_win", "wins_5", "win_rate_80", "efficient_10"].map(
        (achievementId) => ({achievementId, unlockedAt: 1}),
      ),
    });
    /** Correlated completion retries must return the original grant receipt. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** Completion receipt containing both milestone grants. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    expect(first.newlyUnlockedAchievementIds).toEqual(["wins_10", "games_10"]);
    expect(first.coinsEarned).toBe(45);
    /** Fully committed player snapshot used to detect replay mutations. */
    const committed = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    expect(committed?.coins).toBe(345);
    expect(await completeAuthoritativeGame(request, {uid: USER_ID})).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(committed);
    mockFindNewAchievements.mockImplementation(() => []);
  });

  it("keeps a bonus-heavy first Daily win close to an ordinary win and itemizes each bonus", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00Z"));
    mockFindNewAchievements.mockReturnValueOnce(
      ["first_win", "daily_completed"].map((achievementId) => ({achievementId, unlockedAt: 1})),
    );
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 3, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "challenge:2026-08-12", challengeDate: "2026-08-12", terminal: true, difficultyBand: "easy",
    });
    /** Canonical completion request whose receipt is replayed. */
    const request = {riddleId: "daily-1", gameMode: "challenge" as const, sessionToken: TOKEN_A};
    /** First authoritative settlement for the reported first-riddle case. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    // Previously 75 + 20 + 50 + 2 * 25 = 195 coins against 25 for a plain Classic win.
    expect(first).toMatchObject({
      leveledUp: true,
      newWinStreak: 1,
      coinsEarned: 115,
      rewardBreakdown: {
        baseWinCoins: 75, dailyStreakBonus: 10, levelUpBonus: 10, achievementBonus: 20, totalAwarded: 115, newBalance: 415,
      },
    });
    expect(await completeAuthoritativeGame(request, {uid: USER_ID})).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(415);
  });

  it("pays ordinary badges but not hint badges discovered during completion", async () => {
    mockFindNewAchievements.mockReturnValue(["hint_user", "hints_10", "hints_25", "first_win"].map((achievementId) => ({achievementId, unlockedAt: 1})));
    /** Original correlated authority request used to verify transaction replay behavior. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** First committed authority response whose grant behavior is compared with replay. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    expect(first.coinsEarned).toBe(35);
    expect(first.newlyUnlockedAchievementIds).toEqual(["hint_user", "hints_10", "hints_25", "first_win"]);
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(335);
    expect(await completeAuthoritativeGame(request, {uid: USER_ID})).toEqual(first);
    expect(mockDocuments.get(`users/${USER_ID}`)?.coins).toBe(335);
  });

  it.each(["facebook", "reddit"] as const)("attributes the %s referral to its earning completion across retries and later wins", async provider => {
    /** Provider identity whose first accepted solo win settles the invitation. */
    const inviteeUid = `${provider}_${"a".repeat(40)}`;
    /** Referrer balance independently detects duplicate wallet grants. */
    const inviterUid = `${provider}_${"b".repeat(40)}`;
    mockDocuments.set(`users/${inviteeUid}`, {...user(), userId: inviteeUid});
    mockDocuments.set(`users/${inviterUid}`, {...user(), userId: inviterUid, coins: 500});
    mockDocuments.set(`${provider}ReferralBindings/${inviteeUid}`, {
      provider,
      inviteeUid,
      inviterUid,
      tokenId: "c".repeat(64),
      boundAtMs: Date.now() - 1,
      settledAtMs: null,
    });
    /** The first completion owns the referral bonus and keeps it on retry. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** Authoritative result after both the solo and referral transactions commit. */
    const first = await completeAuthoritativeGame(request, {uid: inviteeUid});
    /** Re-delivery cannot transfer the bonus to a different completion. */
    const replay = await completeAuthoritativeGame(request, {uid: inviteeUid});

    expect(first).toMatchObject({
      coinsEarned: 125,
      rewardBreakdown: {referralBonus: 100, totalAwarded: 125, newBalance: 425},
    });
    expect(replay).toEqual(first);
    expect(mockDocuments.get(`users/${inviteeUid}`)?.coins).toBe(425);
    expect(mockDocuments.get(`users/${inviterUid}`)?.coins).toBe(600);

    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "classic:2", classicIndex: 2, terminal: true,
    });
    /** A later win crosses a level but cannot earn the earlier referral again. */
    const nextRequest = {riddleId: "classic-2", gameMode: "classic" as const, sessionToken: TOKEN_B};
    /** Displayed reward and balance must equal this completion's actual wallet mutation. */
    const next = await completeAuthoritativeGame(nextRequest, {uid: inviteeUid});
    expect(next).toMatchObject({
      coinsEarned: 35,
      rewardBreakdown: {baseWinCoins: 25, levelUpBonus: 10, totalAwarded: 35, newBalance: 460},
    });
    expect(next.rewardBreakdown?.referralBonus).toBeUndefined();
    expect(await completeAuthoritativeGame(nextRequest, {uid: inviteeUid})).toEqual(next);
    expect(mockDocuments.get(`users/${inviteeUid}`)?.coins).toBe(460);
    expect(mockDocuments.get(`users/${inviterUid}`)?.coins).toBe(600);
    // Account deletion removes both referral identities but retains validated
    // receipt attribution for the surviving invitee's completion replay.
    mockDocuments.set(`${provider}ReferralSettlements/${hash(`riddle-quest\0${provider}-referral\0settlement\0${inviteeUid}`)}`, {
      provider, replayProtection: true, inviteeCoins: 100, inviterCoins: 100, settledAtMs: Date.now(),
      completionReceiptId: hash(`${inviteeUid}\0classic\0classic:1`),
    });
    mockDocuments.delete(`users/${inviterUid}`);
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "classic:1", classicIndex: 1, terminal: true,
    });
    expect(await completeAuthoritativeGame(request, {uid: inviteeUid})).toEqual(first);
    expect(mockDocuments.get(`users/${inviteeUid}`)?.coins).toBe(460);
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2, lastGuess: "piano", answer: "piano", locale: "en",
      completionKey: "classic:2", classicIndex: 2, terminal: true,
    });
    expect(await completeAuthoritativeGame(nextRequest, {uid: inviteeUid})).toEqual(next);
    expect(mockDocuments.get(`users/${inviteeUid}`)?.coins).toBe(460);
    expect(mockDocuments.has(`users/${inviterUid}`)).toBe(false);
  });

  it.each(["facebook", "reddit"] as const)("does not attach a legacy or race %s referral settlement to a new solo completion", async provider => {
    /** Older and multiplayer settlements have no solo completion attribution. */
    const inviteeUid = `${provider}_${"a".repeat(40)}`;
    /** Existing referrer receipt must stay paid exactly once. */
    const inviterUid = `${provider}_${"b".repeat(40)}`;
    mockDocuments.set(`users/${inviteeUid}`, {...user(), userId: inviteeUid, coins: 400});
    mockDocuments.set(`users/${inviterUid}`, {...user(), userId: inviterUid, coins: 600});
    mockDocuments.set(`${provider}ReferralSettlements/${hash(`riddle-quest\0${provider}-referral\0settlement\0${inviteeUid}`)}`, {
      provider, inviteeUid, inviterUid, inviteeCoins: 100, inviterCoins: 100, settledAtMs: Date.now() - 1,
    });
    /** Current win has no evidence that it earned the historical referral. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};
    /** Only the current base grant belongs in this receipt and balance. */
    const first = await completeAuthoritativeGame(request, {uid: inviteeUid});
    expect(first).toMatchObject({coinsEarned: 25, rewardBreakdown: {totalAwarded: 25, newBalance: 425}});
    expect(first.rewardBreakdown?.referralBonus).toBeUndefined();
    expect(await completeAuthoritativeGame(request, {uid: inviteeUid})).toEqual(first);
    expect(mockDocuments.get(`users/${inviteeUid}`)?.coins).toBe(425);
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
    /** Provides request behavior. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN_A};

    /** Provides first behavior. */
    const first = await completeAuthoritativeGame(request, {uid: USER_ID});
    /** Provides replay behavior. */
    const replay = await completeAuthoritativeGame(request, {uid: USER_ID});
    /** Provides loss key behavior. */
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
    /** Provides first behavior. */
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
    /** Provides second behavior. */
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
    /** Provides after win behavior. */
    const afterWin = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    /** Provides r updates after win. */
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

    /** Provides first behavior. */
    const first = await completeAuthoritativeGame(
      {riddleId: "classic-fr", gameMode: "classic", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );
    /** Provides replay behavior. */
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
    /** Provides before behavior. */
    const before = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    /** Provides r updates before. */
    const userUpdatesBefore = mockTransaction.update.mock.calls.length;

    /** Provides first behavior. */
    const first = await completeAuthoritativeGame(
      {riddleId: "classic-en", gameMode: "classic", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    /** Provides replay behavior. */
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
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T08:05:00.000Z"));
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 2,
      lastGuess: "piano",
      terminal: true,
      terminalAt: {toDate: () => new Date("2026-08-12T07:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });
    await completeAuthoritativeGame(
      {riddleId: "daily-en", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );
    /** Provides after win behavior. */
    const afterWin = structuredClone(mockDocuments.get(`users/${USER_ID}`));
    /** Provides r updates after win. */
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

    /** Provides first behavior. */
    const first = await completeAuthoritativeGame(
      {riddleId: "daily-fr", gameMode: "challenge", sessionToken: TOKEN_B},
      {uid: USER_ID},
    );
    /** Provides replay behavior. */
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
    expect(mockDocuments.get(completionReceiptPath(`challenge:2026-08-11:loss:${TOKEN_B}`, "challenge"))).toMatchObject(
      {
        status: "completed",
        expiresAt: {millis: Date.now() + LOSS_COMPLETION_RECEIPT_TTL_MS},
      },
    );
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
    /** Provides before behavior. */
    const before = structuredClone(mockDocuments.get(`users/${USER_ID}`));

    await expect(
      completeAuthoritativeGame({riddleId: "current", gameMode: "challenge", sessionToken: TOKEN_A}, {uid: USER_ID}),
    ).rejects.toMatchObject({code: "permission-denied"});
    expect(mockDocuments.get(`users/${USER_ID}`)).toEqual(before);
  });

  it("recovers a server-proven 08:59 Daily win just after London rollover", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T08:05:00.000Z"));
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
      terminalAt: {toDate: () => new Date("2026-08-12T07:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });

    /** Provides result behavior. */
    const result = await completeAuthoritativeGame(
      {riddleId: "daily-2026-08-11", gameMode: "challenge", sessionToken: TOKEN_A},
      {uid: USER_ID},
    );

    expect(result).toMatchObject({isCorrect: true, newWinStreak: 2});
    expect(mockDocuments.get(`users/${USER_ID}`)).toMatchObject({
      lastCompletedDailyChallengeKey: "2026-08-11",
      lastDailyChallengeCompletedAt: "2026-08-11T08:00:00.000Z",
      progress: {dailyChallengeIndex: 1},
    });
  });

  it("rejects rollover recovery after a newer Daily entitlement was attempted", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T08:05:00.000Z"));
    mockDocuments.set(`users/${USER_ID}`, {
      ...user(),
      lastDailyChallengeAttemptedKey: "2026-08-12",
    });
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 1,
      lastGuess: "piano",
      terminal: true,
      terminalAt: {toDate: () => new Date("2026-08-12T07:59:00.000Z")},
      answer: "piano",
      locale: "en",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });

    await expect(
      completeAuthoritativeGame(
        {riddleId: "daily-2026-08-11", gameMode: "challenge", sessionToken: TOKEN_A},
        {uid: USER_ID},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
  });
});
