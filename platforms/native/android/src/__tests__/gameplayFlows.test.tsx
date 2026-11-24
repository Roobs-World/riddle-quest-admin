import {describe, expect, it} from "@jest/globals";
import {getYouTubeDailyRiddleId} from "../../../../../src/gameplay/local/localSoloGameRules";
import {parseYouTubeSave} from "../../../../../src/gameplay/persistence/localSave";
import {utcDay, YOUTUBE_BASE_ATTEMPTS, YOUTUBE_CLASSIC_SKIP_COST, YOUTUBE_CONTINUE_COST, YOUTUBE_HINT_COST} from "../../../../../src/progression/economy/localEconomy";
import {fireEvent, screen, waitFor} from "@testing-library/react-native";
import {contentSource, createPort, expectScreen, press, renderApp, seedSave, startMode, submitWrongGuess, typeAnswer} from "../test/harness";

/** Reads the persisted save of a port as a validated document. */
const readSave = (saved: string) => {
  /** Parsed persisted document. */
  const parsed = parseYouTubeSave(saved, contentSource.contentVersion);
  if (parsed.kind !== "valid") throw new Error(`Expected a valid save, saw ${parsed.kind}`);
  return parsed.save;
};
/** English content for answer lookups. */
const english = contentSource.load("en");
/** Answer and length of the first classic riddle. */
const firstClassic = async () => {
  /** English content. */
  const content = await english;
  /** First classic answer. */
  const answer = content.riddles.get(content.classicOrder[0]!)!.answer;
  return {answer, length: answer.length};
};

describe("hints", () => {
  it("reveals a letter for coins and locks the hinted slot", async () => {
    /** Host port. */
    const port = await startMode("classic");
    await press("hint");
    await waitFor(() => expect(screen.getByTestId("status-coins")).toHaveTextContent(new RegExp(`${300 - YOUTUBE_HINT_COST}$`, "u")));
    /** Persisted save after the hint. */
    const save = readSave(port.saved());
    expect(save.activeGame?.hintRevealedIndices).toHaveLength(1);
    expect(save.progression.totalHintsUsed).toBe(1);
    /** Index of the revealed slot. */
    const hinted = save.activeGame!.hintRevealedIndices[0]!;
    expect(screen.getByTestId(`slot-${hinted}`)).toBeDisabled();
  });

  it("disables hint, skip, and continue purchases without coins", async () => {
    /** Port seeded with an empty wallet. */
    const port = createPort(seedSave((save) => {
      save.progression.coins = 0;
    }));
    await startMode("classic", port);
    expect(screen.getByTestId("hint")).toBeDisabled();
    expect(screen.getByTestId("skip")).toBeDisabled();
    /** Length of the first classic answer. */
    const {length} = await firstClassic();
    for (let attempt = 0; attempt < YOUTUBE_BASE_ATTEMPTS; attempt += 1) await submitWrongGuess(length, attempt);
    await expectScreen("buy-continue");
    expect(screen.getByTestId("buy-continue")).toBeDisabled();
    expect(screen.getByTestId("finish-run")).toBeEnabled();
  });
});

describe("skipping", () => {
  it("skips a classic riddle for coins and advances the collection", async () => {
    /** Host port. */
    const port = await startMode("classic");
    await press("skip");
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Skipped");
    expect(screen.getByTestId("result-coins")).toHaveTextContent(/0$/u);
    await press("continue-to-menu");
    await expectScreen("screen-menu");
    /** Persisted save after the skip. */
    const save = readSave(port.saved());
    expect(save.progression.coins).toBe(300 - YOUTUBE_CLASSIC_SKIP_COST);
    expect(save.progression.classicIndex).toBe(1);
    expect(screen.getByTestId("start-classic")).toHaveAccessibleName(/2\/\d+$/u);
  });

  it("offers no skip during the daily puzzle", async () => {
    await startMode("daily");
    expect(screen.queryByTestId("skip")).toBeNull();
    expect(screen.getByTestId("hint")).toBeEnabled();
  });
});

