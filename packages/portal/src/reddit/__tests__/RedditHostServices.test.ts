import {createRedditHostServices} from "../RedditHostServices";

/** Provides profile behavior. */
const profile = {
  username: "Solver",
  coins: 300,
  level: 1,
  xp: 0,
  winStreak: 0,
  gamesPlayed: 0,
  wins: 0,
  achievements: [],
  classicIndex: 1,
};
/** Provides response behavior. */
const response = (result: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ok: true, result}),
  }) as Promise<Response>;

beforeEach(() => jest.restoreAllMocks());

it("reads typed invitation readiness through the same-origin gateway", async () => {
  /** Privacy-safe waiting response from canonical server authority. */
  const waiting = {status: "waiting", invitation: {role: "recipient", canCancel: false, claimState: "claimed", publicationState: "pending", expiresAtMs: 20000}, serverNowMs: 10000};
  global.fetch = jest.fn(() => response(waiting)) as typeof fetch;
  /** Target adapter never imports Firebase browser operations. */
  const services = createRedditHostServices();
  await expect(services.getRaceEntry!("opaque-seat", "en")).resolves.toEqual(waiting);
  expect(global.fetch).toHaveBeenCalledWith("/api/game/race.entry", expect.objectContaining({body: JSON.stringify({challengeId: "opaque-seat", locale: "en"})}));
  expect(services.cancelRaceInvite).toBeUndefined();
});

it.each([false, true])("loads canonical feedback through same-origin routes, available=%s", async (includeEvaluation) => {
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/game/profile.load") return response(profile);
    if (path === "/api/game/riddle.classic")
      return response({
        challenge: {
          totalQuestions: 1,
          questions: [
            {
              riddleId: "classic-1",
              text: "What has keys?",
              answerLength: 5,
              ...(includeEvaluation ? {evaluation: {answer: "piano", locale: "en"}} : {}),
              sessionToken: "00000000-0000-4000-8000-000000000001",
              questionNumber: 1,
              attemptsUsed: 0,
              hasUsedContinue: false,
              awaitingContinue: false,
            },
          ],
        },
      });
    throw new Error(`unexpected route ${path}`);
  }) as typeof fetch;
  /** Provides services behavior. */
  const services = createRedditHostServices();
  await expect(services.loadProfile("reddit-account")).resolves.toMatchObject(profile);
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1})).resolves.toEqual({
    riddleId: "classic-1",
    text: "What has keys?",
    answerLength: 5,
    ...(includeEvaluation ? {evaluation: {answer: "piano", locale: "en"}} : {}),
    sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "classic",
    index: 1,
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
  });
  expect(global.fetch).toHaveBeenCalledWith("/api/game/riddle.classic", expect.objectContaining({
    body: expect.stringContaining('"includeEvaluation":true'),
  }));
  expect((global.fetch as jest.Mock).mock.calls.every(([path]) => String(path).startsWith("/api/"))).toBe(true);
});

it("opens the current Classic riddle while three upcoming riddles download", async () => {
  /** Completes the deferred Classic buffer response. */
  let releaseBuffer!: (value: Response) => void;
  /** Deferred Classic buffer response for the startup test. */
  const pendingBuffer = new Promise<Response>((resolve) => { releaseBuffer = resolve; });
  /** Server-shaped riddle fixture for the preload test. */
  const question = (index: number) => ({
    riddleId: `classic-${index}`, text: `Question ${index}`, answerLength: 5,
    sessionToken: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    questionNumber: 1, attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
  });
  global.fetch = jest.fn((input) => {
    /** Same-origin route requested by the adapter. */
    const path = String(input);
    if (path === "/api/game/riddle.classic-buffer") return pendingBuffer;
    if (path === "/api/game/riddle.classic")
      return response({challenge: {totalQuestions: 1, questions: [question(1)]}});
    throw new Error(`unexpected route ${path}`);
  }) as typeof fetch;
  /** Reddit host adapter being tested. */
  const services = createRedditHostServices();
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1}))
    .resolves.toMatchObject({riddleId: "classic-1", index: 1});
  expect(global.fetch).toHaveBeenCalledWith("/api/game/riddle.classic-buffer", expect.anything());
  releaseBuffer(await response({confirmedClassicIndex: 1, riddles: [1, 2, 3, 4].map((index) => ({
    classicIndex: index, expiresAtMs: Date.now() + 60_000, question: question(index),
  }))}));
  await pendingBuffer;
  await Promise.resolve();
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2}))
    .resolves.toMatchObject({riddleId: "classic-2", index: 2});
  expect(global.fetch).not.toHaveBeenCalledWith("/api/game/riddle.classic", expect.objectContaining({
    body: expect.stringContaining('"classicIndex":2'),
  }));
});

