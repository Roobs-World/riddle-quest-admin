import {describe, expect, it} from "@jest/globals";
import {
  BRIDGE_PROTOCOL_VERSION,
  GameToHostMessageSchema,
  HostToGameMessageSchema,
  isGameToHostMessage,
  isHostToGameMessage,
  parseGameToHostMessage,
  parseHostToGameMessage,
} from "../index";

describe("bridge protocol", () => {
  const sessionToken = "00000000-0000-4000-8000-000000000001";

  it("accepts a ready message from the game iframe", () => {
    const message = parseGameToHostMessage({
      type: "game:ready",
      requestId: "ready-1",
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        surface: "html5",
      },
    });

    expect(message.type).toBe("game:ready");
    if (message.type !== "game:ready") throw new Error("Expected a ready message");
    expect(message.payload.protocolVersion).toBe(BRIDGE_PROTOCOL_VERSION);
  });

  it("rejects malformed game messages", () => {
    const result = GameToHostMessageSchema.safeParse({
      type: "game:spendCoins",
      payload: {
        reason: "teleport",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts riddle payloads from the host", () => {
    const message = parseHostToGameMessage({
      type: "host:riddleLoaded",
      requestId: "load-1",
      payload: {
        riddle: {
          riddleId: "classic-1",
          text: "What has keys but cannot open doors?",
          answerLength: 5,
          sessionToken,
          gameMode: "classic",
          index: 1,
          attemptsUsed: 0,
          hasUsedContinue: false,
          awaitingContinue: false,
        },
        profile: null,
      },
    });

    if (message.type !== "host:riddleLoaded") throw new Error("Expected a riddle-loaded message");
    expect(message.payload.riddle.answerLength).toBe(5);
    expect(message.payload.riddle).not.toHaveProperty("answer");
  });

  it("rejects impossible authoritative attempt recovery state", () => {
    for (const continueState of [
      {attemptsUsed: 6, hasUsedContinue: false, awaitingContinue: false},
      {attemptsUsed: 5, hasUsedContinue: false, awaitingContinue: false},
      {attemptsUsed: 4, hasUsedContinue: true, awaitingContinue: false},
    ] as const) {
      expect(HostToGameMessageSchema.safeParse({
        type: "host:riddleLoaded",
        payload: {
          riddle: {
            riddleId: "classic-1",
            text: "Clue",
            answerLength: 5,
            sessionToken,
            gameMode: "classic",
            ...continueState,
          },
          profile: null,
        },
      }).success).toBe(false);
    }
  });

  it("accepts guesses but rejects client-authored completion outcomes", () => {
    expect(GameToHostMessageSchema.safeParse({
      type: "game:submitGuess",
      requestId: "bridge-guess-1",
      payload: {
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken,
        guess: "piano",
        requestId: "backend-guess-1",
      },
    }).success).toBe(true);
    expect(GameToHostMessageSchema.safeParse({
      type: "game:completeGame",
      payload: {riddleId: "classic-1", gameMode: "classic", attempts: 1, isCorrect: true},
    }).success).toBe(false);
  });

  it("rejects non-keyboard guess content at the bridge boundary", () => {
    for (const guess of ["pi ano", "pi\nno", "pïano", "🎹"] as const) {
      expect(GameToHostMessageSchema.safeParse({
        type: "game:submitGuess",
        requestId: "bridge-guess-1",
        payload: {
          riddleId: "classic-1",
          gameMode: "classic",
          sessionToken,
          guess,
          requestId: "backend-guess-1",
        },
      }).success).toBe(false);
    }
  });

  it("shares the Unicode-safe username boundary with the callable schema", () => {
    expect(GameToHostMessageSchema.safeParse({
      type: "game:updateUsername",
      payload: {username: "  Łukasz O’Neil  "},
    }).success).toBe(true);
    for (const username of ["Ali\nce", "Ali\u0000ce", "Ali\u202Ece", "<b>", "___", "x".repeat(97)]) {
      expect(GameToHostMessageSchema.safeParse({
        type: "game:updateUsername",
        payload: {username},
      }).success).toBe(false);
    }
  });

  it("validates operation results with request correlation", () => {
    const result = HostToGameMessageSchema.safeParse({
      type: "host:operationResult",
      requestId: "hint-1",
      payload: {
        operation: "hint",
        ok: true,
        data: {
          index: 0,
          revealedLetter: "p",
          newCoins: 90,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("validates Race to 10 requests at the bridge boundary", () => {
    expect(
      GameToHostMessageSchema.safeParse({
        type: "game:startRace",
        requestId: "bridge-start-1",
        payload: {locale: "en", categoryId: "history", requestId: "backend-start-1"},
      }).success,
    ).toBe(true);
    expect(
      GameToHostMessageSchema.safeParse({
        type: "game:startRace",
        payload: {locale: "en", categoryId: "history", challengeId: "also-present", requestId: "backend-start-2"},
      }).success,
    ).toBe(false);
  });

  it("provides non-throwing message type guards", () => {
    const gameMessage = {type: "game:ready", payload: {protocolVersion: BRIDGE_PROTOCOL_VERSION}};
    const hostMessage = {type: "host:pause", payload: {}};
    expect(isGameToHostMessage(gameMessage)).toBe(true);
    expect(isGameToHostMessage(hostMessage)).toBe(false);
    expect(isHostToGameMessage(hostMessage)).toBe(true);
    expect(isHostToGameMessage(gameMessage)).toBe(false);
  });
});
