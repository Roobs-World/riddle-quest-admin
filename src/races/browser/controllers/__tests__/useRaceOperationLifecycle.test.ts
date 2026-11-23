import {describe, expect, it} from "@jest/globals";
import {RACE_RULES, type RaceRunView, type SubmitRaceGuessResponse} from "../../../contracts/index";
import type {GameToHostMessage} from "../../../../platform/bridge/messages";
import {RacePlay} from "../RacePlay";
/** Complete deck and authoritative run for deterministic reconciliation scenarios. */
const run = (): RaceRunView => {
  /** Provides preloaded riddles behavior. */
  const preloadedRiddles = Array.from({length: RACE_RULES.deckSize}, (_, position) => ({
    riddleId: `riddle-${position}`,
    text: `Clue ${position}`,
    answerLength: 4,
    position,
    evaluation: {answer: "test", locale: "en" as const},
  }));
  return {
    runId: "run-1",
    challengeId: "challenge-1",
    role: "challenger",
    status: "active",
    categoryId: "mixed",
    locale: "en",
    rules: RACE_RULES,
    correctCount: 0,
    wallElapsedMs: 100,
    adjustedElapsedMs: 100,
    totalPenaltyMs: 0,
    currentRiddle: {
      ...preloadedRiddles[0],
      guessesUsed: 0,
      guessesRemaining: 5,
      hintAvailable: true,
      revealedLetters: [],
    },
    preloadedRiddles,
    events: [],
    opponent: {displayName: "Ava", adjustedFinishMs: 3000, events: []},
  };
};
/** Time and command adapters exercise the module interface without mocking React internals. */
const harness = () => {
  /** Provides now behavior. */
  let now = 0,
    id = 0;
  /** Provides timers behavior. */
  const timers = new Map<
    number,
    {
      /** Stores at. */
      at: number;
      /** Stores callback. */
      callback: () => void;
    }
  >();
  /** Provides commands behavior. */
  const commands: GameToHostMessage[] = [];
  /** Provides play behavior. */
  const play = new RacePlay({
    postToHost: (message) => commands.push(message),
    requestId: (operation) => `${operation}-${++id}`,
    clock: {
      now: () => now,
      schedule: (callback, delay) => {
        /** Provides timer behavior. */
        const timer = ++id;
        timers.set(timer, {at: now + delay, callback});
        return timer;
      },
      cancel: (timer) => {
        timers.delete(timer);
      },
    },
  });
  return {
    play,
    commands,
    timers,
    advance: (elapsed: number) => {
      now += elapsed;
      for (const [id, timer] of timers)
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
    },
  };
};

it("projects Turkish dotted and dotless guesses using the same locale as authoritative scoring", () => {
  /** Authored Turkish deck keeps casing semantics fixed throughout the projected transition. */
  const original = run();
  original.locale = "tr";
  original.preloadedRiddles = original.preloadedRiddles!.map(prompt => ({...prompt, answerLength: 1,
    evaluation: {answer: "ı", locale: "tr"}}));
  original.currentRiddle = {...original.currentRiddle!, answerLength: 1, evaluation: {answer: "ı", locale: "tr"}};
  /** The real private gameplay module must advance immediately for locale-equivalent input. */
  const correct = harness().play.projectGuess(original, ["I"], [], 0)!;
  expect(correct.run).toMatchObject({correctCount: 1, currentRiddle: {position: 1}});
  /** A distinct dotted letter remains wrong under the same immutable locale. */
  const wrong = harness().play.projectGuess(original, ["İ"], [], 0)!;
  expect(wrong.run).toBeNull();
  expect(wrong.guesses).toEqual([{guess: ["İ"], feedback: ["red"]}]);
});
/** Provides confirm behavior. */
const confirm = (next: RaceRunView): SubmitRaceGuessResponse => ({
  run: next,
  isCorrect: true,
  autoSkipped: false,
  feedback: [..."test"].map((letter) => ({letter, status: "green"})),
});

