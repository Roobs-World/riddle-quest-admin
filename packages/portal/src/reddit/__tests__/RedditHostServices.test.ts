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

it("loads an authenticated profile and canonical riddle through same-origin routes", async () => {
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
    sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "classic",
    index: 1,
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
  });
  expect((global.fetch as jest.Mock).mock.calls.every(([path]) => String(path).startsWith("/api/"))).toBe(true);
});

it("validates authoritative guesses and does not reload the profile for a non-economic mutation", async () => {
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
  expect(global.fetch).toHaveBeenCalledTimes(1);
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
