/** Accepts one hosted keyboard letter, including Turkish display variants of ASCII I/i. */
export const isSinglePlayerKeyboardLetter = (value: unknown): value is string =>
  typeof value === "string" && value.length === 1 && /^[a-zİı]$/i.test(value);
