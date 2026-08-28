import {HttpsError} from "firebase-functions/v2/https";
import {transitionSinglePlayerGuess, type SinglePlayerSessionState} from "../gameplay/singlePlayerSession";

/** Builds one valid authoritative guess request. */
const request = (guess: string, requestId: string, gameMode: "classic" | "challenge" = "classic") => ({
  riddleId: "riddle-1",
  gameMode,
  sessionToken: "00000000-0000-4000-8000-000000000001",
  guess,
  requestId,
});

describe("single-player authoritative session", () => {
  it("derives correctness and attempt count from canonical state", () => {
    /** Provides first behavior. */
    const first = transitionSinglePlayerGuess({
      request: request("crane", "request-0001"),
      answer: "piano",
      locale: "en",
    });
    /** Provides second behavior. */
    const second = transitionSinglePlayerGuess({
      state: first.state,
      request: request("piano", "request-0002"),
      answer: "piano",
      locale: "en",
    });

    expect(first.result).toMatchObject({attempts: 1, isCorrect: false, gameOver: false});
    expect(first.result).not.toHaveProperty("correctAnswer");
    expect(second.result).toMatchObject({attempts: 2, isCorrect: true, gameOver: true});
    expect(second.result).not.toHaveProperty("correctAnswer");
    expect(second.state).toMatchObject({attempts: 2, terminal: true, isCorrect: true, lastGuess: "piano"});
  });

  it("replays the same request without incrementing and binds it to its guess", () => {
    /** Provides first behavior. */
    const first = transitionSinglePlayerGuess({
      request: request("crane", "request-0001"),
      answer: "piano",
      locale: "en",
    });
    /** Provides replay behavior. */
    const replay = transitionSinglePlayerGuess({
      state: first.state,
      request: request("crane", "request-0001"),
      answer: "piano",
      locale: "en",
    });

    expect(replay).toMatchObject({replayed: true, result: {attempts: 1}});
    expect(() =>
      transitionSinglePlayerGuess({
        state: first.state,
        request: request("piano", "request-0001"),
        answer: "piano",
        locale: "en",
      }),
    ).toThrow(HttpsError);
  });

  it("stops at the base cap until the server grants the paid attempt", () => {
    /** Provides state behavior. */
    let state: SinglePlayerSessionState | undefined;
    /** Provides guesses behavior. */
    const guesses = ["crane", "slate", "house", "brick", "flame"];
    for (let index = 1; index <= 5; index += 1) {
      state = transitionSinglePlayerGuess({
        state,
        request: request(guesses[index - 1], `request-000${index}`),
        answer: "piano",
        locale: "en",
      }).state;
    }
    expect(state).toMatchObject({attempts: 5, awaitingContinue: true, terminal: false});
    expect(() =>
      transitionSinglePlayerGuess({
        state,
        request: request("piano", "request-0006"),
        answer: "piano",
        locale: "en",
      }),
    ).toThrow(HttpsError);

    /** Provides continued behavior. */
    const continued = {...state!, awaitingContinue: false, hasUsedContinue: true};
    /** Provides final behavior. */
    const final = transitionSinglePlayerGuess({
      state: continued,
      request: request("piano", "request-0006"),
      answer: "piano",
      locale: "en",
    });
    expect(final.result).toMatchObject({attempts: 6, isCorrect: true, gameOver: true});
  });

  it("rejects guesses that do not match the canonical playable answer length", () => {
    expect(() =>
      transitionSinglePlayerGuess({
        request: request("four", "request-0001"),
        answer: "piano",
        locale: "en",
      }),
    ).toThrow(HttpsError);
  });

  it("semantically replays a dropped response even when the transport creates a fresh request id", () => {
    /** Provides first behavior. */
    const first = transitionSinglePlayerGuess({
      request: request("crane", "request-0001"),
      answer: "piano",
      locale: "en",
    });
    /** Provides replay behavior. */
    const replay = transitionSinglePlayerGuess({
      state: first.state,
      request: request("crane", "request-fresh"),
      answer: "piano",
      locale: "en",
    });
    expect(replay).toMatchObject({replayed: true, result: {attempts: 1}});
  });
});
