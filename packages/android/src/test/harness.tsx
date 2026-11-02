import {
  createEmptyYouTubeSave,
  createYouTubeContentSource,
  serializeYouTubeSave,
  type YouTubeContentEnvelope,
  type YouTubeSaveV1,
  type YouTubeSdkPort,
} from "@riddle-quest/solo";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider, type Metrics} from "react-native-safe-area-context";
import fixture from "#solo-content";
import {SoloPlayableApp} from "../SoloPlayableApp";

/** Content bound to the engineering fixture. */
export const contentSource = createYouTubeContentSource(fixture as unknown as YouTubeContentEnvelope);
/** Phone-sized safe-area metrics so screens render without a native provider. */
const metrics: Metrics = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};
/** Host port with controllable persistence and lifecycle. */
export type TestPort = YouTubeSdkPort & {
  /** Latest persisted document. */
  saved: () => string;
  /** Emits pause to subscribers. */
  pause: () => void;
  /** Emits resume to subscribers. */
  resume: () => void;
  /** Makes the next writes fail (`true`) or succeed (`false`). */
  failSaves: (failing: boolean) => void;
  /** Makes the next load fail once. */
  failNextLoad: () => void;
};
/** Builds an in-memory host port. */
export const createPort = (initialSave = "", languageTag = "en-US"): TestPort => {
  /** Persisted document. */
  let data = initialSave;
  /** Whether writes currently fail. */
  let failing = false;
  /** Whether the next load fails. */
  let loadFails = false;
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
    loadData: async () => {
      if (loadFails) {
        loadFails = false;
        throw new Error("load-unavailable");
      }
      return data;
    },
    saveData: async (value) => {
      if (failing) throw new Error("save-unavailable");
      data = value;
    },
    getLanguage: async () => languageTag,
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
    failSaves: (value) => {
      failing = value;
    },
    failNextLoad: () => {
      loadFails = true;
    },
  };
};
/** Serializes a fresh save after applying one mutation, for seeding ports. */
export const seedSave = (mutate: (save: YouTubeSaveV1) => void): string => {
  /** Fresh save for the fixture content version. */
  const save = createEmptyYouTubeSave(contentSource.contentVersion);
  save.revision = 1;
  mutate(save);
  return serializeYouTubeSave(save);
};
/** Renders the app inside the providers the native root supplies. */
export const renderApp = (port: YouTubeSdkPort) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SoloPlayableApp sdk={port} contentSource={contentSource} />
    </SafeAreaProvider>,
  );
/** Waits until a screen with the given identifier is mounted. */
export const expectScreen = (testID: string) => waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy());
/** Presses a control by identifier. */
export const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
/** Types one Latin answer through the shortcut keyboard. */
export const typeAnswer = async (answer: string): Promise<void> => {
  for (const letter of answer.toUpperCase()) await press(`key-${letter}`);
};
/** Boots a fresh port into the menu and starts the requested mode. */
export const startMode = async (mode: "classic" | "daily", port = createPort()): Promise<TestPort> => {
  await renderApp(port);
  await expectScreen("screen-menu");
  await press(`start-${mode}`);
  await expectScreen("screen-game");
  return port;
};
/** Submits one wrong guess of the given length and waits for its scored row. */
export const submitWrongGuess = async (length: number, row: number): Promise<void> => {
  await typeAnswer("z".repeat(length));
  await press("submit");
  await expectScreen(`guess-row-${row}`);
};