it("preloads Daily alongside the Classic queue and reuses the Daily response", async () => {
  /** Server-shaped riddle fixture for the preload test. */
  const question = {
    riddleId: "daily-1", text: "Daily question", answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000101", questionNumber: 1,
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
  };
  /** Completes the deferred Daily response. */
  let releaseDaily!: (value: Response) => void;
  /** Deferred Daily response for the preload test. */
  const pendingDaily = new Promise<Response>((resolve) => { releaseDaily = resolve; });
  global.fetch = jest.fn((input) => {
    if (String(input) === "/api/game/riddle.daily") return pendingDaily;
    if (String(input) === "/api/game/riddle.classic-buffer")
      return response({confirmedClassicIndex: 1, riddles: []});
    throw new Error(`unexpected route ${String(input)}`);
  }) as typeof fetch;
  /** Reddit host adapter being tested. */
  const services = createRedditHostServices();
  services.preloadInitialRiddles?.("en");
  expect(global.fetch).toHaveBeenCalledWith("/api/game/riddle.daily", expect.anything());
  expect(global.fetch).toHaveBeenCalledWith("/api/game/riddle.classic-buffer", expect.anything());
  releaseDaily(await response({challenge: {totalQuestions: 1, questions: [question]}}));
  await expect(services.loadRiddle({gameMode: "challenge", locale: "en"}))
    .resolves.toMatchObject({riddleId: "daily-1", index: 1});
  expect((global.fetch as jest.Mock).mock.calls.filter(([path]) => path === "/api/game/riddle.daily")).toHaveLength(1);
});

it("validates terminal guesses and refreshes confirmed progress in the background", async () => {
  global.fetch = jest.fn((input) => {
    if (String(input) === "/api/game/guess.submit")
      return response({
        feedback: [{letter: "p", status: "green"}],
        attempts: 1,
        isCorrect: true,
        gameOver: true,
      });
    throw new Error(`unexpected route ${String(input)}`);
  }) as typeof fetch;
  await expect(
    createRedditHostServices().submitGuess({
      riddleId: "classic-1",
      gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001",
      guess: "p",
      requestId: "request-1",
    }),
  ).resolves.toMatchObject({attempts: 1, isCorrect: true, gameOver: true});
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("fails closed for unsupported Reddit capabilities without calling the gateway", async () => {
  global.fetch = jest.fn();
  /** Provides services behavior. */
  const services = createRedditHostServices();
  await expect(services.requestPurchase("coins")).rejects.toThrow("reddit-capability-unavailable");
  await expect(services.updateAvatar("data:image/png;base64,AA==")).rejects.toThrow("reddit-capability-unavailable");
  await expect(services.recordRaceAnalytics({} as never)).rejects.toThrow("reddit-capability-unavailable");
  expect(global.fetch).not.toHaveBeenCalled();
});

it("routes race access through the same-origin gateway and validates the response", async () => {
  global.fetch = jest.fn((input, init) => {
    expect(String(input)).toBe("/api/game/race.access");
    expect(init).toMatchObject({method: "POST", body: JSON.stringify({locale: "en"})});
    return response({enabled: true, locale: "en", reason: "enabled"});
  }) as typeof fetch;
  await expect(createRedditHostServices().getRaceAccess()).resolves.toEqual({
    enabled: true,
    locale: "en",
    reason: "enabled",
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("rejects malformed race responses from the gateway", async () => {
  global.fetch = jest.fn(() => response({enabled: true, locale: "xx", reason: "enabled"})) as typeof fetch;
  await expect(createRedditHostServices().getRaceAccess()).rejects.toThrow();
});

it("binds account deletion to the authenticated account generation", async () => {
  global.fetch = jest.fn(async () => ({ok: true, json: async () => ({ok: true})}) as Response);
  await expect(createRedditHostServices(7).deleteAccount("reddit-account")).resolves.toBeUndefined();
  expect(global.fetch).toHaveBeenCalledWith("/api/account/delete", {
    method: "POST",
    redirect: "error",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({accountGeneration: 7}),
  });
  expect(() => createRedditHostServices(0)).toThrow("invalid-reddit-account-generation");
});

it("routes categorized block and report actions through exact same-origin operations", async () => {
  global.fetch = jest.fn((input, init) => {
    if (String(input) === "/api/game/safety.block") {
      expect(init?.body).toBe(JSON.stringify({targetUserId: `reddit_${"b".repeat(40)}`}));
      return response({blocked: true});
    }
    if (String(input) === "/api/game/safety.report") return response({reportId: "opaque-report", queued: true});
    throw new Error(`unexpected route ${String(input)}`);
  }) as typeof fetch;
  /** Provides services behavior. */
  const services = createRedditHostServices();
  await expect(services.blockRival(`reddit_${"b".repeat(40)}`)).resolves.toEqual({blocked: true});
  await expect(
    services.reportRival({targetUserId: `reddit_${"b".repeat(40)}`, category: "cheating", requestId: "request-123"}),
  ).resolves.toEqual({reportId: "opaque-report", queued: true});
});

it("loads multiplayer rankings through the same-origin leaderboard gateway", async () => {
  /** Server-confirmed scores returned through Devvit. */
  const entry = {userId: "reddit-champion", username: "Champion", level: 1, xp: 0, progressScore: 1000000000, totalWins: 2, multiplayerWins: 42, bestStreak: 1, updatedAt: 100};
  global.fetch = jest.fn(() => response({entries: [entry], requestingUserId: "viewer"})) as typeof fetch;
  await expect(createRedditHostServices().loadLeaderboard("multiplayerWins")).resolves.toEqual([entry]);
  expect(global.fetch).toHaveBeenCalledWith("/api/game/leaderboard.list", expect.objectContaining({body: JSON.stringify({type: "multiplayerWins", limit: 25})}));
});
