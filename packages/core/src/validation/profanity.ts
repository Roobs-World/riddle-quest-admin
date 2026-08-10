import {PROFANE_WORDS, type ProfaneWord} from "./profanityWords";

/** Defines the boundary only profanity words value. */
const BOUNDARY_ONLY_PROFANITY_WORDS = new Set<ProfaneWord>(["anal", "anus", "tit", "tits"]);

/** Provides contains profanity behavior. */
export function containsProfanity(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }

  const cleanUsername = username.toLowerCase().trim();

  return PROFANE_WORDS.some((word) => {
    const exactMatch = new RegExp(`\\b${word}\\b`, "i").test(cleanUsername);
    const substringMatch = BOUNDARY_ONLY_PROFANITY_WORDS.has(word) ? false : cleanUsername.includes(word);

    return exactMatch || substringMatch;
  });
}

/** Validates username for profanity. */
export function validateUsernameForProfanity(username: string): string {
  if (containsProfanity(username)) {
    return "Username contains inappropriate language. Please choose a different username.";
  }

  return "";
}
