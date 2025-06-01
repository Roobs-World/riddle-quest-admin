// Simple profanity filter for usernames
// This is a basic implementation that can be enhanced with more sophisticated filtering

/**
 * List of common profane words to filter out from usernames.
 * This is a basic list - in production, you might want to use a more comprehensive list
 * or an external service for profanity detection.
 */
const PROFANE_WORDS = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "asshole",
  "damn",
  "hell",
  "crap",
  "piss",
  "bastard",
  "whore",
  "slut",
  "retard",
  "faggot",
  "nigger",
  "chink",
  "spic",
  "kike",
  "gook",
  "wetback",
  "raghead",
  "towelhead",
  "nazi",
  "hitler",
  "kill",
  "die",
  "suicide",
  "rape",
  "murder",
  "drugs",
  "cocaine",
  "heroin",
  "meth",
  "weed",
  "marijuana",
  "porn",
  "sex",
  "xxx",
  "adult",
  "nude",
  "naked",
  "strip",
  "escort",
  "prostitute",
  "badword",
];

/**
 * Checks if the given username contains profanity or inappropriate content.
 * @param username - The username to check
 * @returns true if the username contains profanity, false otherwise
 */
export function containsProfanity(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }

  const cleanUsername = username.toLowerCase().trim();

  // Check for exact matches and partial matches
  return PROFANE_WORDS.some((word) => {
    // Check for exact word match (with word boundaries)
    const exactMatch = new RegExp(`\\b${word}\\b`, "i").test(cleanUsername);

    // Check for the word as substring (to catch variations like "fck" for "fuck")
    const substringMatch = cleanUsername.includes(word.toLowerCase());

    return exactMatch || substringMatch;
  });
}

/**
 * Validates that a username doesn't contain profanity.
 * @param username - The username to validate
 * @returns An error message if profanity is detected, empty string otherwise
 */
export function validateUsernameForProfanity(username: string): string {
  if (containsProfanity(username)) {
    return "Username contains inappropriate language. Please choose a different username.";
  }
  return "";
}
