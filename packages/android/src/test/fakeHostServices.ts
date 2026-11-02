import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {AuthSnapshot, CompletionResult, HostServices, SinglePlayerGuessResult} from "@qwordly/hosted/hostTypes";
/** Server-issued riddle used by most scenarios. */
export const issued = (overrides: Partial<BridgeRiddle> = {}): BridgeRiddle => ({
  riddleId: "race:history:01",
  text: "Which ancient city was the centre of an empire ruled by emperors such as Augustus?",
  answerLength: 4,
  evaluation: {answer: "rome", locale: "en"},
  sessionToken: "session-token-0123456789abcdef",
  gameMode: "classic",
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
  ...overrides,
});
/** Scores a guess against the fixture answer the way the backend would. */
export const score = (guess: string, attempts: number, canContinue = false): SinglePlayerGuessResult => {
  /** Positional feedback. */
  const feedback = [...guess].map((letter, index) => ({
    letter,
    status: "rome"[index] === letter ? ("green" as const) : "rome".includes(letter) ? ("yellow" as const) : ("red" as const),
  }));
  /** Whether every letter matched. */
  const isCorrect = guess === "rome";
  return {feedback, attempts, isCorrect, gameOver: isCorrect || (!canContinue && attempts >= 6), canContinue};
};
/** Recorded service calls. */
export const calls: string[] = [];
/** Auth subscribers. */
export const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
/** Builds a fake host services object with scripted gameplay responses, shared by the hosted screen and root suites. */
export const createFakeHostServices = (script: {
  /** Load behaviour per call. */
  load?: () => Promise<BridgeRiddle>;
  /** Guess behaviour. */
  guess?: (guess: string) => Promise<SinglePlayerGuessResult>;
  /** Completion behaviour. */
  complete?: () => Promise<CompletionResult>;
} = {}): HostServices => {
  /** Attempts counted by the fake backend. */
  let attempts = 0;
  /** Gameplay surface with scripted responses; multiplayer and commerce members are inert stubs. */
  const services: HostServices = {
    products: [],
    auth: {
      /** Publishes one confirmed account immediately, like the shared services after sign-in. */
      subscribe: (listener) => {
        subscribers.add(listener);
        listener({user: {uid: "device-uid", isAnonymous: true}, profile: {username: "Android", coins: 300, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
        return () => subscribers.delete(listener);
      },
    },
    loadRiddle: async (input) => {
      calls.push(`loadRiddle:${input.gameMode}:${input.authoritative ? "authoritative" : "buffered"}`);
      return script.load ? script.load() : issued();
    },
    loadProfile: async () => null,
    completeGame: async (input) => {
      calls.push(`completeGame:${input.riddleId}`);
      return script.complete ? script.complete() : {attempts, isCorrect: true, coinsEarned: 65, newlyUnlockedAchievementIds: ["first_win"], newXp: 100};
    },
    submitGuess: async (input) => {
      calls.push(`submitGuess:${input.guess}:${input.requestId.slice(0, 6)}`);
      attempts += 1;
      return script.guess ? script.guess(input.guess) : score(input.guess, attempts);
    },
    requestHint: async (input) => {
      calls.push(`requestHint:${input.currentAttempt.join("")}`);
      return {revealedLetter: "o", index: 1, coinsCost: 25};
    },
    spendCoins: async (input) => {
      calls.push(`spendCoins:${input.reason}`);
      return {newCoins: 250};
    },
    skipRiddle: async (input) => {
      calls.push(`skipRiddle:${input.riddleId}`);
      return {success: true, message: "", costDeducted: 100, newCoins: 200};
    },
    requestPurchase: async () => ({success: false, cancelled: true, productId: "", purchaseType: "consumable"}),
    loadLeaderboard: async () => [],
    updateUsername: async () => null,
    updateAvatar: async () => null,
    deleteAccount: async () => {},
    listRaceCategories: async () => ({categories: []}) as never,
    startRace: async () => ({}) as never,
    readyRace: async () => ({}) as never,
    submitRaceGuess: async () => ({}) as never,
    requestRaceHint: async () => ({}) as never,
    skipRaceRiddle: async () => ({}) as never,
    resumeRace: async () => ({}) as never,
    abandonRace: async () => ({}) as never,
    publishRace: async () => ({}) as never,
    getRaceChallenge: async () => ({}) as never,
    getRaceOutcome: async () => ({}) as never,
    listRaceInbox: async () => ({}) as never,
    blockRival: async () => ({blocked: true}),
    reportRival: async () => ({}) as never,
    getRaceAccess: async () => ({}) as never,
    recordRaceAnalytics: async () => ({}) as never,
  };
  return services;
};
