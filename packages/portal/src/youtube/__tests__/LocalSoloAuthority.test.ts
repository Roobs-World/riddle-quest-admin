import type {YouTubeContent, YouTubeRiddle, YouTubeSavedGuess, YouTubeSaveV1} from "../../playable/types";
import {
  LocalSoloAuthority,
  YouTubeAuthorityError,
  YouTubeAuthorityRestoreSaveError,
} from "../../playable/LocalSoloAuthority";
import {
  YOUTUBE_SAVE_BUDGET_BYTES,
  createEmptyYouTubeSave,
  parseYouTubeSave,
  serializeYouTubeSave,
} from "../../playable/save";
import {YouTubeSaveGate} from "../../playable/YouTubeSaveGate";
/** Provides riddles behavior. */
const riddles: YouTubeRiddle[] = [
  {
    canonicalId: "riddle:rome",
    text: "Ancient city?",
    answer: "rome",
    categoryId: "history",
    difficultyBand: "easy",
    contentFingerprint: "0123456789abcdef",
  },
  {
    canonicalId: "riddle:moon",
    text: "Night light?",
    answer: "moon",
    categoryId: "science",
    difficultyBand: "easy",
    contentFingerprint: "abcdef0123456789",
  },
];
/** Provides content behavior. */
const content: YouTubeContent = {
  contentVersion: "content-v1",
  locale: "en",
  classicOrder: riddles.map(({canonicalId}) => canonicalId),
  daily: {
    scheduleVersion: 1,
    segments: [{startsOn: "2026-01-01", canonicalIds: riddles.map(({canonicalId}) => canonicalId)}],
  },
  riddles: new Map(riddles.map((riddle) => [riddle.canonicalId, riddle])),
};
/** Creates authority. */
const createAuthority = async (
  saveData: (data: string) => Promise<void> = async () => undefined,
  loaded: YouTubeSaveV1 = createEmptyYouTubeSave(content.contentVersion),
  now = () => new Date("2026-01-01T12:00:00.000Z"),
) => LocalSoloAuthority.restore(loaded, content, new YouTubeSaveGate({saveData}), now);
/** Creates near budget save. */
const createNearBudgetSave = (combiningMarks: number): YouTubeSaveV1 => {
  /** Provides save behavior. */
  const save = createEmptyYouTubeSave(content.contentVersion);
  /** Provides letter behavior. */
  const letter = `á${"\u0301".repeat(combiningMarks)}`;
  /** Provides guess behavior. */
  const guess: YouTubeSavedGuess = {
    letters: Array.from({length: 4}, () => letter),
    feedback: Array.from({length: 4}, () => "red" as const),
  };
  save.revision = 100;
  save.progression.totalGuesses = 5;
  save.progression.unlockedAchievementIds = Array.from({length: 64}, (_, index) => `${"a".repeat(195)}${index}`);
  save.activeGame = {
    sessionRevision: 1,
    mode: "classic",
    riddleId: "riddle:rome",
    contentFingerprint: "0123456789abcdef",
    hintRevealedIndices: [],
    guesses: Array.from({length: 5}, () => guess),
    attemptsUsed: 5,
    hasUsedContinue: false,
    awaitingContinue: true,
  };
  save.operationReceipts = Array.from({length: 63}, (_, index) => ({
    id: `${"b".repeat(195)}${index}`,
    revision: index + 1,
  }));
  return save;
};

