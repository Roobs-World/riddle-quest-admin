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
jest.mock("../gameplay/achievements", () => ({findNewAchievements: () => []}));

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
    mockDocuments.set(userPath, baseUser());
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

    expect(first).toMatchObject({revealedLetter: "A", index: 2, newCoins: 250});
    expect(replay).toEqual(first);
    expect(mockDocuments.get(userPath)?.coins).toBe(250);
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
    expect(first).toMatchObject({costDeducted: 200, newCoins: 100});
    expect(mockDocuments.get(userPath)).toMatchObject({coins: 100, progress: {classicIndex: 2}});
    expect(mockDocuments.get(userPath)?.stats.classicSkipped).toBe(1);
  });

  it("requires the full 200-coin skip price without mutating progress", async () => {
    mockDocuments.set(userPath, {...baseUser(), coins: 199});
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

    expect(mockDocuments.get(userPath)).toMatchObject({coins: 199, progress: {classicIndex: 1}});
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
    ).resolves.toBe(200);
    await expect(
      grantAuthoritativeContinue(USER_ID, "classic", "classic-1", "continue-request-fresh", TOKEN),
    ).resolves.toBe(200);
    expect(mockDocuments.get(userPath)?.coins).toBe(200);
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

  it("keeps a recorded Daily loss retryable on the same UTC entitlement", async () => {
    /** Provides challenge date behavior. */
    const challengeDate = new Date().toISOString().slice(0, 10);
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
    const challengeDate = new Date().toISOString().slice(0, 10);
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