describe("attempt limit", () => {
  it("offers a paid continue after the base attempts and ends in a loss when it is spent", async () => {
    /** Host port. */
    const port = await startMode("classic");
    /** Length of the first classic answer. */
    const {length} = await firstClassic();
    for (let attempt = 0; attempt < YOUTUBE_BASE_ATTEMPTS; attempt += 1) await submitWrongGuess(length, attempt);
    await expectScreen("buy-continue");
    expect(screen.queryByTestId("submit")).toBeNull();
    await press("buy-continue");
    await expectScreen("submit");
    expect(readSave(port.saved()).progression.coins).toBe(300 - YOUTUBE_CONTINUE_COST);
    expect(screen.getByTestId(`guess-row-${YOUTUBE_BASE_ATTEMPTS - 1}`)).toBeTruthy();
    await typeAnswer("z".repeat(length));
    await press("submit");
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Not solved");
    /** Persisted save after the loss. */
    const save = readSave(port.saved());
    expect(save.progression.gamesPlayed).toBe(1);
    expect(save.progression.totalWins).toBe(0);
    expect(save.activeGame).toBeNull();
  });

  it("lets the player finish without buying a continue", async () => {
    /** Host port. */
    const port = await startMode("classic");
    /** Length of the first classic answer. */
    const {length} = await firstClassic();
    for (let attempt = 0; attempt < YOUTUBE_BASE_ATTEMPTS; attempt += 1) await submitWrongGuess(length, attempt);
    await expectScreen("finish-run");
    await press("finish-run");
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Not solved");
    expect(readSave(port.saved()).progression.coins).toBe(300);
  });

  it("solves after a continue and still rewards the win", async () => {
    /** Host port. */
    const port = await startMode("classic");
    /** First classic answer. */
    const {answer, length} = await firstClassic();
    for (let attempt = 0; attempt < YOUTUBE_BASE_ATTEMPTS; attempt += 1) await submitWrongGuess(length, attempt);
    await press("buy-continue");
    await expectScreen("submit");
    await typeAnswer(answer);
    await press("submit");
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Solved!");
    expect(screen.getByTestId("result-attempts")).toHaveTextContent(new RegExp(`${YOUTUBE_BASE_ATTEMPTS + 1}$`, "u"));
    expect(readSave(port.saved()).progression.totalWins).toBe(1);
  });
});

describe("daily puzzle", () => {
  it("solves today's daily, records the streak, and closes the daily card", async () => {
    /** Host port. */
    const port = await startMode("daily");
    /** English content. */
    const content = await english;
    /** Today's canonical daily riddle. */
    const dailyId = getYouTubeDailyRiddleId(content, utcDay(new Date()));
    /** Today's daily answer. */
    const answer = content.riddles.get(dailyId!)!.answer;
    expect(readSave(port.saved()).activeGame?.riddleId).toBe(dailyId);
    await typeAnswer(answer);
    await press("submit");
    await expectScreen("screen-result");
    expect(screen.getByTestId("result-heading")).toHaveTextContent("Solved!");
    await press("continue-to-menu");
    await expectScreen("screen-menu");
    /** Persisted save after the daily win. */
    const save = readSave(port.saved());
    expect(save.progression.dailyPuzzlesCompleted).toBe(1);
    expect(save.progression.currentDailyStreak).toBe(1);
    expect(save.progression.lastDailyCompletedDate).toBe(utcDay(new Date()));
    expect(screen.getByTestId("start-daily")).toBeDisabled();
    expect(screen.getByTestId("start-daily")).toHaveAccessibleName(/Daily complete$/u);
  });

  it("keeps a completed daily closed on a later launch", async () => {
    /** Port seeded with today's daily already complete. */
    const port = createPort(seedSave((save) => {
      save.progression.lastDailyCompletedDate = utcDay(new Date());
      save.progression.dailyPuzzlesCompleted = 1;
    }));
    await renderApp(port);
    await expectScreen("screen-menu");
    expect(screen.getByTestId("start-daily")).toBeDisabled();
    expect(screen.getByTestId("start-classic")).toBeEnabled();
  });
});

