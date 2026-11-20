import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {LiveRaceViewSchema, RACE_RULES, type LiveRaceCapability, type ListRaceCategoriesResponse} from "@riddle-quest/core/race";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {BackHandler} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {HostedRaceView} from "../screens/HostedRaceScreen";
import {createFakeHostServices} from "../test/fakeHostServices";
import {raceText} from "../i18n/raceCopy";
import {SUPPORTED_LOCALES} from "@riddle-quest/core/validation/locales";

/** Schema-valid multiplayer catalog exposed through the native selection UI. */
const catalog: ListRaceCategoriesResponse = {categories: [{categoryId: "mixed", nameKey: "RaceTo10.CATEGORY_MIXED_NAME",
  descriptionKey: "RaceTo10.CATEGORY_MIXED_DESCRIPTION", icon: "shuffle", colorToken: "#663399", availableRiddleCount: 30}], rules: RACE_RULES};
/** Creates the authoritative seat displayed by the native race view. */
const racing = () => LiveRaceViewSchema.parse({ticketId: "a".repeat(64), phase: "racing", serverNowMs: 1000,
  searchEndsAtMs: 60000, startsAtMs: 0, player: {displayName: "Alice", avatarUrl: null, bot: false, correctCount: 0},
  opponent: {displayName: "Bob", avatarUrl: null, bot: false, correctCount: 0}, result: null, rewardCoins: 0,
  run: {runId: "run-1", role: "creator", status: "active", categoryId: "mixed", locale: "en", rules: RACE_RULES,
    correctCount: 0, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [],
    currentRiddle: {riddleId: "question-1", text: "A test clue", answerLength: 4, position: 0, guessesUsed: 0,
      guessesRemaining: 5, hintAvailable: true, revealedLetters: [], confirmedGuesses: []}}});
/** Mounts the native view with provider-neutral authenticated ports. */
const renderRace = async (transport: LiveRaceCapability, onBack: () => void = () => undefined, locale: "en" | "es" = "en") => render(<SafeAreaProvider>
  <HostedRaceView locale={locale} accountUid="device-uid" services={createFakeHostServices()} transport={transport}
    categories={async () => catalog} onBack={onBack} />
</SafeAreaProvider>);

describe("Android live race view", () => {
  beforeEach(async () => {await AsyncStorage.clear();});
  it("loads translated categories, submits native input to authority and confirms quitting", async () => {
    /** Records the native join action without supplying client authority. */
    const join = jest.fn<LiveRaceCapability["join"]>(async () => racing());
    /** Captures native input delivered to the authoritative command port. */
    const update = jest.fn<LiveRaceCapability["update"]>(async () => racing());
    /** Acknowledges only the original join intent before navigation. */
    const retireJoin = jest.fn<NonNullable<LiveRaceCapability["retireJoin"]>>(async () => ({status: "retired"}));
    /** Records navigation after confirmed retirement. */
    const onBack = jest.fn();
    await renderRace({join, update, retireJoin}, onBack);
    await waitFor(() => expect(screen.getByTestId("race-category-mixed")).toHaveTextContent("Mixed"));
    await fireEvent.press(screen.getByTestId("race-start"));
    await waitFor(() => expect(screen.getByTestId("race-riddle")).toHaveTextContent("A test clue"));
    await fireEvent.changeText(screen.getByTestId("answer-input"), "test");
    await fireEvent.press(screen.getByTestId("race-submit"));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({action: "guess", guess: "test", riddleId: "question-1"})));
    await fireEvent.press(screen.getByTestId("race-close"));
    expect(screen.getByTestId("race-quit-confirm")).toBeTruthy(); expect(onBack).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("race-keep-playing"));
    expect(screen.getByTestId("race-riddle")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("race-close"));
    await fireEvent.press(screen.getByTestId("race-quit-confirm"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1)); expect(retireJoin).toHaveBeenCalledTimes(1);
  });
  it("shows a confirmed result and reward then returns to category selection", async () => {
    /** Authoritative terminal projection containing the committed reward. */
    const result = racing(); result.phase = "result"; result.result = "win"; result.rewardCoins = 50; result.run = null;
    /** Authenticated port returning the confirmed terminal state. */
    const transport: LiveRaceCapability = {join: async () => result, update: async () => result};
    await renderRace(transport);
    await waitFor(() => expect(screen.getByTestId("race-start")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("race-start"));
    await waitFor(() => expect(screen.getByTestId("race-result-title")).toHaveTextContent("You win!"));
    expect(screen.getByTestId("race-reward")).toHaveTextContent("+50 coins");
    await fireEvent.press(screen.getByTestId("race-play-again"));
    await waitFor(() => expect(screen.getByTestId("race-category-mixed")).toBeTruthy());
  });
  it("reuses the existing Spanish race translations and covers every supported locale", async () => {
    await renderRace({join: async () => racing(), update: async () => racing()}, undefined, "es");
    await waitFor(() => expect(screen.getByText(raceText("es", "CHOOSE_CATEGORY"))).toBeTruthy());
    for (const locale of SUPPORTED_LOCALES) {
      expect(raceText(locale, "MULTIPLAYER_BUTTON").length).toBeGreaterThan(0);
      expect(raceText(locale, "LIVE_REWARD", {coins: 50})).toContain("50");
    }
  });
  it("routes the Android hardware back button through the same quit confirmation", async () => {
    /** Captured native handler used to exercise system back navigation. */
    let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    /** Restorable native listener spy for the hardware-back scenario. */
    const subscription = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      hardwareBack = handler; return {remove: () => undefined};
    });
    await renderRace({join: async () => racing(), update: async () => racing()});
    await waitFor(() => expect(screen.getByTestId("race-start")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("race-start"));
    await waitFor(() => expect(screen.getByTestId("race-riddle")).toBeTruthy());
    await fireEvent(screen.getByTestId("race-close"), "press");
    await fireEvent.press(screen.getByTestId("race-keep-playing"));
    expect(hardwareBack).toBeDefined();
    await act(() => {expect(hardwareBack?.({type: "hardwareBackPress", timeStamp: Date.now()})).toBe(true);});
    expect(screen.getByTestId("race-quit-confirm")).toBeTruthy(); subscription.mockRestore();
  });

});
