import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {AuthSnapshot, CompletionResult, HostServices, SinglePlayerGuessResult} from "@qwordly/hosted/hostTypes";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {createHostedRequestId} from "../hosted/useHostedGame";
import {HostedGameScreen} from "../screens/HostedGameScreen";

/** Server-issued riddle used by most scenarios. */
const issued = (overrides: Partial<BridgeRiddle> = {}): BridgeRiddle => ({
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
const score = (guess: string, attempts: number, canContinue = false): SinglePlayerGuessResult => {
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
const calls: string[] = [];
/** Auth subscribers. */
const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
/** Builds a fake host services object with scripted gameplay responses. */
const createServices = (script: {
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
/** Renders the hosted screen for a mode. */
const renderGame = (services: HostServices, mode: "classic" | "challenge" = "classic") => {
  /** Back handler spy. */
  const onBack = jest.fn();
  return render(
    <SafeAreaProvider>
      <HostedGameScreen services={services} mode={mode} locale="en" onBack={onBack} />
    </SafeAreaProvider>,
  ).then(() => onBack);
};
/** Types a Latin answer on the on-screen keys. */
const typeAnswer = async (answer: string): Promise<void> => {
  for (const letter of answer.toUpperCase()) await fireEvent.press(screen.getByTestId(`key-${letter}`));
};
/** Waits until a screen is mounted. */
const expectScreen = (testID: string) => waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy());

describe("createHostedRequestId", () => {
  it("produces replay-safe ids within the backend bounds", () => {
    /** Two ids with the same prefix. */
    const [first, second] = [createHostedRequestId("guess"), createHostedRequestId("guess")];
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(first.length).toBeLessThanOrEqual(128);
    expect(first.startsWith("guess-")).toBe(true);
  });
});

describe("HostedGameScreen", () => {
  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("loads an authoritative Classic riddle and shows the confirmed balance", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    expect(calls).toEqual(["loadRiddle:classic:authoritative"]);
    expect(screen.getByTestId("hosted-riddle-text")).toHaveTextContent(/Augustus/u);
    expect(screen.getByTestId("hosted-coins")).toHaveTextContent(/300$/u);
    expect(screen.getByTestId("hosted-submit")).toBeDisabled();
  });

  it("submits a wrong guess, shows server feedback, and clears the draft", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await typeAnswer("more");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectScreen("hosted-guess-row-0");
    expect(calls[1]).toMatch(/^submitGuess:more:guess-/u);
    expect(screen.getByTestId("hosted-guess-0-0-yellow")).toBeTruthy();
    expect(screen.getByTestId("hosted-guess-0-1-green")).toBeTruthy();
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("");
    expect(screen.getByTestId("hosted-submit")).toBeDisabled();
  });

  it("completes a solved riddle with the server and offers the next one", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await typeAnswer("rome");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectScreen("screen-hosted-result");
    expect(calls).toEqual(expect.arrayContaining(["completeGame:race:history:01"]));
    expect(screen.getByTestId("hosted-result-heading")).toHaveTextContent("Solved!");
    expect(screen.getByTestId("hosted-result-coins")).toHaveTextContent(/65$/u);
    await fireEvent.press(screen.getByTestId("hosted-next"));
    await expectScreen("screen-hosted-game");
    expect(calls.filter((call) => call.startsWith("loadRiddle"))).toHaveLength(2);
  });

  it("locks a purchased hint letter into its slot", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await fireEvent.press(screen.getByTestId("hosted-hint"));
    await waitFor(() => expect(screen.getByTestId("hosted-slot-1")).toHaveTextContent("o"));
    expect(calls).toContain("requestHint:");
    expect(screen.getByTestId("hosted-slot-1")).toBeDisabled();
    await typeAnswer("rme");
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("r");
    expect(screen.getByTestId("hosted-slot-2")).toHaveTextContent("m");
    expect(screen.getByTestId("hosted-slot-3")).toHaveTextContent("e");
    expect(screen.getByTestId("hosted-submit")).toBeEnabled();
  });

  it("offers a paid continue when the server allows it, then settles a loss on finish", async () => {
    /** Services whose fifth wrong guess offers a continue. */
    const services = createServices({
      guess: async (guess) => ({...score(guess, 5, true), gameOver: false}),
      complete: async () => ({attempts: 5, isCorrect: false, coinsEarned: 0, newlyUnlockedAchievementIds: []}),
    });
    await renderGame(services);
    await expectScreen("screen-hosted-game");
    await typeAnswer("zzzz");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectScreen("hosted-buy-continue");
    expect(screen.queryByTestId("hosted-submit")).toBeNull();
    await fireEvent.press(screen.getByTestId("hosted-buy-continue"));
    await expectScreen("hosted-submit");
    expect(calls).toContain("spendCoins:continue");
    await typeAnswer("zzzz");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectScreen("hosted-buy-continue");
    await fireEvent.press(screen.getByTestId("hosted-finish"));
    await expectScreen("screen-hosted-result");
    expect(screen.getByTestId("hosted-result-heading")).toHaveTextContent("Not solved");
  });

  it("skips a Classic riddle and reloads the next issued one", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await fireEvent.press(screen.getByTestId("hosted-skip"));
    await waitFor(() => expect(calls.filter((call) => call.startsWith("loadRiddle"))).toHaveLength(2));
    expect(calls).toContain("skipRiddle:race:history:01");
    await expectScreen("screen-hosted-game");
  });

  it("reports a completed Daily and hides the skip action for Daily play", async () => {
    /** Services whose Daily is already solved. */
    const services = createServices({
      load: async () => {
        throw Object.assign(new Error("done"), {code: "daily-completed"});
      },
    });
    await renderGame(services, "challenge");
    await expectScreen("screen-hosted-unavailable");
    expect(screen.getByTestId("hosted-heading")).toHaveTextContent("Daily complete");
    expect(screen.queryByTestId("hosted-retry")).toBeNull();
  });

  it("retries a failed load", async () => {
    /** Whether the next load fails. */
    let failing = true;
    /** Services whose first load fails. */
    const services = createServices({
      load: async () => {
        if (failing) {
          failing = false;
          throw new Error("offline");
        }
        return issued({gameMode: "challenge"});
      },
    });
    await renderGame(services, "challenge");
    await expectScreen("screen-hosted-unavailable");
    await fireEvent.press(screen.getByTestId("hosted-retry"));
    await expectScreen("screen-hosted-game");
    expect(screen.queryByTestId("hosted-skip")).toBeNull();
  });

  it("restores accepted guesses and revealed hints from an issued session", async () => {
    /** Services issuing a session with recovery data. */
    const services = createServices({
      load: async () =>
        issued({
          attemptsUsed: 1,
          acceptedGuesses: [{attempt: 1, feedback: [{letter: "m", status: "red"}, {letter: "o", status: "green"}, {letter: "r", status: "yellow"}, {letter: "e", status: "green"}]}],
          revealedHints: [{index: 0, letter: "r"}],
        }),
    });
    await renderGame(services);
    await expectScreen("hosted-guess-row-0");
    expect(screen.getByTestId("hosted-guess-0-1-green")).toBeTruthy();
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("r");
    expect(screen.getByTestId("hosted-slot-0")).toBeDisabled();
  });

  it("returns to the account screen", async () => {
    /** Back handler. */
    const onBack = await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await fireEvent.press(screen.getByTestId("hosted-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
