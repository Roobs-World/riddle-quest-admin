/**
 * Profanity / unsafe terms for username filtering.
 *
 * Notes:
 * - This list is intentionally broad (profanity, sexual content, violence/self-harm, hard drugs).
 * - It is not exhaustive across all languages; treat as a baseline.
 * - Matching logic also checks substrings, so keep entries reasonably specific
 *   to avoid false positives.
 */
export const PROFANE_WORDS: readonly string[] = [
  // Core profanity (common variants)
  "arse",
  "arsehole",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dildo",
  "dipshit",
  "douche",
  "douchebag",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "goddamn",
  "hell",
  "jerkoff",
  "motherfucker",
  "piss",
  "pissed",
  "prick",
  "pussy",
  "shit",
  "shitty",
  "slut",
  "twat",
  "wank",
  "wanker",
  "whore",

  // Sexual content / porn terms
  "adult",
  "anal",
  "anus",
  "bdsm",
  "blowjob",
  "boob",
  "boobs",
  "breast",
  "breasts",
  "buttplug",
  "clit",
  "clitoris",
  "cock",
  "cum",
  "cumming",
  "cunnilingus",
  "deepthroat",
  "ejaculate",
  "ejaculation",
  "erotic",
  "escort",
  "fellatio",
  "fetish",
  "handjob",
  "hentai",
  "horny",
  "jizz",
  "masturbate",
  "masturbation",
  "milf",
  "nude",
  "nudes",
  "naked",
  "orgasm",
  "penis",
  "porn",
  "porno",
  "pornstar",
  "prostitute",
  "pube",
  "pubes",
  "rape",
  "rapist",
  "sex",
  "sexy",
  "squirting",
  "strip",
  "stripper",
  "tit",
  "tits",
  "titty",
  "vagina",
  "vulva",
  "xxx",

  // Hate slurs (for filtering only)
  "chink",
  "gook",
  "kike",
  "nigger",
  "raghead",
  "spic",
  "towelhead",
  "wetback",

  // Ableist slurs / harassment
  "retard",

  // Violence / self-harm
  "die",
  "kill",
  "kys",
  "murder",
  "suicide",

  // Extremism / terror
  "hitler",
  "nazi",

  // Hard drugs
  "cocaine",
  "crack",
  "drugs",
  "heroin",
  "meth",
  "opioid",

  // Soft drugs (still disallowed for usernames)
  "marijuana",
  "weed",

  // Misc
  "pedophile",
  "pedo",

  // Test-only sentinel
  "badword",
];
