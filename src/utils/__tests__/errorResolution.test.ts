import {
  ErrorMessageResolver,
  createCodeMapStrategy,
  createMessageContainsStrategy,
  extractErrorCode,
  extractErrorMessage,
} from "../errorResolution";

describe("errorResolution", () => {
  it("extracts error codes and messages from common error shapes", () => {
    expect(extractErrorCode({code: "Functions/Not-Found"})).toBe("Functions/Not-Found");
    expect(extractErrorCode({message: "no code here"})).toBeUndefined();
    expect(extractErrorMessage("plain string error")).toBe("plain string error");
    expect(extractErrorMessage({message: "structured error"})).toBe("structured error");
  });

  it("matches normalized codes in code-map strategies", () => {
    const strategy = createCodeMapStrategy(
      "firebase-code-map",
      {
        "functions/not-found": "Function missing.",
        "auth/user-not-found": "User missing.",
      },
      {
        normalizeCode: (code: string) => code.trim().toLowerCase(),
      },
    );

    expect(strategy.matches({code: "Functions/Not-Found"})).toBe(true);
    expect(strategy.resolve({code: "Functions/Not-Found"})).toBe("Function missing.");
    expect(strategy.matches({code: "unknown"})).toBe(false);
  });

  it("matches message patterns using both string and regex strategies", () => {
    const strategy = createMessageContainsStrategy("message-patterns", [
      {pattern: "network timeout", message: "Network timeout."},
      {pattern: /permission denied/i, message: "Permission denied."},
    ]);

    expect(strategy.matches({message: "Request failed: network timeout"})).toBe(true);
    expect(strategy.resolve({message: "Request failed: network timeout"})).toBe("Network timeout.");
    expect(strategy.matches({message: "PERMISSION DENIED while saving"})).toBe(true);
    expect(strategy.resolve({message: "PERMISSION DENIED while saving"})).toBe("Permission denied.");
  });

  it("resolves the first successful strategy and falls back when nothing matches", () => {
    const resolver = new ErrorMessageResolver(
      [
        {
          name: "first-strategy",
          matches: () => true,
          resolve: () => null,
        },
        {
          name: "second-strategy",
          matches: () => true,
          resolve: () => "Resolved by second strategy",
        },
      ],
      {
        fallbackMessage: "Fallback message",
      },
    );

    expect(resolver.resolve({message: "anything"})).toBe("Resolved by second strategy");

    const fallbackResolver = new ErrorMessageResolver(
      [
        {
          name: "null-strategy",
          matches: () => true,
          resolve: () => null,
        },
      ],
      {
        fallbackMessage: "Fallback message",
      },
    );

    expect(fallbackResolver.resolve({message: "anything"})).toBe("Fallback message");
  });
});
