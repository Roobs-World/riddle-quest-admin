import {isValidGuess} from "../isValidGuess";

describe("isValidGuess", () => {
  it("accepts valid letter-only guesses of the expected length", () => {
    expect(isValidGuess("HELLO", 5)).toBe(true);
    expect(isValidGuess("hello", 5)).toBe(true);
    expect(isValidGuess("ABC", 3)).toBe(true);
  });

  it("rejects incorrect length", () => {
    expect(isValidGuess("HELLO", 4)).toBe(false);
    expect(isValidGuess("HI", 5)).toBe(false);
  });

  it("rejects non-letter characters", () => {
    expect(isValidGuess("HEL1O", 5)).toBe(false);
    expect(isValidGuess("HEL O", 5)).toBe(false);
  });

  it("rejects empty or whitespace-only input", () => {
    expect(isValidGuess("", 5)).toBe(false);
    expect(isValidGuess("   ", 5)).toBe(false);
  });

  it("accepts composed letters as a single grapheme", () => {
    expect(isValidGuess("e\u0301", 1)).toBe(true);
  });
});
