import {afterEach, describe, expect, it} from "@jest/globals";
import {
  acquirePendingPlayLease, clearPendingGuessJournal, pendingPlayScope,
  readPendingGuessJournal, releasePendingPlayLease, writePendingGuessJournal,
  type PendingGuessJournal,
} from "../pendingGuessJournal";

/** The values used by this regression scenario. */
const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
}});

afterEach(() => values.clear());

/** The scope used by this regression scenario. */
const scope = pendingPlayScope("player-1", 2, "en");
/** The journal used by this regression scenario. */
const journal = (): PendingGuessJournal => ({
  version: 1, scope, confirmedClassicIndex: 4,
  riddle: {riddleId: "classic-4", text: "Clue", answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000001", gameMode: "classic",
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
    evaluation: {answer: "piano", locale: "en"}},
  base: {currentLetters: ["P", "I", "A", "N", "O"], activeSlotIndex: 0,
    guesses: [], engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    modal: null, lastOutcome: null, completionAcknowledged: false, letterStates: {}},
  successors: [],
  queue: [{message: {type: "game:submitGuess", requestId: "request-123",
    payload: {riddleId: "classic-4", gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001", guess: "PIANO", requestId: "request-123"}},
    attempts: 1, isCorrect: true, gameOver: true, canContinue: false,
    feedback: ["green", "green", "green", "green", "green"]}],
  draft: [],
});

describe("pending guess journal", () => {
  it("retains a confirmed hint behind answers and after the answer queue drains", () => {
    /** Journal with a paid request whose identity must survive a reload. */
    const pending = journal();
    pending.coinAction = {type: "game:requestHint", requestId: "hint-request-123", payload: {
      riddleId: pending.riddle.riddleId, gameMode: "classic", sessionToken: pending.riddle.sessionToken,
      requestId: "hint-request-123", currentAttempt: ["", "", "", "", ""],
    }};
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction).toEqual(pending.coinAction);
    pending.queue = [];
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction?.requestId).toBe("hint-request-123");
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 3, "en"))).toBeNull();
  });

  it("retains a continue choice behind the final unconfirmed answer", () => {
    /** Continue choice that must be delivered only after the earlier answer settles. */
    const pending = journal();
    pending.coinAction = {type: "game:spendCoins", requestId: "continue-request-123", payload: {
      reason: "continue", riddleId: pending.riddle.riddleId, gameMode: "classic",
      sessionToken: pending.riddle.sessionToken, amount: 100,
    }};
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction).toEqual(pending.coinAction);
  });

  it("rejects malformed persisted coin actions", () => {
    /** Corrupt action must not become a replayable paid request. */
    const pending = {...journal(), coinAction: {type: "game:requestHint", payload: {}}};
    values.set(`riddleQuest:pendingPlay:v1:${scope}`, JSON.stringify(pending));
    expect(readPendingGuessJournal(scope)).toBeNull();
  });

  it("restores exact requests only for the same identity generation and locale", () => {
    expect(writePendingGuessJournal(journal())).toBe(true);
    expect(readPendingGuessJournal(scope)?.queue[0].message.payload.requestId).toBe("request-123");
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 3, "en"))).toBeNull();
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 2, "fr"))).toBeNull();
    clearPendingGuessJournal(scope);
    expect(readPendingGuessJournal(scope)).toBeNull();
  });

  it("serializes delivery across tabs and permits recovery after lease expiry", () => {
    expect(acquirePendingPlayLease(scope, "tab-a", 1_000)).toBe(true);
    expect(acquirePendingPlayLease(scope, "tab-b", 2_000)).toBe(false);
    expect(acquirePendingPlayLease(scope, "tab-b", 16_001)).toBe(true);
    releasePendingPlayLease(scope, "tab-a");
    expect(acquirePendingPlayLease(scope, "tab-a", 16_002)).toBe(false);
    releasePendingPlayLease(scope, "tab-b");
    expect(acquirePendingPlayLease(scope, "tab-a", 16_003)).toBe(true);
  });
});