describe("wrong guesses", () => {
  it("scores every letter and keeps a cleared row for the next attempt", async () => {
    await startMode("classic");
    /** Length of the first classic answer. */
    const {length} = await firstClassic();
    await submitWrongGuess(length, 0);
    for (let index = 0; index < length; index += 1) expect(screen.getByTestId(`guess-0-${index}-red`)).toBeTruthy();
    expect(screen.getByTestId("submit")).toBeDisabled();
    for (let index = 0; index < length; index += 1) expect(screen.getByTestId(`slot-${index}`)).toHaveTextContent("");
  });

  it("marks a misplaced letter yellow", async () => {
    await startMode("classic");
    /** First classic answer. */
    const {answer, length} = await firstClassic();
    /** The answer rotated by one letter so every letter is present but misplaced. */
    const rotated = answer.slice(1) + answer.slice(0, 1);
    await typeAnswer(rotated);
    await press("submit");
    await expectScreen("guess-row-0");
    expect(screen.getAllByTestId(/^guess-0-\d+-yellow$/u).length + screen.queryAllByTestId(/^guess-0-\d+-green$/u).length).toBe(length);
  });

  it("deletes the active slot with backspace and retargets by tapping a tile", async () => {
    await startMode("classic");
    await typeAnswer("ab");
    expect(screen.getByTestId("slot-0")).toHaveTextContent("a");
    expect(screen.getByTestId("slot-1")).toHaveTextContent("b");
    await press("key-backspace");
    expect(screen.getByTestId("slot-1")).toHaveTextContent("");
    await press("slot-0");
    await press("key-C");
    expect(screen.getByTestId("slot-0")).toHaveTextContent("c");
  });
});

