import {describe, expect, it} from "@jest/globals";
import {
  canSubmitUsername,
  normalizeUsernameInput,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "../usernameForm";

describe("username form", () => {
  it("centralizes the browser input limits", () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(24);
  });

  it("normalizes surrounding whitespace", () => {
    expect(normalizeUsernameInput("  Nova  ")).toBe("Nova");
    expect(normalizeUsernameInput("  Ｎóva  ")).toBe("Nóva");
  });

  it("uses the shared Unicode-safe username boundary", () => {
    expect(canSubmitUsername("  ab  ")).toBe(false);
    expect(canSubmitUsername("  abc  ")).toBe(true);
    expect(canSubmitUsername("Łukasz O’Neil")).toBe(true);
    expect(canSubmitUsername("Ali\nce")).toBe(false);
    expect(canSubmitUsername("Ali\u0000ce")).toBe(false);
    expect(canSubmitUsername("<b>")).toBe(false);
    expect(canSubmitUsername("___")).toBe(false);
    expect(canSubmitUsername("x".repeat(97))).toBe(false);
  });
});
