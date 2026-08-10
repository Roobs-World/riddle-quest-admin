import {describe, expect, it} from "@jest/globals";
import {
  canSubmitUsername,
  normalizeUsernameInput,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "../modalPages/profile/usernameForm";

describe("username form", () => {
  it("centralizes the browser input limits", () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(24);
  });

  it("normalizes surrounding whitespace", () => {
    expect(normalizeUsernameInput("  Nova  ")).toBe("Nova");
  });

  it("validates the normalized username length", () => {
    expect(canSubmitUsername("  ab  ")).toBe(false);
    expect(canSubmitUsername("  abc  ")).toBe(true);
  });
});
