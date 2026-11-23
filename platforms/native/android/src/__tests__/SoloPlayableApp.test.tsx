import {describe, expect, it} from "@jest/globals";
import {createYouTubeContentSource, parseYouTubeSave, type YouTubeContentEnvelope, type YouTubeSdkPort} from "../../../../../src/solo";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import fixture from "#solo-content";
import {SoloPlayableApp} from "../SoloPlayableApp";

/** Content bound to the engineering fixture. */
const contentSource = createYouTubeContentSource(fixture as unknown as YouTubeContentEnvelope);
/** Phone-sized safe-area metrics so screens render without a native provider. */
const metrics: Metrics = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};
/** Renders the app inside the providers the native root supplies. */
const renderApp = (port: YouTubeSdkPort) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SoloPlayableApp sdk={port} contentSource={contentSource} />
    </SafeAreaProvider>,
  );
/** Builds an in-memory host port with controllable lifecycle. */
const createPort = (initialSave = ""): YouTubeSdkPort & {
  /** Latest persisted document. */
  saved: () => string;
  /** Emits pause to subscribers. */
  pause: () => void;
  /** Emits resume to subscribers. */
  resume: () => void;
} => {
  /** Persisted document. */
  let data = initialSave;
  /** Pause subscribers. */
  const pauses = new Set<() => void>();
  /** Resume subscribers. */
  const resumes = new Set<() => void>();
  return {
    inPlayablesEnvironment: false,
    /** No host signal exists in tests. */
    firstFrameReady() {},
    /** No host signal exists in tests. */
    gameReady() {},
    loadData: async () => data,
    saveData: async (value) => {
      data = value;
    },
    getLanguage: async () => "en-US",
    isAudioEnabled: () => true,
    onAudioEnabledChange: () => () => {},
    onPause: (callback) => {
      pauses.add(callback);
      return () => pauses.delete(callback);
    },
    onResume: (callback) => {
      resumes.add(callback);
      return () => resumes.delete(callback);
    },
    /** No host signal exists in tests. */
    logError() {},
    /** No host signal exists in tests. */
    logWarning() {},
    saved: () => data,
    pause: () => {
      for (const callback of pauses) callback();
    },
    resume: () => {
      for (const callback of resumes) callback();
    },
  };
};
/** Types one Latin answer through the shortcut keyboard. */
const typeAnswer = async (answer: string): Promise<void> => {
  for (const letter of answer.toUpperCase()) await fireEvent.press(screen.getByTestId(`key-${letter}`));
};
/** Waits until a screen with the given identifier is mounted. */
const expectScreen = (testID: string) => waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy());

describe("SoloPlayableApp", () => {
  it("boots into the menu and starts a classic riddle", async () => {
    /** Host port. */
    const port = createPort();
    await renderApp(port);
    await expectScreen("screen-menu");
    expect(screen.getByTestId("status-coins")).toHaveTextContent(/300$/u);
    await fireEvent.press(screen.getByTestId("start-classic"));
    await expectScreen("screen-game");
    expect(screen.getByTestId("riddle-text")).toBeTruthy();
    /** Persisted document after the start transition. */
    const parsed = parseYouTubeSave(port.saved(), contentSource.contentVersion);
    expect(parsed.kind).toBe("valid");
    expect(parsed.kind === "valid" && parsed.save.activeGame?.mode).toBe("classic");
  });

  it("solves a classic riddle with the shortcut keyboard and rewards the player", async () => {
    /** Host port. */
    const port = createPort();
    await renderApp(port);
    await expectScreen("screen-menu");
    await fireEvent.press(screen.getByTestId("start-classic"));
    await expectScreen("screen-game");
    /** English content used to look up the first classic answer. */
    const content = await contentSource.load("en");
    /** Answer to the first classic riddle. */
    const answer = content.riddles.get(content.classicOrder[0]!)!.answer;
    await typeAnswer(answer);
    await fireEvent.press(screen.getByTestId("submit"));
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Solved!");
    await fireEvent.press(screen.getByTestId("continue-to-menu"));
    await expectScreen("screen-menu");
    /** Persisted progression after the win. */
    const parsed = parseYouTubeSave(port.saved(), contentSource.contentVersion);
    expect(parsed.kind === "valid" && parsed.save.progression.totalWins).toBe(1);
    expect(parsed.kind === "valid" && parsed.save.progression.classicIndex).toBe(1);
  });

  it("scores a wrong guess and keeps the active puzzle", async () => {
    /** Host port. */
    const port = createPort();
    await renderApp(port);
    await expectScreen("screen-menu");
    await fireEvent.press(screen.getByTestId("start-classic"));
    await expectScreen("screen-game");
    /** English content used to size the wrong guess. */
    const content = await contentSource.load("en");
    /** Length of the first classic answer. */
    const length = content.riddles.get(content.classicOrder[0]!)!.answer.length;
    await typeAnswer("z".repeat(length));
    await fireEvent.press(screen.getByTestId("submit"));
    await expectScreen("guess-row-0");
    expect(screen.getByTestId("screen-game")).toBeTruthy();
  });

  it("restores an active puzzle from a persisted save and blocks input while paused", async () => {
    /** First session port. */
    const first = createPort();
    /** First session render. */
    const session = await renderApp(first);
    await expectScreen("screen-menu");
    await fireEvent.press(screen.getByTestId("start-daily"));
    await expectScreen("screen-game");
    await session.unmount();
    /** Second session port seeded with the first session's document. */
    const second = createPort(first.saved());
    await renderApp(second);
    await expectScreen("screen-game");
    await act(async () => second.pause());
    expect(screen.getByTestId("submit")).toBeDisabled();
    await act(async () => second.resume());
    await waitFor(() => expect(screen.getByTestId("hint")).toBeEnabled());
  });

  it("offers a confirmed reset for unreadable saved data", async () => {
    /** Port whose document is not a save. */
    const port = createPort("not json");
    await renderApp(port);
    await expectScreen("screen-reset");
    await fireEvent.press(screen.getByTestId("reset-start"));
    await fireEvent.press(screen.getByTestId("reset-confirm"));
    await expectScreen("screen-menu");
    expect(parseYouTubeSave(port.saved(), contentSource.contentVersion).kind).toBe("valid");
  });
});
