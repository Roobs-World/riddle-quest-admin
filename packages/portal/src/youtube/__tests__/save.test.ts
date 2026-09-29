import {
  YOUTUBE_SAVE_BUDGET_BYTES,
  appendYouTubeReceipt,
  createEmptyYouTubeSave,
  parseYouTubeSave,
  serializeYouTubeSave,
} from "../../playable/save";

describe("YouTubeSaveV1", () => {
  it("creates 300-coin target-local defaults only after an empty successful load", () => {
    /** Parses d. */
    const parsed = parseYouTubeSave("", "content-v1");
    expect(parsed.kind).toBe("empty");
    if (parsed.kind !== "empty") throw new Error("unexpected parse result");
    expect(parsed.save.progression).toMatchObject({coins: 300, xp: 0, level: 1, classicIndex: 0});
    expect(parsed.save.activeGame).toBeNull();
  });

  it("round-trips the exact strict schema and rejects PII/answer extensions", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;
    appendYouTubeReceipt(save, "start:classic:0:1");
    /** Parses d. */
    const parsed = parseYouTubeSave(serializeYouTubeSave(save), "content-v1");
    expect(parsed).toEqual({kind: "valid", save});

    expect(parseYouTubeSave(JSON.stringify({...save, email: "person@example.test"}), "content-v1")).toMatchObject({
      kind: "invalid",
    });
    expect(parseYouTubeSave(JSON.stringify({...save, answer: "rome"}), "content-v1")).toMatchObject({kind: "invalid"});
  });

  it("preserves malformed and future data for explicit destructive reset", () => {
    expect(parseYouTubeSave("not-json", "content-v1")).toEqual({
      kind: "invalid",
      reason: "save-json-invalid",
      raw: "not-json",
    });
    expect(() =>
      parseYouTubeSave(
        JSON.stringify({
          ...createEmptyYouTubeSave("content-v1"),
          progression: {...createEmptyYouTubeSave("content-v1").progression, lastDailyCompletedDate: "2026-99-99"},
        }),
        "content-v1",
      ),
    ).not.toThrow();
    expect(
      parseYouTubeSave(
        JSON.stringify({
          ...createEmptyYouTubeSave("content-v1"),
          progression: {...createEmptyYouTubeSave("content-v1").progression, lastDailyCompletedDate: "2026-99-99"},
        }),
        "content-v1",
      ),
    ).toMatchObject({kind: "invalid", reason: "save-state-invalid"});
    /** Provides future behavior. */
    const future = JSON.stringify({schemaVersion: 2, secretFutureField: true});
    expect(parseYouTubeSave(future, "content-v1")).toEqual({kind: "future-version", schemaVersion: 2, raw: future});
  });

  it("migrates the bounded prerelease v0 envelope through the explicit v0 path", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    /** Provides {preferences:  preferences, ...legacy} behavior. */
    const {preferences: _preferences, ...legacy} = save;
    /** Parses d. */
    const parsed = parseYouTubeSave(JSON.stringify({...legacy, schemaVersion: 0}), "content-v1");
    expect(parsed).toEqual({
      kind: "valid",
      migratedFromSchemaVersion: 0,
      save: {...save, preferences: {reducedMotion: false, highContrast: false, guidanceComplete: false}},
    });
  });

  it("preserves valid progression while sanitizing only malformed active-puzzle state", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 4;
    save.progression.coins = 777;
    /** Provides raw behavior. */
    const raw = JSON.stringify({...save, activeGame: {mode: "classic", answer: "must-not-survive"}});
    expect(parseYouTubeSave(raw, "content-v1")).toEqual({
      kind: "valid",
      recoveredActiveGame: true,
      save: {...save, activeGame: null},
    });
  });

  it("sanitizes deprecated draft fields rather than admitting answer text", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;
    save.activeGame = {
      sessionRevision: 1,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      hintRevealedIndices: [0],
      guesses: [],
      attemptsUsed: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    /** Provides raw behavior. */
    const raw = JSON.stringify({
      ...save,
      activeGame: {...save.activeGame, currentLetters: ["r", "", "", ""], activeSlotIndex: 1},
    });
    expect(parseYouTubeSave(raw, "content-v1")).toMatchObject({
      kind: "valid",
      recoveredActiveGame: true,
      save: {activeGame: null},
    });
  });

  it("drops active records with impossible attempt or revision states", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 5;
    /** Provides guess behavior. */
    const guess = {letters: ["n", "o", "p", "e"], feedback: ["red", "green", "red", "green"]};
    /** Provides active behavior. */
    const active = {
      sessionRevision: 1,
      mode: "classic",
      riddleId: "riddle:rome",
      contentFingerprint: "0123456789abcdef",
      hintRevealedIndices: [],
      guesses: Array.from({length: 5}, () => guess),
      attemptsUsed: 5,
      hasUsedContinue: false,
      awaitingContinue: false,
    };
    for (const invalidActive of [
      active,
      {...active, guesses: [...active.guesses, guess], attemptsUsed: 6, hasUsedContinue: true},
      {...active, sessionRevision: 6, hasUsedContinue: true},
    ]) {
      expect(parseYouTubeSave(JSON.stringify({...save, activeGame: invalidActive}), "content-v1")).toMatchObject({
        kind: "valid",
        recoveredActiveGame: true,
        save: {activeGame: null},
      });
    }
    expect(
      parseYouTubeSave(
        JSON.stringify({
          ...save,
          activeGame: {...active, hasUsedContinue: true},
        }),
        "content-v1",
      ),
    ).toMatchObject({kind: "valid", save: {activeGame: {attemptsUsed: 5, hasUsedContinue: true}}});
  });

  it("enforces the conservative limit in UTF-16 bytes even when UTF-8 would pass", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.contentVersion = "a".repeat(31_000);
    /** Provides raw behavior. */
    const raw = JSON.stringify(save);
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThan(YOUTUBE_SAVE_BUDGET_BYTES);
    expect(raw.length * 2).toBeGreaterThanOrEqual(YOUTUBE_SAVE_BUDGET_BYTES);
    expect(() => serializeYouTubeSave(save)).toThrow("youtube-save-budget-exceeded");
    expect(parseYouTubeSave(raw, "content-v1")).toMatchObject({kind: "invalid", reason: "save-too-large"});
  });

  it("bounds replay receipts", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    for (let index = 1; index <= 70; index += 1) {
      save.revision = index;
      appendYouTubeReceipt(save, `operation:${index}`);
    }
    expect(save.operationReceipts).toHaveLength(64);
    expect(save.operationReceipts[0]?.id).toBe("operation:7");
  });

  it("round-trips unlocked achievement identifiers without treating array indices as ID limits", () => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.progression.unlockedAchievementIds = ["first_win", "classic_perfect"];
    expect(parseYouTubeSave(serializeYouTubeSave(save), "content-v1")).toEqual({kind: "valid", save});
  });
});
