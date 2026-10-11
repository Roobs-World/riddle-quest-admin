import {createHash} from "node:crypto";
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Describes stored. */
type Stored = Record<string, any>;
/** Provides mock documents behavior. */
const mockDocuments = new Map<string, Stored>();

/** Provides hash behavior. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Provides snapshot behavior. */
const snapshot = (path: string) => ({
  exists: mockDocuments.has(path),
  data: () => mockDocuments.get(path),
});
/** Applies update. */
const applyUpdate = (target: Stored, update: Stored) => {
  for (const [key, value] of Object.entries(update)) {
    /** Provides parts behavior. */
    const parts = key.split(".");
    /** Provides cursor behavior. */
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
    cursor[parts.at(-1)!] = value;
  }
};
/** Provides document ref behavior. */
const documentRef = (path: string): any => ({
  path,
  get: async () => snapshot(path),
  collection: (name: string) => collectionRef(`${path}/${name}`),
});
/** Provides collection ref behavior. */
const collectionRef = (path: string): any => ({
  doc: (id: string) => documentRef(`${path}/${id}`),
});
/** Provides mock transaction behavior. */
const mockTransaction = {
  get: jest.fn(
    async (ref: {
      /** Stores path. */ /** Stores path. */ /** Stores path. */
      /** Stores path. */
      path: string;
    }) => snapshot(ref.path),
  ),
  set: jest.fn(
    (
      ref: {
        /** Stores path. */
        path: string;
      },
      value: Stored,
    ) => mockDocuments.set(ref.path, {...value}),
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
  update: jest.fn(
    (
      ref: {
        /** Stores path. */
        path: string;
      },
      value: Stored,
    ) => {
      /** Provides target behavior. */
      const target = {...(mockDocuments.get(ref.path) ?? {})};
      applyUpdate(target, value);
      mockDocuments.set(ref.path, target);
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
/** Provides mock firestore behavior. */
const mockFirestore = Object.assign(
  jest.fn(() => ({
    collection: (name: string) => collectionRef(name),
    runTransaction: async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction),
  })),
  {
    FieldValue: {serverTimestamp: () => "server-time"},
    Timestamp: {fromMillis: (value: number) => ({toDate: () => new Date(value)})},
  },
);

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
/** Deterministic achievement adapter isolates grants from completion/hint transaction assertions. */
const mockFindNewAchievements = jest.fn((..._args: unknown[]): Array<{
  /** Canonical achievement identity returned by the test grant adapter. */
achievementId: string;
  /** Server-owned unlock timestamp returned by the test grant adapter. */
unlockedAt: number}> => []);
jest.mock("../gameplay/achievements", () => ({findNewAchievements: (...args: unknown[]) => mockFindNewAchievements(...args)}));

import {
  ensureAuthoritativeSession,
  finalizeAuthoritativeSession,
  getIssuedAuthoritativeSession,
  grantAuthoritativeContinue,
  purchaseAuthoritativeHint,
  skipAuthoritativeRiddle,
  submitAuthoritativeGuess,
  type SinglePlayerSessionState,
} from "../gameplay/singlePlayerSession";
import {getCompletionBoundAuthoritativeSession} from "../gameplay/singlePlayerCompletionBinding";
import {getDailyDate} from "@qwordly/core/validation/dailyCalendar";

/** Defines the user id value. */
const USER_ID = "player-1";
/** Renders the token interface. */
const TOKEN = "00000000-0000-4000-8000-000000000001";
/** Provides session path behavior. */
const sessionPath = (token = TOKEN) => `users/${USER_ID}/singlePlayerSessions/${hash(token)}`;
/** Provides completion binding path behavior. */
const completionBindingPath = (mode: "classic" | "challenge", completionKey: string) =>
  `users/${USER_ID}/singlePlayerCompletionBindings/${hash(`${mode}\0${completionKey}`)}`;
/** Provides r path. */
const userPath = `users/${USER_ID}`;
/** Provides base user behavior. */
const baseUser = () => ({
  userId: USER_ID,
  email: "player@example.com",
  username: "player",
  coins: 300,
  progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
  stats: {totalHintsUsed: 0},
  unlockedAchievements: [],
});
/** Provides base session behavior. */
const baseSession = (overrides: Partial<SinglePlayerSessionState> = {}): SinglePlayerSessionState => ({
  gameMode: "classic",
  riddleId: "classic-1",
  contentKey: "content-en-1",
  completionKey: "classic:1",
  locale: "en",
  answer: "piano",
  expiresAt: {toDate: () => new Date(Date.now() + 60_000)} as never,
  classicIndex: 1,
  attempts: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
  terminal: false,
  isCorrect: false,
  guessReceipts: {},
  ...overrides,
});

describe("single-player session transactions", () => {
  beforeEach(() => {
    mockDocuments.clear();
    jest.clearAllMocks();
    mockFindNewAchievements.mockReturnValue([]);
    mockDocuments.set(userPath, baseUser());
  });

  it("pins reviewed difficulty and retains it when content metadata changes on resume", async () => {
    /** First issued token carrying the reviewed difficulty snapshot. */
    const token = await ensureAuthoritativeSession(USER_ID, "classic", "classic-1", "en", "content-en-1", "classic:1", "piano",
      {classicIndex: 1, difficultyBand: "medium"});
    expect(mockDocuments.get(sessionPath(token))?.difficultyBand).toBe("medium");
    /** Resumed token after the catalog difficulty changes. */
    const resumed = await ensureAuthoritativeSession(USER_ID, "classic", "classic-1", "en", "content-en-1", "classic:1", "piano",
      {classicIndex: 1, difficultyBand: "hard"});
    expect(resumed).toBe(token);
    expect(mockDocuments.get(sessionPath(token))?.difficultyBand).toBe("medium");
  });

  it("issues the content binding and private session with one identical fixed expiry", async () => {
    /** Provides token behavior. */
    const token = await ensureAuthoritativeSession(
      USER_ID,
      "classic",
      "classic-1",
      "en",
      "content-en-1",
      "classic:1",
      "piano",
      {classicIndex: 1},
    );
    /** Stores d session. */
    const storedSession = mockDocuments.get(sessionPath(token));
    /** Stores d binding. */
    const storedBinding = mockDocuments.get(`users/${USER_ID}/singlePlayerSessionBindings/${hash("content-en-1")}`);

    expect(storedSession?.expiresAt).toBe(storedBinding?.expiresAt);
    expect(storedSession?.expiresAt.toDate().getTime()).toBeGreaterThan(Date.now());
  });

  it("preserves the exact issued expiry across every authoritative mutation", async () => {
    /** Provides expiry time behavior. */
    const expiryTime = Date.now() + 60_000;
    /** Provides fixed expiry behavior. */
    const fixedExpiry = {toDate: () => new Date(expiryTime)} as never;
    /** Provides scenarios behavior. */
    const scenarios = [
      {
        state: baseSession({expiresAt: fixedExpiry}),
        mutate: () =>
          submitAuthoritativeGuess(USER_ID, {
            riddleId: "classic-1",
            gameMode: "classic" as const,
            sessionToken: TOKEN,
            requestId: "fixed-expiry-guess",
            guess: "crane",
          }),
      },
      {
        state: baseSession({expiresAt: fixedExpiry}),
        mutate: () =>
          purchaseAuthoritativeHint(USER_ID, {
            riddleId: "classic-1",
            gameMode: "classic" as const,
            sessionToken: TOKEN,
            requestId: "fixed-expiry-hint",
            currentAttempt: ["p", "i", "z", "z", "z"],
          }),
      },
      {
        state: baseSession({expiresAt: fixedExpiry}),
        mutate: () =>
          skipAuthoritativeRiddle(USER_ID, {
            riddleId: "classic-1",
            gameMode: "classic" as const,
            sessionToken: TOKEN,
            requestId: "fixed-expiry-skip",
          }),
      },
      {
        state: baseSession({expiresAt: fixedExpiry, attempts: 5, awaitingContinue: true}),
        mutate: () => grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "fixed-expiry-continue", TOKEN),
      },
      {
        state: baseSession({expiresAt: fixedExpiry, attempts: 5, awaitingContinue: true}),
        mutate: () => finalizeAuthoritativeSession(USER_ID, "classic", "classic-1", TOKEN),
      },
    ];

    for (const scenario of scenarios) {
      mockDocuments.clear();
      mockDocuments.set(userPath, baseUser());
      mockDocuments.set(sessionPath(), scenario.state);
      await scenario.mutate();
      expect(mockDocuments.get(sessionPath())?.expiresAt).toBe(fixedExpiry);
    }
  });

  it.each(["hint_user", "hints_10", "hints_25"])("keeps %s badges without granting coins for a hint or its replay", async (achievementId) => {
    mockDocuments.set(sessionPath(), baseSession());
    mockFindNewAchievements.mockReturnValue([{achievementId, unlockedAt: 1}]);
    /** Original correlated authority request used to verify transaction replay behavior. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN,
      requestId: "hint-no-reward", currentAttempt: ["p", "i", "z", "z", "z"]};
    /** First committed authority response whose grant behavior is compared with replay. */
    const first = await purchaseAuthoritativeHint(USER_ID, request);
    /** Replayed request response must retain committed state without granting again. */
    const replay = await purchaseAuthoritativeHint(USER_ID, {...request, requestId: "hint-no-reward-replay"});
    expect(first).toMatchObject({newCoins: 275, coinsCost: 25, newlyUnlockedAchievementIds: [achievementId]});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(userPath)?.coins).toBe(275);
    expect(mockDocuments.get(userPath)?.stats.totalHintsUsed).toBe(1);
    expect(mockDocuments.get(userPath)?.unlockedAchievements).toEqual([{achievementId, unlockedAt: 1}]);
  });

  it("accepts a Tokyo Daily hint only before its bound locale midnight", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T15:01:00Z"));
    try {
      mockDocuments.set(sessionPath(), baseSession({gameMode: "challenge", locale: "ja", riddleId: "daily-2026-08-12", challengeDate: "2026-08-12", completionKey: "challenge:2026-08-12"}));
      /** Correlated hint request bound to the Tokyo Daily session and original receipt. */
      const request = {riddleId: "daily-2026-08-12", gameMode: "challenge" as const, sessionToken: TOKEN, requestId: "tokyo-hint-0001", currentAttempt: ["p", "i", "z", "z", "z"]};
      expect(await purchaseAuthoritativeHint(USER_ID, request)).toMatchObject({newCoins: 275});
      // Receipt replay remains free after rollover; a fresh spend must still fail closed.
      mockDocuments.set(sessionPath(), baseSession({gameMode: "challenge", locale: "ja", riddleId: "daily-2026-08-12", challengeDate: "2026-08-12", completionKey: "challenge:2026-08-12", expiresAt: {toDate: () => new Date("2026-08-14T00:00:00Z")} as never}));
      jest.setSystemTime(new Date("2026-08-12T15:01:00Z"));
      await expect(purchaseAuthoritativeHint(USER_ID, {...request, requestId: "tokyo-hint-0002"})).rejects.toThrow("no longer current");
      expect(mockDocuments.get(userPath)?.coins).toBe(275);
    } finally { jest.useRealTimers(); }
  });

  it("returns a usable Turkish dotted-I hint and replays it without charging twice", async () => {
    mockDocuments.set(sessionPath(), baseSession({locale: "tr", answer: "izmir"}));
    /** A blank attempt requests the first canonical letter without altering scoring semantics. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN,
      requestId: "turkish-hint-0001", currentAttempt: ["", "", "", "", ""]};
    /** Both the first response and exact receipt replay must retain the locale-aware glyph. */
    const first = await purchaseAuthoritativeHint(USER_ID, request);
    expect(first).toMatchObject({revealedLetter: "İ", index: 0, newCoins: 275});
    expect(await purchaseAuthoritativeHint(USER_ID, request)).toEqual(first);
    expect(mockDocuments.get(userPath)?.coins).toBe(275);
    expect(mockDocuments.get(userPath)?.stats.totalHintsUsed).toBe(1);
  });

  it("charges one hint once and semantically recovers a dropped response with a fresh request id", async () => {
    mockDocuments.set(sessionPath(), baseSession());
    /** Provides request behavior. */
    const request = {
      riddleId: "classic-1",
      gameMode: "classic" as const,
      sessionToken: TOKEN,
      requestId: "hint-request-0001",
      currentAttempt: ["p", "i", "z", "z", "z"],
    };

    /** Provides first behavior. */
    const first = await purchaseAuthoritativeHint(USER_ID, request);
    /** Provides replay behavior. */
    const replay = await purchaseAuthoritativeHint(USER_ID, {...request, requestId: "hint-request-fresh"});

    expect(first).toMatchObject({revealedLetter: "A", index: 2, newCoins: 275});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(userPath)?.coins).toBe(275);
    expect(mockDocuments.get(userPath)?.stats.totalHintsUsed).toBe(1);
  });

  it("charges and advances a skip once even when the response retry has a fresh request id", async () => {
    mockDocuments.set(sessionPath(), baseSession());
    /** Provides request behavior. */
    const request = {
      riddleId: "classic-1",
      gameMode: "classic" as const,
      sessionToken: TOKEN,
      requestId: "skip-request-0001",
    };

    /** Provides first behavior. */
    const first = await skipAuthoritativeRiddle(USER_ID, request);
    /** Provides replay behavior. */
    const replay = await skipAuthoritativeRiddle(USER_ID, {...request, requestId: "skip-request-fresh"});

    expect(replay).toEqual(first);
    expect(first).toMatchObject({costDeducted: 100, newCoins: 200});
    expect(mockDocuments.get(userPath)).toMatchObject({coins: 200, progress: {classicIndex: 2}});
    expect(mockDocuments.get(userPath)?.stats.classicSkipped).toBe(1);
  });

  it("returns transaction-owned supply context without persisting it in the skip receipt", async () => {
    mockDocuments.set(sessionPath(), baseSession({locale: "fr"}));
    /** One canonical request establishes the immutable skip receipt. */
    const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken: TOKEN, requestId: "skip-context-first"};
    /** First committed context accompanies the new charge. */
    const first = await skipAuthoritativeRiddle(USER_ID, request);
    expect(first).toMatchObject({classicSupply: {classicIndex: 2, locale: "fr"}});
    expect(mockDocuments.get(sessionPath())?.skipResult).not.toHaveProperty("classicSupply");
    mockDocuments.get(userPath)!.progress = {...mockDocuments.get(userPath)!.progress, classicIndex: 7};
    /** Replay carries current supply progress alongside the unchanged receipt. */
    const replay = await skipAuthoritativeRiddle(USER_ID, {...request, requestId: "skip-context-replay"});
    expect(replay).toMatchObject({newCoins: 200, newProgress: {classicIndex: 2}, classicSupply: {classicIndex: 7, locale: "fr"}});
    expect(mockDocuments.get(userPath)).toMatchObject({coins: 200, progress: {classicIndex: 7}, stats: {classicSkipped: 1}});
  });

  it.each(["locale", "contentKey", "completionKey", "answer"])("rejects malformed issued %s inside the skip transaction", async field => {
    mockDocuments.set(sessionPath(), {...baseSession(), [field]: 17});
    await expect(skipAuthoritativeRiddle(USER_ID, {riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN,
      requestId: "skip-malformed-binding"})).rejects.toMatchObject({code: "permission-denied"});
    expect(mockDocuments.get(userPath)).toMatchObject({coins: 300, progress: {classicIndex: 1}});
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it("requires the full 100-coin skip price without mutating progress", async () => {
    mockDocuments.set(userPath, {...baseUser(), coins: 99});
    /** Captures the exact session object to prove the rejected transaction leaves it untouched. */
    const sessionBefore = baseSession();
    mockDocuments.set(sessionPath(), sessionBefore);

    await expect(
      skipAuthoritativeRiddle(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: TOKEN,
        requestId: "skip-request-insufficient",
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});

    expect(mockDocuments.get(userPath)).toMatchObject({coins: 99, progress: {classicIndex: 1}});
    expect(mockDocuments.get(sessionPath())).toBe(sessionBefore);
  });

  it("recovers a committed continue without a second charge", async () => {
    mockDocuments.set(
      sessionPath(),
      baseSession({
        attempts: 5,
        awaitingContinue: true,
        lastGuess: "crane",
        lastGuessResult: {
          feedback: [],
          attempts: 5,
          isCorrect: false,
          gameOver: false,
          canContinue: true,
        },
      }),
    );
    await expect(
      grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "continue-request-0001", TOKEN),
    ).resolves.toBe(250);
    await expect(
      grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "continue-request-fresh", TOKEN),
    ).resolves.toBe(250);
    expect(mockDocuments.get(userPath)?.coins).toBe(250);
    expect(mockDocuments.get(sessionPath())).not.toHaveProperty("lastGuess");
    expect(mockDocuments.get(sessionPath())).not.toHaveProperty("lastGuessResult");
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: TOKEN,
        requestId: "guess-request-after-continue",
        guess: "crane",
      }),
    ).resolves.toMatchObject({attempts: 6, isCorrect: false, gameOver: true});
  });

  it("grants one rewarded extra try with zero coins and cannot stack it with paid continue", async () => {
    mockDocuments.set(userPath, {...baseUser(), coins: 0});
    mockDocuments.set(sessionPath(), baseSession({attempts: 5, awaitingContinue: true}));
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "rewarded-continue-1", TOKEN, "facebook-rewarded")).resolves.toBe(0);
    expect(mockDocuments.get(userPath)?.coins).toBe(0);
    expect(mockDocuments.get(sessionPath())).toMatchObject({hasUsedContinue: true, awaitingContinue: false, continueFunding: "facebook-rewarded"});
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "paid-continue-retry", TOKEN)).resolves.toBe(0);
    await expect(submitAuthoritativeGuess(USER_ID, {riddleId: "classic-1", gameMode: "classic", sessionToken: TOKEN,
      requestId: "rewarded-sixth-guess", guess: "crane"})).resolves.toMatchObject({attempts: 6, gameOver: true});
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "rewarded-seventh-try", TOKEN, "facebook-rewarded"))
      .rejects.toMatchObject({code: "failed-precondition"});
  });

  it("rejects rewarded recovery before exhaustion, for stale bindings, and after expiry", async () => {
    mockDocuments.set(sessionPath(), baseSession());
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "rewarded-before-loss", TOKEN, "facebook-rewarded"))
      .rejects.toMatchObject({code: "failed-precondition"});
    mockDocuments.set(sessionPath(), baseSession({attempts: 5, awaitingContinue: true}));
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "other-riddle", "rewarded-wrong-riddle", TOKEN, "facebook-rewarded"))
      .rejects.toMatchObject({code: "permission-denied"});
    mockDocuments.set(sessionPath(), baseSession({attempts: 5, awaitingContinue: true,
      expiresAt: {toDate: () => new Date(0)} as never}));
    await expect(grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "rewarded-expired-session", TOKEN, "facebook-rewarded"))
      .rejects.toMatchObject({code: "failed-precondition"});
  });

  it("fails every authoritative boundary closed for an expired private session", async () => {
    mockDocuments.set(
      sessionPath(),
      baseSession({
        expiresAt: {toDate: () => new Date(Date.now() - 1)} as never,
        attempts: 5,
        awaitingContinue: true,
      }),
    );

    await expect(getIssuedAuthoritativeSession(USER_ID, TOKEN, "classic", "classic-1")).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: TOKEN,
        requestId: "expired-guess-request",
        guess: "piano",
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(finalizeAuthoritativeSession(USER_ID, "classic", "classic-1", TOKEN)).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(
      grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "expired-continue-request", TOKEN),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(
      purchaseAuthoritativeHint(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: TOKEN,
        requestId: "expired-hint-request",
        currentAttempt: ["p", "i", "z", "z", "z"],
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(
      skipAuthoritativeRiddle(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: TOKEN,
        requestId: "expired-skip-request",
      }),
    ).rejects.toMatchObject({code: "failed-precondition"});
    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["malformed", {}],
    ["invalid date", {toDate: () => new Date(Number.NaN)}],
  ])("fails issued-session load closed for a %s expiry", async (_label, expiresAt) => {
    mockDocuments.set(sessionPath(), baseSession({expiresAt: expiresAt as never}));

    await expect(getIssuedAuthoritativeSession(USER_ID, TOKEN, "classic", "classic-1")).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rotates rather than reviving an expired content binding", async () => {
    /** Provides expired behavior. */
    const expired = baseSession({expiresAt: {toDate: () => new Date(Date.now() - 1)} as never});
    mockDocuments.set(sessionPath(), expired);
    mockDocuments.set(`users/${USER_ID}/singlePlayerSessionBindings/${hash(expired.contentKey)}`, {
      sessionToken: TOKEN,
    });
    mockDocuments.set(completionBindingPath("classic", expired.completionKey), {
      sessionToken: TOKEN,
      gameMode: "classic",
      completionKey: expired.completionKey,
      riddleId: expired.riddleId,
      terminal: true,
      isCorrect: false,
    });

    await expect(
      getCompletionBoundAuthoritativeSession(USER_ID, "classic", expired.completionKey),
    ).resolves.toBeUndefined();

    /** Provides next token behavior. */
    const nextToken = await ensureAuthoritativeSession(
      USER_ID,
      "classic",
      expired.riddleId,
      expired.locale,
      expired.contentKey,
      expired.completionKey,
      expired.answer,
      {classicIndex: 1},
    );

    expect(nextToken).not.toBe(TOKEN);
    expect(mockDocuments.get(sessionPath(nextToken))?.expiresAt.toDate().getTime()).toBeGreaterThan(Date.now());
  });

  it("rotates a fully recorded loss on reload and allows the same entitlement to be solved", async () => {
    /** Provides prior behavior. */
    const prior = baseSession({attempts: 5, lastGuess: "crane", terminal: true, isCorrect: false});
    mockDocuments.set(sessionPath(), prior);
    mockDocuments.set(`users/${USER_ID}/singlePlayerSessionBindings/${hash(prior.contentKey)}`, {
      sessionToken: TOKEN,
    });
    mockDocuments.set(`gameCompletionReceipts/${hash(`${USER_ID}\0classic\0classic:1:loss:${TOKEN}`)}`, {
      status: "completed",
    });

    /** Provides next token behavior. */
    const nextToken = await ensureAuthoritativeSession(
      USER_ID,
      "classic",
      "classic-1",
      "en",
      prior.contentKey,
      prior.completionKey,
      prior.answer,
      {classicIndex: 1},
    );
    expect(nextToken).not.toBe(TOKEN);
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: nextToken,
        requestId: "guess-request-win",
        guess: "piano",
      }),
    ).resolves.toMatchObject({attempts: 1, isCorrect: true, gameOver: true});
  });

  it("keeps a recorded Daily loss retryable on the same locale entitlement", async () => {
    /** Provides challenge date behavior. */
    const challengeDate = getDailyDate("en");
    /** Provides prior behavior. */
    const prior = baseSession({
      gameMode: "challenge",
      riddleId: `daily-${challengeDate}`,
      contentKey: `daily-content-${challengeDate}`,
      completionKey: `challenge:${challengeDate}`,
      classicIndex: undefined,
      challengeDate,
      attempts: 5,
      hasUsedContinue: true,
    });
    mockDocuments.set(sessionPath(), prior);
    mockDocuments.set(`users/${USER_ID}/singlePlayerSessionBindings/${hash(prior.contentKey)}`, {
      sessionToken: TOKEN,
    });
    /** Provides loss behavior. */
    const loss = await submitAuthoritativeGuess(USER_ID, {
      riddleId: prior.riddleId,
      gameMode: "challenge",
      sessionToken: TOKEN,
      requestId: "daily-guess-request-loss",
      guess: "crane",
    });
    expect(loss).toMatchObject({attempts: 6, isCorrect: false, gameOver: true});
    expect(loss).not.toHaveProperty("correctAnswer");

    mockDocuments.set(`gameCompletionReceipts/${hash(`${USER_ID}\0challenge\0${prior.completionKey}:loss:${TOKEN}`)}`, {
      status: "completed",
    });

    /** Provides next token behavior. */
    const nextToken = await ensureAuthoritativeSession(
      USER_ID,
      "challenge",
      prior.riddleId,
      "en",
      prior.contentKey,
      prior.completionKey,
      prior.answer,
      {challengeDate},
    );

    expect(nextToken).not.toBe(TOKEN);
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId: prior.riddleId,
        gameMode: "challenge",
        sessionToken: nextToken,
        requestId: "daily-guess-request-win",
        guess: "piano",
      }),
    ).resolves.toMatchObject({attempts: 1, isCorrect: true, gameOver: true});
  });

  it("keeps a terminal win recoverable when a newer locale session is issued", async () => {
    /** Provides challenge date behavior. */
    const challengeDate = getDailyDate("fr");
    /** Provides completion key behavior. */
    const completionKey = `challenge:${challengeDate}`;
    /** Provides riddle id behavior. */
    const riddleId = `daily-${challengeDate}`;
    /** Provides winning behavior. */
    const winning = baseSession({
      gameMode: "challenge",
      riddleId,
      contentKey: `daily-content-fr-${challengeDate}`,
      completionKey,
      locale: "fr",
      classicIndex: undefined,
      challengeDate,
    });
    mockDocuments.set(sessionPath(), winning);

    await submitAuthoritativeGuess(USER_ID, {
      riddleId,
      gameMode: "challenge",
      sessionToken: TOKEN,
      requestId: "daily-parallel-win",
      guess: "piano",
    });
    /** Provides pointer before behavior. */
    const pointerBefore = mockDocuments.get(completionBindingPath("challenge", completionKey));
    expect(pointerBefore).toMatchObject({sessionToken: TOKEN, isCorrect: true});

    /** Provides newer token behavior. */
    const newerToken = await ensureAuthoritativeSession(
      USER_ID,
      "challenge",
      riddleId,
      "de",
      `daily-content-de-${challengeDate}`,
      completionKey,
      "clock",
      {challengeDate},
    );

    expect(newerToken).not.toBe(TOKEN);
    expect(mockDocuments.get(completionBindingPath("challenge", completionKey))).toEqual(pointerBefore);
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId,
        gameMode: "challenge",
        sessionToken: newerToken,
        requestId: "daily-parallel-loss",
        guess: "piano",
      }),
    ).resolves.toMatchObject({attempts: 1, isCorrect: false, gameOver: false});
    /** Provides newer path behavior. */
    const newerPath = sessionPath(newerToken);
    mockDocuments.set(newerPath, {
      ...mockDocuments.get(newerPath),
      attempts: 5,
      hasUsedContinue: true,
      awaitingContinue: false,
      lastGuess: "piano",
      terminal: false,
    });
    await expect(
      submitAuthoritativeGuess(USER_ID, {
        riddleId,
        gameMode: "challenge",
        sessionToken: newerToken,
        requestId: "daily-parallel-terminal-loss",
        guess: "crane",
      }),
    ).resolves.toMatchObject({attempts: 6, isCorrect: false, gameOver: true});
    expect(mockDocuments.get(completionBindingPath("challenge", completionKey))).toEqual(pointerBefore);
    await expect(getCompletionBoundAuthoritativeSession(USER_ID, "challenge", completionKey)).resolves.toMatchObject({
      sessionToken: TOKEN,
      state: {terminal: true, isCorrect: true, locale: "fr"},
    });
  });
});
