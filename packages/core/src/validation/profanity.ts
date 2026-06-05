import {PROFANE_WORDS} from "./profanityWords";

export function containsProfanity(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }

  const cleanUsername = username.toLowerCase().trim();

  return PROFANE_WORDS.some((word) => {
    const exactMatch = new RegExp(`\\b${word}\\b`, "i").test(cleanUsername);
    const boundaryOnly = new Set(["anal", "anus", "tit", "tits"]);
    const substringMatch = boundaryOnly.has(word) ? false : cleanUsername.includes(word.toLowerCase());

    return exactMatch || substringMatch;
  });
}

export function validateUsernameForProfanity(username: string): string {
  if (containsProfanity(username)) {
    return "Username contains inappropriate language. Please choose a different username.";
  }
  return "";
}
