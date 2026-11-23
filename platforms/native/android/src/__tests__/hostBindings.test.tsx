import {describe, expect, it, jest} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** The root creates the hosted Firebase client; this suite covers the device bindings, not Firebase. */
jest.mock("../hosted/firebaseClient", () => ({
  createHostedFirebaseClient: () => ({
    projectId: "test-project",
    usingEmulators: false,
    currentUser: () => null,
    onUserChanged: () => () => {},
    signInAnonymously: async () => ({uid: "test"}),
    provisionAccount: async () => ({uid: "test", created: true, coins: 300}),
  }),
}));
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {I18nManager} from "react-native";
import {ANDROID_SAVE_KEY, createAndroidSdkPort, resolveDeviceLanguageTag} from "../androidSdkPort";
import {App} from "../App";
import {androidContentSource} from "../content";
import {AnswerInput} from "../screens/AnswerInput";

describe("App", () => {
  it("connects hosted-first, then boots the offline game through the device port and persists to AsyncStorage", async () => {
    await AsyncStorage.removeItem(ANDROID_SAVE_KEY);
    await render(<App />);
    await waitFor(() => expect(screen.getByTestId("screen-hosted-home")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("play-offline"));
    await waitFor(() => expect(screen.getByTestId("screen-menu")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("start-classic"));
    await waitFor(() => expect(screen.getByTestId("screen-game")).toBeTruthy());
    /** Document the device port wrote. */
    const persisted = await AsyncStorage.getItem(ANDROID_SAVE_KEY);
    expect(persisted).toEqual(expect.stringContaining('"activeGame"'));
  });
});

describe("androidContentSource", () => {
  it("binds the bundled content pack with inline locale packs", async () => {
    expect(androidContentSource.contentVersion).toEqual(expect.any(String));
    /** English content from the bundled pack. */
    const content = await androidContentSource.load("en");
    expect(content.classicOrder.length).toBeGreaterThan(0);
    expect(content.daily.segments.length).toBeGreaterThan(0);
  });
});

describe("resolveDeviceLanguageTag", () => {
  it("prefers the platform locale identifier and normalizes underscores", () => {
    /** Platform constants spy. */
    const constants = jest.spyOn(I18nManager, "getConstants").mockReturnValue({
      isRTL: false,
      doLeftAndRightSwapInRTL: true,
      localeIdentifier: "pt_BR",
    });
    expect(resolveDeviceLanguageTag()).toBe("pt-BR");
    constants.mockRestore();
  });

  it("falls back to the JavaScript locale when the platform reports none", () => {
    /** Platform constants spy. */
    const constants = jest.spyOn(I18nManager, "getConstants").mockReturnValue({
      isRTL: false,
      doLeftAndRightSwapInRTL: true,
    });
    expect(resolveDeviceLanguageTag()).toBe(Intl.DateTimeFormat().resolvedOptions().locale);
    constants.mockRestore();
  });

  it("is used by the default port", async () => {
    /** Platform constants spy. */
    const constants = jest.spyOn(I18nManager, "getConstants").mockReturnValue({
      isRTL: false,
      doLeftAndRightSwapInRTL: true,
      localeIdentifier: "de_DE",
    });
    /** Port built from device defaults. */
    const port = createAndroidSdkPort();
    await expect(port.getLanguage()).resolves.toBe("de-DE");
    expect(port.onAudioEnabledChange(() => {})).toEqual(expect.any(Function));
    port.logError();
    port.logWarning();
    port.firstFrameReady();
    port.gameReady();
    constants.mockRestore();
  });
});

describe("AnswerInput native editor", () => {
  /** Renders the editor with recording callbacks. */
  const renderEditor = async (disabled = false, latinShortcut = true) => {
    /** Recorded callbacks. */
    const calls: string[] = [];
    await render(
      <AnswerInput
        inputRef={{current: null}}
        disabled={disabled}
        locale="en"
        label="Type your answer"
        latinShortcut={latinShortcut}
        onText={(text) => calls.push(`text:${text}`)}
        onBackspace={() => calls.push("backspace")}
        onSubmit={() => calls.push("submit")}
      />,
    );
    return calls;
  };

  it("forwards committed text, backspace, and submit from the native editor", async () => {
    /** Recorded callbacks. */
    const calls = await renderEditor();
    await fireEvent.changeText(screen.getByTestId("answer-input"), "ab");
    await fireEvent.changeText(screen.getByTestId("answer-input"), "");
    await fireEvent(screen.getByTestId("answer-input"), "keyPress", {nativeEvent: {key: "Backspace"}});
    await fireEvent(screen.getByTestId("answer-input"), "keyPress", {nativeEvent: {key: "a"}});
    await fireEvent(screen.getByTestId("answer-input"), "submitEditing");
    expect(calls).toEqual(["text:ab", "backspace", "submit"]);
  });

  it("hides the shortcut keys for non-Latin answers and lets the system keyboard open", async () => {
    await renderEditor(false, false);
    expect(screen.queryByTestId("latin-keyboard")).toBeNull();
    expect(screen.getByTestId("answer-input").props.showSoftInputOnFocus).toBe(true);
  });

  it("keeps the system keyboard hidden while the shortcut keys are shown", async () => {
    await renderEditor();
    expect(screen.getByTestId("latin-keyboard")).toBeTruthy();
    expect(screen.getByTestId("answer-input").props.showSoftInputOnFocus).toBe(false);
  });

  it("ignores shortcut presses while disabled", async () => {
    /** Recorded callbacks. */
    const calls = await renderEditor(true);
    await fireEvent.press(screen.getByTestId("key-Q"));
    await fireEvent.press(screen.getByTestId("key-backspace"));
    expect(calls).toEqual([]);
    expect(screen.getByTestId("answer-input")).toBeDisabled();
  });
});
