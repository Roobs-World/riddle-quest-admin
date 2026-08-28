import {GameEngine} from "../GameEngine";

describe("GameEngine", () => {
  /** Provides config behavior. */
  const config = {answer: "hello", initialAttempts: 5, continueAttempts: 3};

  it("returns win outcome on correct guess", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config);
    /** Provides outcome behavior. */
    const outcome = engine.submitGuess(["h", "e", "l", "l", "o"]);
    expect(outcome).toMatchObject({kind: "win", attempts: 1});
    expect(engine.isGameOver()).toBe(true);
  });

  it("returns continue while attempts remain", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config);
    /** Provides outcome behavior. */
    const outcome = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(outcome).toMatchObject({kind: "continue", attemptsRemaining: 4});
    expect(engine.isGameOver()).toBe(false);
  });

  it("offers continue at first attempt limit", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config);
    for (let i = 0; i < 5; i++) {
      engine.submitGuess(["w", "o", "r", "l", "d"]);
    }
    /** Provides last behavior. */
    const last = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(last).toMatchObject({kind: "attemptLimitReached", canOfferContinue: true});
    expect(engine.isGameOver()).toBe(false);
  });

  it("resets grid after continue and ends in loss", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config);
    for (let i = 0; i < 5; i++) {
      engine.submitGuess(["w", "o", "r", "l", "d"]);
    }
    engine.continueAfterLimit();
    expect(engine.getSnapshot().guesses).toHaveLength(0);
    expect(engine.getSnapshot().attemptsUsed).toBe(5);
    for (let i = 0; i < 2; i++) {
      engine.submitGuess(["w", "o", "r", "l", "d"]);
    }
    /** Provides loss behavior. */
    const loss = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(loss).toMatchObject({kind: "loss"});
    expect(engine.isGameOver()).toBe(true);
  });

  it("restores, snapshots, and resets complete engine state", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config);
    engine.restore({
      guesses: [{guess: ["w", "o", "r", "l", "d"], feedback: ["red", "red", "red", "green", "red"]}],
      attemptsUsed: 2,
      hasUsedContinue: true,
      gameOver: true,
    });

    expect(engine.getSnapshot()).toMatchObject({attemptsUsed: 2, hasUsedContinue: true, gameOver: true});
    expect(engine.getMaxAttempts()).toBe(8);
    expect(engine.submitGuess(["h", "e", "l", "l", "o"])).toBeNull();

    engine.reset();
    expect(engine.getSnapshot()).toEqual({guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false});
    expect(engine.getMaxAttempts()).toBe(5);
  });

  it("supports an explicit answer override", () => {
    /** Provides engine behavior. */
    const engine = new GameEngine(config, "world");
    expect(engine.submitGuess(["w", "o", "r", "l", "d"])).toMatchObject({kind: "win"});
  });
});
