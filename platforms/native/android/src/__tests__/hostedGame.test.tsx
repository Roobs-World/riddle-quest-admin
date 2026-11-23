import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle} from "../../../../../src/core/bridge";
import type {HostServices} from "../../../../../src/hosted/hostTypes";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {createHostedRequestId} from "../hosted/useHostedGame";
import {HostedGameScreen} from "../screens/HostedGameScreen";
import {calls, createFakeHostServices as createServices, issued, score, subscribers} from "../test/fakeHostServices";

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

  it("returns to the hosted home", async () => {
    /** Back handler. */
    const onBack = await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await fireEvent.press(screen.getByTestId("hosted-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("maps host error codes to localized notices and keeps the draft for a retry", async () => {
    /** Failures the fake backend raises in order. */
    const failures = [Object.assign(new Error("slow"), {code: "unavailable"}), Object.assign(new Error("poor"), {code: "resource-exhausted"}), new Error("odd")];
    await renderGame(
      createServices({
        guess: async () => {
          throw failures.shift();
        },
      }),
    );
    await expectScreen("screen-hosted-game");
    await typeAnswer("rome");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toHaveTextContent("The service is temporarily unavailable. Try again."));
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toHaveTextContent("Not enough coins."));
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toHaveTextContent("That action could not be completed."));
    expect(screen.getByTestId("hosted-slot-3")).toHaveTextContent("e");
  });

  it("edits the draft with backspace and slot taps, and refuses an incomplete submit from the editor", async () => {
    await renderGame(createServices());
    await expectScreen("screen-hosted-game");
    await typeAnswer("rom");
    await fireEvent.press(screen.getByTestId("key-backspace"));
    expect(screen.getByTestId("hosted-slot-2")).toHaveTextContent("");
    await fireEvent.press(screen.getByTestId("hosted-slot-0"));
    await typeAnswer("x");
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("x");
    await fireEvent(screen.getByTestId("answer-input"), "submitEditing");
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toHaveTextContent("Complete every answer slot."));
    expect(calls.filter((call) => call.startsWith("submitGuess"))).toHaveLength(0);
  });
});

describe("createHostedRequestId without Web Crypto", () => {
  it("still produces unique ids within the backend bounds", () => {
    /** Original crypto global. */
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {value: undefined, configurable: true});
    try {
      /** Two ids generated without `randomUUID`. */
      const [first, second] = [createHostedRequestId("hint"), createHostedRequestId("hint")];
      expect(first).not.toBe(second);
      expect(first.length).toBeLessThanOrEqual(128);
      expect(first.startsWith("hint-")).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });
});