describe("progress and preferences", () => {
  it("shows progression and persists accessibility preferences", async () => {
    /** Port seeded with some history. */
    const port = createPort(seedSave((save) => {
      save.progression.totalWins = 3;
      save.progression.gamesPlayed = 4;
      save.progression.xp = 250;
      save.progression.level = 2;
      save.progression.unlockedAchievementIds = ["first_win", "wins_10"];
    }));
    await renderApp(port);
    await expectScreen("screen-menu");
    await press("show-progress");
    await expectScreen("screen-progress");
    expect(screen.getByLabelText("Wins: 3")).toBeTruthy();
    expect(screen.getByLabelText("Games: 4")).toBeTruthy();
    expect(screen.getByLabelText("Level: 2")).toBeTruthy();
    const achievements = screen.getByRole("button", {name: /^Achievements 2 \/ /});
    expect(achievements.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(achievements);
    expect(screen.getByText("Wins: 10")).toBeTruthy();
    expect(screen.getByRole("progressbar", {name: "Wins: 10: 10 / 10"}).props.accessibilityValue.now).toBe(100);
    await fireEvent(screen.getByTestId("preference-reduced-motion"), "valueChange", true);
    await waitFor(() => expect(readSave(port.saved()).preferences.reducedMotion).toBe(true));
    expect(screen.queryByTestId("preference-high-contrast")).toBeNull();
    await press("back");
    await expectScreen("screen-menu");
  });

  it("shows locked achievement goals without granting them to a fresh player", async () => {
    await renderApp(createPort());
    await expectScreen("screen-menu");
    await press("show-progress");
    await expectScreen("screen-progress");
    const achievements = screen.getByRole("button", {name: /^Achievements 0 \/ /});
    expect(achievements.props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByRole("progressbar", {name: "First Win: 0 / 1"})).toBeNull();
    await fireEvent.press(achievements);
    expect(screen.getByRole("progressbar", {name: "First Win: 0 / 1"}).props.accessibilityValue.now).toBe(0);
    expect(screen.queryByText(/✓ Unlocked/u)).toBeNull();
  });

  it("dismisses first-run guidance durably", async () => {
    /** Host port. */
    const port = createPort();
    await renderApp(port);
    await expectScreen("screen-menu");
    expect(screen.getByTestId("guidance-banner")).toBeTruthy();
    await press("guidance-banner-action");
    await waitFor(() => expect(screen.queryByTestId("guidance-banner")).toBeNull());
    expect(readSave(port.saved()).preferences.guidanceComplete).toBe(true);
  });
});

describe("save failures", () => {
  it("blocks material actions while a write is pending and recovers on retry", async () => {
    /** Host port. */
    const port = await startMode("classic");
    port.failSaves(true);
    await press("hint");
    await expectScreen("save-banner");
    expect(screen.getByTestId("submit")).toBeDisabled();
    expect(screen.getByTestId("hint")).toBeDisabled();
    port.failSaves(false);
    await press("save-banner-action");
    await waitFor(() => expect(screen.queryByTestId("save-banner")).toBeNull());
    expect(readSave(port.saved()).progression.coins).toBe(300 - YOUTUBE_HINT_COST);
    expect(screen.getByTestId("hint")).toBeEnabled();
  });

  it("retries a blocked write from the menu banner", async () => {
    /** Host port. */
    const port = createPort();
    await renderApp(port);
    await expectScreen("screen-menu");
    port.failSaves(true);
    await press("guidance-banner-action");
    await expectScreen("save-banner");
    expect(screen.getByTestId("start-classic")).toBeDisabled();
    port.failSaves(false);
    await press("save-banner-action");
    await waitFor(() => expect(screen.queryByTestId("save-banner")).toBeNull());
    expect(readSave(port.saved()).preferences.guidanceComplete).toBe(true);
    expect(screen.getByTestId("start-classic")).toBeEnabled();
  });

  it("retries a failed initial load", async () => {
    /** Host port whose first load fails. */
    const port = createPort();
    port.failNextLoad();
    await renderApp(port);
    await expectScreen("screen-failure");
    expect(screen.getByTestId("failure-message")).toHaveTextContent(/could not be loaded/u);
    await press("retry");
    await expectScreen("screen-menu");
  });

  it("explains a newer save and lets the player cancel the reset", async () => {
    /** Port whose document comes from a future schema. */
    const port = createPort(JSON.stringify({schemaVersion: 99}));
    await renderApp(port);
    await expectScreen("screen-reset");
    expect(screen.getByTestId("reset-message")).toHaveTextContent(/newer game version/u);
    await press("reset-start");
    expect(screen.getByTestId("reset-message")).toHaveTextContent(/permanently replaces/u);
    await press("reset-cancel");
    expect(screen.getByTestId("reset-message")).toHaveTextContent(/newer game version/u);
    expect(port.saved()).toBe(JSON.stringify({schemaVersion: 99}));
  });

  it("removes an active puzzle that no longer matches bundled content and says so", async () => {
    /** Port whose active puzzle points at stale content. */
    const port = createPort(seedSave((save) => {
      save.activeGame = {
        sessionRevision: 1,
        mode: "classic",
        riddleId: "race:history:01",
        contentFingerprint: "0123456789abcdef0123456789abcdef",
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      };
    }));
    await renderApp(port);
    await expectScreen("screen-menu");
    expect(screen.getByTestId("recovery-banner")).toBeTruthy();
    expect(readSave(port.saved()).activeGame).toBeNull();
    await press("recovery-banner-action");
    await waitFor(() => expect(screen.queryByTestId("recovery-banner")).toBeNull());
  });
});

describe("locale", () => {
  it("renders bundled Spanish copy for a Spanish device", async () => {
    await renderApp(createPort("", "es-MX"));
    await expectScreen("screen-menu");
    expect(screen.getByTestId("menu-heading")).toHaveTextContent("Elige un acertijo");
  });

  it("falls back to English for an unsupported language", async () => {
    await renderApp(createPort("", "xx-XX"));
    await expectScreen("screen-menu");
    expect(screen.getByTestId("menu-heading")).toHaveTextContent("Choose a puzzle");
  });
});
