import {GameEngine} from "../GameEngine";

describe("GameEngine", () => {
  const config = {answer: "hello", initialAttempts: 5, continueAttempts: 3};

  it("returns win outcome on correct guess", () => {
    const engine = new GameEngine(config);
    const outcome = engine.submitGuess(["h", "e", "l", "l", "o"]);
    expect(outcome).toMatchObject({kind: "win", attempts: 1});
    expect(engine.isGameOver()).toBe(true);
  });

  it("returns continue while attempts remain", () => {
    const engine = new GameEngine(config);
    const outcome = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(outcome).toMatchObject({kind: "continue", attemptsRemaining: 4});
    expect(engine.isGameOver()).toBe(false);
  });

  it("offers continue at first attempt limit", () => {
    const engine = new GameEngine(config);
    for (let i = 0; i < 5; i++) {
      engine.submitGuess(["w", "o", "r", "l", "d"]);
    }
    const last = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(last).toMatchObject({kind: "attemptLimitReached", canOfferContinue: true});
    expect(engine.isGameOver()).toBe(false);
  });

  it("resets grid after continue and ends in loss", () => {
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
    const loss = engine.submitGuess(["w", "o", "r", "l", "d"]);
    expect(loss).toMatchObject({kind: "loss"});
    expect(engine.isGameOver()).toBe(true);
  });
});