describe("Race play module", () => {
  it("handles unavailable projections and reconciles an unprojected receipt", () => {
    /** Provides {play} behavior. */
    const {play} = harness();
    /** Provides original behavior. */
    const original = run();
    /** Provides unavailable behavior. */
    const unavailable = {...original, currentRiddle: null};
    expect(play.projectGuess(unavailable, [..."test"], [], 0)).toBeNull();
    expect(play.projectPaid("raceHint", unavailable)).toBeNull();
    expect(play.projectPaid("raceSkip", unavailable)).toBeNull();
    expect(play.acceptResponse(undefined, "raceGuess")).toBe(false);
    expect(play.confirmGuess(confirm(original), original, [], [..."test"])).toEqual({
      resetAttempt: true,
      guesses: [{guess: [..."test"], feedback: ["green", "green", "green", "green"]}],
    });
    // Without a checkpoint or current run, there is no submitted question to acknowledge.
    expect(() => play.confirmGuess(confirm(original), null, [], [..."test"])).toThrow("Missing submitted question");
    expect(play.canPublish(null)).toBe(false);
    play.dispose();
  });
  it("rolls back a wrong guess and retains unmatched paid checkpoints", () => {
    /** Provides {play} behavior. */
    const {play} = harness();
    /** Provides original behavior. */
    const original = run();
    /** Provides projection behavior. */
    const projection = play.projectGuess(original, [..."nope"], [], 0)!;
    expect(projection.feedback).toBe("incorrect");
    expect(projection.run).toBeNull();
    expect(play.rejectProjection("raceGuess")).toEqual({kind: "guess", draftEdited: false, draftRun: original, run: null, guesses: [], letters: [..."nope"], receivedAt: 0});
    play.projectPaid("raceHint", original);
    play.confirmPaid("raceSkip");
    expect(play.rejectProjection("raceSkip")).toBeNull();
    expect(play.canPublish({...original, status: "completed"})).toBe(false);
    expect(play.rejectProjection("raceHint")?.run).toEqual(original);
  });
  it("uses the browser clock and cancels its scheduled work", () => {
    /** Provides original window behavior. */
    const originalWindow = globalThis.window;
    /** Provides callbacks behavior. */
    const callbacks = new Map<number, () => void>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: (callback: () => void) => {
          callbacks.set(1, callback);
          return 1;
        },
        clearTimeout: (id: number) => {
          callbacks.delete(id);
        },
      },
    });
    try {
      /** Provides play behavior. */
      const play = new RacePlay({postToHost: () => undefined});
      play.send("raceGuess", "game:submitRaceGuess", {});
      play.finish("raceGuess");
      expect(callbacks.size).toBe(1);
      play.dispose();
      expect(callbacks.size).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
    }
  });
  it("uses exact operation/request receipts and consumes duplicates", () => {
    /** Provides {play,commands} behavior. */
    const {play, commands} = harness();
    play.send("raceHint", "game:requestRaceHint", {runId: "run-1"});
    expect(commands[0].payload).toMatchObject({requestId: commands[0].requestId});
    expect(play.acceptResponse("stale", "raceHint")).toBe(false);
    expect(play.acceptResponse(commands[0].requestId, "raceSkip")).toBe(false);
    expect(play.acceptResponse(commands[0].requestId, "raceHint")).toBe(true);
    expect(play.acceptResponse(commands[0].requestId, "raceHint")).toBe(false);
    play.send("raceInbox", "game:listRaceInbox", {limit: 20});
    expect(commands[1].payload).toEqual({limit: 20});
    play.send("raceAbandon", "game:abandonRace", {runId: "run-1"});
    play.finish("raceHint");
    expect(play.getSnapshot().pending).toBe("raceAbandon");
  });
  it("retains the loader for 180ms and carries it across authoritative outcome loading", () => {
    /** Provides h behavior. */
    const h = harness();
    /** Provides notifications behavior. */
    let notifications = 0;
    /** Provides unsubscribe behavior. */
    const unsubscribe = h.play.subscribe(() => notifications++);
    h.play.send("raceGuess", "game:submitRaceGuess", {});
    h.advance(40);
    h.play.finish("raceGuess");
    h.advance(139);
    expect(h.play.getSnapshot().raceGuessLoading).toBe(true);
    h.advance(1);
    expect(h.play.getSnapshot().raceGuessLoading).toBe(false);
    h.play.send("raceGuess", "game:submitRaceGuess", {});
    h.play.setAwaitingOutcome(true);
    h.play.finish("raceGuess");
    h.advance(500);
    expect(h.play.getSnapshot().raceGuessLoading).toBe(true);
    h.play.send("raceOutcome", "game:getRaceOutcome", {});
    h.play.finish("raceOutcome");
    h.advance(0);
    expect(h.play.getSnapshot().raceGuessLoading).toBe(false);
    expect(notifications).toBeGreaterThan(0);
    unsubscribe();
    h.play.send("raceGuess", "game:submitRaceGuess", {});
    h.play.finish("raceGuess");
    h.play.send("raceGuess", "game:submitRaceGuess", {});
    expect(h.timers.size).toBe(0);
    h.play.finish("raceGuess");
    h.play.dispose();
    expect(h.timers.size).toBe(0);
  });
  it("restores the prior clue, submitted answer and history after typing into a projected successor", () => {
    /** Provides {play} behavior. */
    const {play} = harness();
    /** Provides original behavior. */
    const original = run();
    /** Provides projection behavior. */
    const projection = play.projectGuess(original, [..."test"], [], 0)!;
    expect(projection.run?.currentRiddle?.riddleId).toBe("riddle-1");
    expect(play.typingWhilePending).toBe(true);
    /** Provides next draft behavior. */
    const nextDraft = [..."next"];
    expect(nextDraft).toHaveLength(4);
    expect(play.rejectProjection("raceGuess")).toEqual({
      kind: "guess",
      draftEdited: false,
      draftRun: original,
      run: original,
      guesses: [],
      letters: [..."test"],
      receivedAt: 0,
    });
    expect(play.typingWhilePending).toBe(false);
    expect(play.rejectProjection("raceGuess")).toBeNull();
  });
  it("confirmation preserves next-question input and malformed paid actions restore their own checkpoint", () => {
    /** Provides {play} behavior. */
    const {play} = harness();
    /** Provides original behavior. */
    const original = run();
    /** Provides projection behavior. */
    const projection = play.projectGuess(original, [..."test"], [], 0)!;
    expect(play.confirmGuess(confirm(projection.run!), projection.run, [], [..."next"])).toEqual({
      resetAttempt: false,
      guesses: null,
    });
    expect(play.typingWhilePending).toBe(false);
    for (const operation of ["raceHint", "raceSkip"] as const) {
      expect(play.projectPaid(operation, original)).not.toBeNull();
      expect(play.rejectProjection(operation)).toEqual({kind: "paid", run: original, receivedAt: 0, guesses: null, letters: null});
      play.projectPaid(operation, original);
      play.confirmPaid(operation);
      expect(play.rejectProjection(operation)).toBeNull();
    }
  });
  it("retains solving time and the original receipt anchor through paid projection and rejection", () => {
    for (const operation of ["raceHint", "raceSkip"] as const) {
      /** Independent run and monotonic clock for each paid action. */
      const h = harness();
      /** Authoritative view before any elapsed local solving time. */
      const original = run();
      h.advance(5_000);
      /** Projection at the time of the player's action. */
      const projected = h.play.projectPaid(operation, original, 0)!;
      expect(projected.wallElapsedMs).toBe(5_100);
      expect(projected.adjustedElapsedMs).toBe(5_100 + projected.totalPenaltyMs);
      h.advance(400);
      /** Authority rejection restores both the view and its clock anchor. */
      const rollback = h.play.rejectProjection(operation)!;
      expect(rollback.run).toEqual(original);
      expect(rollback.run).not.toBe(original);
      expect(rollback.receivedAt).toBe(0);
    }
  });
  it("rejects mismatched run confirmations while preserving the checkpoint for rollback", () => {
    /** Projection owner and original authoritative view. */
    const {play} = harness();
    /** Authoritative checkpoint retained after rejecting another run's receipt. */
    const original = run();
    play.projectGuess(original, [..."test"], [], 0);
    expect(() => play.confirmGuess(confirm({...original, runId: "other-run"}), original, [], []))
      .toThrow("different race run");
    expect(play.rejectProjection("raceGuess")?.run).toEqual(original);
    for (const operation of ["raceHint", "raceSkip"] as const) {
      play.projectPaid(operation, original, 0);
      expect(() => play.confirmPaid(operation, {...original, runId: "other-run"})).toThrow("different race run");
      expect(play.rejectProjection(operation)?.run).toEqual(original);
    }
  });
  it("invalidates receipts, projections and loaders on teardown and permits a fresh mount", () => {
    /** Delivery owner retaining a receipt from the closing race. */
    const {play, commands, timers} = harness();
    play.projectGuess(run(), [..."test"], [], 0);
    play.send("raceGuess", "game:submitRaceGuess", {runId: "run-1"});
    play.finish("raceGuess");
    play.dispose();
    expect(play.acceptResponse(commands[0].requestId, "raceGuess")).toBe(false);
    expect(play.typingWhilePending).toBe(false);
    expect(play.getSnapshot()).toEqual({pending: null, raceGuessLoading: false});
    expect(timers.size).toBe(0);
    expect(play.rejectProjection("raceGuess")).toBeNull();
    play.send("raceInbox", "game:listRaceInbox", {limit: 20});
    expect(play.acceptResponse(commands[1].requestId, "raceInbox")).toBe(true);
  });
  it("defers ghost/deadline results during mutation and publication until authoritative completion", () => {
    /** Provides {play} behavior. */
    const {play} = harness();
    /** Provides original behavior. */
    const original = run();
    play.send("raceGuess", "game:submitRaceGuess", {});
    expect(play.projectOutcome(original, RACE_RULES.maxAdjustedTimeMs)).toBeNull();
    expect(play.canPublish(original)).toBe(false);
    play.finish("raceGuess");
    expect(play.projectOutcome(original, RACE_RULES.maxAdjustedTimeMs)).not.toBeNull();
    /** Provides completed behavior. */
    const completed = {...original, status: "completed" as const, currentRiddle: null};
    expect(play.canPublish(completed)).toBe(true);
    play.projectGuess(original, [..."test"], [], 0);
    expect(play.canPublish(completed)).toBe(false);
  });
});