describe("LocalSoloAuthority", () => {
  it.each([['classic', 'medium', 40], ['classic', 'hard', 60], ['daily', 'medium', 100], ['daily', 'hard', 125]] as const)(
    "uses bundled %s %s difficulty for the base reward", async (mode, difficultyBand, expectedCoins) => {
      const scaledContent = {...content, riddles: new Map(riddles.map((riddle) => [riddle.canonicalId, {...riddle, difficultyBand}]))};
      const saveData = jest.fn(async (_data: string) => undefined);
      const authority = await LocalSoloAuthority.restore(createEmptyYouTubeSave(content.contentVersion), scaledContent,
        new YouTubeSaveGate({saveData}), () => new Date("2026-01-01T12:00:00Z"));
      await authority.start(mode);
      authority.setInput(["r", "o", "m", "e"], 3);
      const result = await authority.submitGuess();
      // First perfect Classic/Daily wins grant 3/4 achievements, a level-up (50), and a Daily streak (20).
      expect(result?.coinsEarned).toBe(expectedCoins + 75 + 50 + (mode === "daily" ? 45 : 0));
      expect(authority.getSnapshot().save.progression.coins).toBe(300 + result!.coinsEarned);
      await expect(authority.submitGuess()).rejects.toBeDefined();
    });

  it("does not save empty defaults and gates every material Classic transition", async () => {
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await createAuthority(saveData);
    expect(saveData).not.toHaveBeenCalled();

    await authority.start("classic");
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(authority.getSnapshot().save.activeGame?.riddleId).toBe("riddle:rome");
    await expect(authority.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});

    authority.setInput(["r", "o", "m", "e"], 3);
    /** Provides result behavior. */
    const result = await authority.submitGuess();
    expect(result).toMatchObject({kind: "win", attempts: 1, coinsEarned: 150, xpEarned: 100});
    /** Provides snapshot behavior. */
    const snapshot = authority.getSnapshot();
    expect(snapshot.save.activeGame).toBeNull();
    expect(snapshot.save.progression).toMatchObject({coins: 450, xp: 100, level: 2, classicIndex: 1, totalWins: 1});
    expect(snapshot.save.progression.unlockedAchievementIds).toEqual(
      expect.arrayContaining(["first_win", "perfect_guess", "classic_perfect"]),
    );
    /** Provides persisted behavior. */
    const persisted = saveData.mock.calls[1]?.[0] ?? "";
    expect(persisted).not.toContain('"answer"');
    expect(persisted).not.toContain("rome");
  });

  it("evaluates coin achievements after base and level-up coins but before the achievement bonus", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.progression.coins = 930;
    loaded.progression.xp = 99;
    loaded.progression.level = 1;
    loaded.progression.unlockedAchievementIds = ["first_win", "perfect_guess", "classic_perfect"];
    /** Provides authority behavior. */
    const authority = await createAuthority(async () => undefined, loaded);

    await authority.start("classic");
    authority.setInput(["r", "o", "m", "e"], 3);
    /** Provides result behavior. */
    const result = await authority.submitGuess();

    expect(result).toMatchObject({
      kind: "win",
      coinsEarned: 100,
      newlyUnlockedAchievementIds: ["coin_hoarder"],
    });
    expect(authority.getSnapshot().save.progression).toMatchObject({
      coins: 1_030,
      xp: 199,
      level: 2,
    });
  });

  it("allows the next draft during a pending save while serializing submissions", async () => {
    /** Releases the deliberately delayed save. */
    let releaseSave = () => {};
    /** Simulates a slow platform save after starting play. */
    const saveData = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseSave = resolve;
          }),
      );
    /** Owns the local game and save transaction. */
    const authority = await createAuthority(saveData);
    await authority.start("classic");
    authority.setInput(["n", "o", "p", "e"], 3);
    /** Remains pending while the player sees feedback and drafts again. */
    const pending = authority.submitGuess();
    await Promise.resolve();
    await Promise.resolve();
    expect(authority.getSnapshot().save.activeGame?.guesses).toHaveLength(1);
    authority.setInput(["r", "", "", ""], 1);
    try {
      expect(authority.getSnapshot().displayLetters).toEqual(["r", "", "", ""]);
      await expect(authority.submitGuess()).rejects.toThrow("operation-pending");
    } finally {
      releaseSave();
      await pending;
    }
    expect(authority.getSnapshot().displayLetters).toEqual(["r", "", "", ""]);
  });

  it("retains an uncertain wrong-guess revision, freezes input, and retries exact bytes", async () => {
    /** Saves data. */
    const saveData = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    /** Provides authority behavior. */
    const authority = await createAuthority(saveData);
    await authority.start("classic");
    authority.setInput(["n", "o", "p", "e"], 3);
    await expect(authority.submitGuess()).rejects.toThrow("uncertain");
    expect(authority.getSnapshot()).toMatchObject({saveBlocked: true});
    /** Provides exact failed payload behavior. */
    const exactFailedPayload = saveData.mock.calls[1]?.[0];
    /** Provides staged letters behavior. */
    const stagedLetters = authority.getSnapshot().displayLetters;
    authority.setInput(["r", "o", "m", "e"], 3);
    expect(authority.getSnapshot().displayLetters).toEqual(stagedLetters);
    await authority.retryPendingSave();
    expect(saveData.mock.calls[2]?.[0]).toBe(exactFailedPayload);
    authority.setInput(["r", "o", "m", "e"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "win"});
  });

  it("persists hint, continue, and terminal loss economy without allowing locked-letter edits", async () => {
    /** Provides authority behavior. */
    const authority = await createAuthority();
    await authority.start("classic");
    await expect(authority.requestHint()).resolves.toContain("hint_user");
    expect(authority.getSnapshot().save.progression.coins).toBe(275);
    /** Provides hinted behavior. */
    const hinted = authority.getSnapshot().save.activeGame!;
    expect(authority.getSnapshot().displayLetters?.[hinted.hintRevealedIndices[0]]).toBe("r");
    authority.setInput(["x", "x", "x", "x"], 3);
    expect(authority.getSnapshot().displayLetters?.[hinted.hintRevealedIndices[0]]).toBe("r");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      authority.setInput(["r", "x", "x", "x"], 3);
      await authority.submitGuess();
    }
    expect(authority.getSnapshot().save.activeGame).toMatchObject({awaitingContinue: true, attemptsUsed: 5});
    await authority.buyContinue();
    expect(authority.getSnapshot().save.progression.coins).toBe(225);
    authority.setInput(["r", "x", "x", "x"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "loss", attempts: 6});
    expect(authority.getSnapshot().save).toMatchObject({activeGame: null, progression: {gamesPlayed: 1}});
  });

  it("reconstructs every hinted answer letter without serializing those letters", async () => {
    /** Provides persisted behavior. */
    const persisted: string[] = [];
    /** Provides authority behavior. */
    const authority = await createAuthority(async (data) => {
      persisted.push(data);
    });
    await authority.start("classic");
    for (let index = 0; index < 4; index += 1) await authority.requestHint();
    /** Provides snapshot behavior. */
    const snapshot = authority.getSnapshot();
    expect(snapshot.displayLetters?.join("")).toBe("rome");
    expect(snapshot.save.activeGame).not.toHaveProperty("currentLetters");
    /** Provides latest behavior. */
    const latest = JSON.parse(persisted.at(-1) ?? "null") as {
      /** Stores active game. */
      activeGame?: object;
    };
    expect(latest.activeGame).not.toHaveProperty("currentLetters");
  });

  it("awards Daily once per UTC date and computes the current streak", async () => {
    /** Provides now behavior. */
    const now = () => new Date("2026-01-01T23:59:59.000Z");
    /** Provides authority behavior. */
    const authority = await createAuthority(async () => undefined, createEmptyYouTubeSave(content.contentVersion), now);
    await authority.start("daily");
    authority.setInput(["r", "o", "m", "e"], 3);
    await expect(authority.submitGuess()).resolves.toMatchObject({kind: "win", mode: "daily"});
    /** Provides progress behavior. */
    const progress = authority.getSnapshot().save.progression;
    expect(progress).toMatchObject({
      lastDailyCompletedDate: "2026-01-01",
      currentDailyStreak: 1,
      dailyPuzzlesCompleted: 1,
    });
    authority.clearResult();
    await expect(authority.start("daily")).rejects.toMatchObject({code: "daily-already-complete"});
  });

  it("selects the latest immutable Daily segment without remapping earlier dates", async () => {
    /** Provides extended content behavior. */
    const extendedContent: YouTubeContent = {
      ...content,
      daily: {
        scheduleVersion: 2,
        segments: [content.daily.segments[0], {startsOn: "2026-01-03", canonicalIds: ["riddle:moon"]}],
      },
    };
    /** Provides before segment behavior. */
    const beforeSegment = await LocalSoloAuthority.restore(
      createEmptyYouTubeSave(content.contentVersion),
      extendedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
      () => new Date("2026-01-02T12:00:00.000Z"),
    );
    await beforeSegment.start("daily");
    expect(beforeSegment.getSnapshot().save.activeGame?.riddleId).toBe("riddle:moon");
    /** Provides on new segment behavior. */
    const onNewSegment = await LocalSoloAuthority.restore(
      createEmptyYouTubeSave(content.contentVersion),
      extendedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
      () => new Date("2026-01-03T12:00:00.000Z"),
    );
    await onNewSegment.start("daily");
    expect(onNewSegment.getSnapshot().save.activeGame?.riddleId).toBe("riddle:moon");
  });

  it("drops only an active puzzle whose fingerprint changed and commits the recovery", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave("older-content");
    loaded.revision = 3;
    loaded.progression.coins = 777;
    loaded.activeGame = {
      sessionRevision: 2,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "ffffffffffffffff",
      hintRevealedIndices: [],
      guesses: [],
      attemptsUsed: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await createAuthority(saveData, loaded);
    /** Provides snapshot behavior. */
    const snapshot = authority.getSnapshot();
    expect(snapshot.recoveryNotice).toBe(true);
    expect(snapshot.save.activeGame).toBeNull();
    expect(snapshot.save.progression.coins).toBe(777);
    expect(snapshot.save.contentVersion).toBe("content-v1");
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("drops active riddles that do not match Classic progression or the immutable Daily schedule", async () => {
    for (const activeGame of [
      {
        sessionRevision: 2,
        mode: "classic" as const,
        riddleId: "riddle:moon",
        contentFingerprint: "abcdef0123456789",
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      },
      {
        sessionRevision: 2,
        mode: "daily" as const,
        riddleId: "riddle:moon",
        contentFingerprint: "abcdef0123456789",
        dailyDate: "2026-01-01",
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      },
    ]) {
      /** Loads ed. */
      const loaded = createEmptyYouTubeSave(content.contentVersion);
      loaded.revision = 2;
      loaded.progression.coins = 777;
      loaded.activeGame = activeGame;
      /** Saves data. */
      const saveData = jest.fn(async (_data: string) => undefined);
      /** Provides authority behavior. */
      const authority = await createAuthority(saveData, loaded);
      expect(authority.getSnapshot()).toMatchObject({
        recoveryNotice: true,
        save: {activeGame: null, progression: {coins: 777}, revision: 3},
      });
      expect(saveData).toHaveBeenCalledTimes(1);
    }
  });

  it("retains the exact sanitized recovery revision when its startup save is uncertain", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave("older-content");
    loaded.revision = 3;
    loaded.progression.coins = 777;
    /** Saves data. */
    const saveData = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValueOnce(undefined);
    /** Provides blocked behavior. */
    let blocked: YouTubeAuthorityRestoreSaveError | null = null;
    try {
      await createAuthority(saveData, loaded);
    } catch (error) {
      if (error instanceof YouTubeAuthorityRestoreSaveError) blocked = error;
      else throw error;
    }
    expect(blocked).not.toBeNull();
    /** Provides exact payload behavior. */
    const exactPayload = saveData.mock.calls[0]?.[0];
    await blocked!.authority.retryPendingSave();
    expect(saveData.mock.calls[1]?.[0]).toBe(exactPayload);
    expect(blocked!.authority.getSnapshot().save).toMatchObject({
      contentVersion: "content-v1",
      progression: {coins: 777},
      revision: 4,
    });
  });

  it("commits an explicit schema migration before restored play becomes available", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await LocalSoloAuthority.restore(
      loaded,
      content,
      new YouTubeSaveGate({saveData}),
      undefined,
      false,
      true,
    );
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saveData.mock.calls[0]?.[0] ?? "null")).toMatchObject({schemaVersion: 1, revision: 1});
    expect(authority.getSnapshot().save.revision).toBe(1);
  });

  it("resumes an unfinished Daily across UTC midnight to preserve the global mode lock", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.revision = 7;
    loaded.progression.coins = 888;
    loaded.activeGame = {
      sessionRevision: 6,
      mode: "daily",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      dailyDate: "2026-01-01",
      hintRevealedIndices: [],
      guesses: [],
      attemptsUsed: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await LocalSoloAuthority.restore(
      loaded,
      content,
      new YouTubeSaveGate({saveData}),
      () => new Date("2026-01-02T12:00:00.000Z"),
    );
    expect(authority.getSnapshot()).toMatchObject({
      recoveryNotice: false,
      save: {activeGame: {dailyDate: "2026-01-01"}, progression: {coins: 888}, revision: 7},
    });
    expect(saveData).not.toHaveBeenCalled();
    await expect(authority.start("classic")).rejects.toMatchObject({code: "active-game-must-resume"});
  });

  it("keeps the canonical active puzzle locked across an SDK-language change", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.revision = 7;
    loaded.activeGame = {
      sessionRevision: 6,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      hintRevealedIndices: [3],
      guesses: [{letters: ["n", "o", "p", "e"], feedback: ["red", "green", "red", "green"]}],
      attemptsUsed: 1,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    /** Provides localized riddle behavior. */
    const localizedRiddle: YouTubeRiddle = {
      ...riddles[0],
      text: "Quelle ville ancienne ?",
      answer: "astre",
      // Save-facing fingerprints are canonical and therefore identical in every locale.
      contentFingerprint: "0123456789abcdef",
    };
    /** Provides localized content behavior. */
    const localizedContent: YouTubeContent = {
      ...content,
      locale: "fr",
      riddles: new Map([
        [localizedRiddle.canonicalId, localizedRiddle],
        [riddles[1].canonicalId, {...riddles[1], text: "Lumière nocturne ?", answer: "astre"}],
      ]),
    };
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await LocalSoloAuthority.restore(loaded, localizedContent, new YouTubeSaveGate({saveData}));

    expect(authority.getSnapshot()).toMatchObject({
      recoveryNotice: false,
      save: {
        revision: 7,
        activeGame: {riddleId: "riddle:rome", attemptsUsed: 1, hintRevealedIndices: [3]},
      },
    });
    expect(authority.getSnapshot().displayLetters).toEqual(["", "", "", "r", ""]);
    expect(saveData).not.toHaveBeenCalled();
    await expect(authority.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});

    authority.setInput(["c", "h", "i", "r", "n"], 4);
    await expect(authority.submitGuess()).resolves.toBeNull();
    /** Serializes d. */
    const serialized = saveData.mock.calls[0]?.[0] ?? "";
    /** Parses d. */
    const parsed = parseYouTubeSave(serialized, localizedContent.contentVersion);
    expect(parsed.kind).toBe("valid");
    if (parsed.kind !== "valid") throw new Error(`cross-locale-save-invalid:${parsed.kind}`);
    expect(parsed.save.activeGame?.guesses.map(({letters}) => letters.length)).toEqual([4, 5]);
    /** Provides reloaded behavior. */
    const reloaded = await LocalSoloAuthority.restore(
      parsed.save,
      localizedContent,
      new YouTubeSaveGate({saveData: async () => undefined}),
    );
    expect(reloaded.getSnapshot().save.activeGame?.riddleId).toBe("riddle:rome");
    await expect(reloaded.start("daily")).rejects.toMatchObject({code: "active-game-must-resume"});
  });

  it("does not allow a device-clock rollback to replay a completed Daily", async () => {
    /** Loads ed. */
    const loaded = createEmptyYouTubeSave(content.contentVersion);
    loaded.progression.lastDailyCompletedDate = "2026-01-02";
    /** Provides authority behavior. */
    const authority = await createAuthority(
      async () => undefined,
      loaded,
      () => new Date("2026-01-01T12:00:00.000Z"),
    );
    await expect(authority.start("daily")).rejects.toMatchObject({code: "daily-already-complete"});
  });

  it("blocks mutation while paused", async () => {
    /** Provides authority behavior. */
    const authority = await createAuthority();
    authority.setPaused(true);
    await expect(authority.start("classic")).rejects.toEqual(new YouTubeAuthorityError("game-paused"));
  });

  it("durably applies accessibility and guidance preferences", async () => {
    /** Provides persisted behavior. */
    const persisted: string[] = [];
    /** Provides authority behavior. */
    const authority = await createAuthority(async (data) => {
      persisted.push(data);
    });
    await authority.setAccessibilityPreference("reducedMotion", true);
    await authority.setAccessibilityPreference("highContrast", true);
    await authority.completeGuidance();
    expect(authority.getSnapshot().save.preferences).toEqual({
      reducedMotion: true,
      highContrast: true,
      guidanceComplete: true,
    });
    expect(JSON.parse(persisted.at(-1) ?? "null")).toMatchObject({
      preferences: {reducedMotion: true, highContrast: true, guidanceComplete: true},
    });
  });

  it("stages serialization before publishing a near-budget material mutation", async () => {
    /** Loads ed. */
    const loaded = createNearBudgetSave(150);
    /** Provides raw behavior. */
    const raw = serializeYouTubeSave(loaded);
    expect(raw.length * 2).toBeLessThan(YOUTUBE_SAVE_BUDGET_BYTES);
    /** Parses d. */
    const parsed = parseYouTubeSave(raw, content.contentVersion);
    if (parsed.kind !== "valid") {
      throw new Error(`near-budget-save-invalid:${parsed.kind === "invalid" ? parsed.reason : parsed.kind}`);
    }
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    /** Provides authority behavior. */
    const authority = await createAuthority(saveData, parsed.save);
    /** Provides before behavior. */
    const before = authority.getSnapshot().save;

    await expect(authority.buyContinue()).rejects.toThrow("youtube-save-budget-exceeded");
    expect(authority.getSnapshot()).toMatchObject({
      busy: false,
      saveBlocked: false,
      save: {
        revision: before.revision,
        progression: {coins: before.progression.coins},
        activeGame: {
          awaitingContinue: true,
          hasUsedContinue: false,
        },
      },
    });
    expect(saveData).not.toHaveBeenCalled();
  });

  it("blocks startup when a prerelease migration cannot be serialized within budget", async () => {
    /** Provides migrated behavior. */
    const migrated = createNearBudgetSave(151);
    /** Provides {preferences:  preferences, ...legacy} behavior. */
    const {preferences: _preferences, ...legacy} = migrated;
    /** Provides raw behavior. */
    const raw = JSON.stringify({...legacy, schemaVersion: 0});
    expect(raw.length * 2).toBeLessThan(YOUTUBE_SAVE_BUDGET_BYTES);
    /** Parses d. */
    const parsed = parseYouTubeSave(raw, content.contentVersion);
    if (parsed.kind !== "valid") {
      throw new Error(`near-budget-migration-invalid:${parsed.kind === "invalid" ? parsed.reason : parsed.kind}`);
    }
    /** Saves data. */
    const saveData = jest.fn(async (_data: string) => undefined);
    await expect(
      LocalSoloAuthority.restore(parsed.save, content, new YouTubeSaveGate({saveData}), undefined, false, true),
    ).rejects.toThrow("youtube-save-budget-exceeded");
    expect(saveData).not.toHaveBeenCalled();
  });
});
