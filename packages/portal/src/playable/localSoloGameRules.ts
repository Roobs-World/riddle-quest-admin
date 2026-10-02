import {countCoinRewardAchievements} from "@qwordly/core/game";
import {lowerCaseGraphemes, splitGraphemes, type Feedback} from "@qwordly/core/game";
import {findNewYouTubeAchievements} from "./achievements";
import {
  YOUTUBE_ACHIEVEMENT_COINS,
  YOUTUBE_CLASSIC_WIN_COINS,
  YOUTUBE_DAILY_WIN_COINS,
  YOUTUBE_LEVEL_UP_COINS,
  getYouTubeDailyStreakBonus,
  getYouTubeLevelFromXp,
  getYouTubeWinXp,
  nextYouTubeDailyStreak,
} from "./economy";
import {YouTubeAuthorityError} from "./LocalSoloAuthority.contract";
import {YOUTUBE_ANSWER_MAX_GRAPHEMES} from "./limits";
import type {
  YouTubeActiveGame,
  YouTubeContent,
  YouTubeGameMode,
  YouTubeResult,
  YouTubeRiddle,
  YouTubeSaveV1,
} from "./types";
/** Accepts one normalized letter grapheme and its combining marks. */
const ANSWER_GRAPHEME_PATTERN = /^[\p{L}\p{M}]+$/u;
/** Resolves the canonical daily riddle identifier for a UTC day. */
export const getYouTubeDailyRiddleId = (content: YouTubeContent, day: string): string | null => {
  /** Provides segment behavior. */
  const segment = [...content.daily.segments].reverse().find(({startsOn}) => startsOn <= day);
  if (!segment) return null;
  /** Provides epoch behavior. */
  const epoch = new Date(`${segment.startsOn}T00:00:00.000Z`).getTime();
  /** Provides current behavior. */
  const current = new Date(`${day}T00:00:00.000Z`).getTime();
  /** Provides days behavior. */
  const days = Math.floor((current - epoch) / 86_400_000);
  if (days < 0 || segment.canonicalIds.length === 0) return null;
  return segment.canonicalIds[days % segment.canonicalIds.length] ?? null;
};
/** Checks whether a saved active game still matches the bundled localized content. */
export const activeYouTubeGameMatchesContent = (
  active: YouTubeActiveGame,
  riddle: YouTubeRiddle | undefined,
  content: YouTubeContent,
  save: YouTubeSaveV1,
): boolean => {
  if (!riddle || active.contentFingerprint !== riddle.contentFingerprint) return false;
  /** Provides answer behavior. */
  const answer = splitGraphemes(riddle.answer.normalize("NFC"));
  if (answer.length < 1 || answer.length > YOUTUBE_ANSWER_MAX_GRAPHEMES) return false;
  // Submitted guesses and hint positions describe the locale in which the
  // attempt began. A language change must retain that canonical puzzle even
  // when the newly localized answer has a different grapheme count.
  if (active.mode === "classic") {
    return content.classicOrder[save.progression.classicIndex] === active.riddleId;
  }
  return active.dailyDate !== undefined && getYouTubeDailyRiddleId(content, active.dailyDate) === active.riddleId;
};
/** Scores one submitted YouTube guess using duplicate-letter-aware feedback. */
export const scoreYouTubeGuess = (guess: string[], answer: string, locale: string): Feedback[] => {
  /** Provides guess letters behavior. */
  const guessLetters = lowerCaseGraphemes(guess.join(""), locale);
  /** Provides answer letters behavior. */
  const answerLetters = lowerCaseGraphemes(answer, locale);
  /** Provides remaining behavior. */
  const remaining = new Map<string, number>();
  for (const letter of answerLetters) remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  /** Provides feedback behavior. */
  const feedback = guessLetters.map((): Feedback => "red");
  for (let index = 0; index < guessLetters.length; index += 1) {
    if (guessLetters[index] !== answerLetters[index]) continue;
    feedback[index] = "green";
    remaining.set(guessLetters[index], (remaining.get(guessLetters[index]) ?? 1) - 1);
  }
  for (let index = 0; index < guessLetters.length; index += 1) {
    if (feedback[index] === "green") continue;
    /** Provides count behavior. */
    const count = remaining.get(guessLetters[index]) ?? 0;
    if (count > 0) {
      feedback[index] = "yellow";
      remaining.set(guessLetters[index], count - 1);
    }
  }
  return feedback;
};
/** Projects ephemeral input together with hint letters from bundled content. */
export const projectYouTubeDisplayLetters = (
  draftLetters: readonly string[],
  active: YouTubeActiveGame,
  riddle: YouTubeRiddle,
): string[] => {
  /** Provides answer behavior. */
  const answer = splitGraphemes(riddle.answer.normalize("NFC"));
  return answer.map((_letter, index) =>
    active.hintRevealedIndices.includes(index) ? (answer[index] ?? "") : (draftLetters[index] ?? ""),
  );
};
/** Finds the first empty answer position that is not fixed by a hint. */
export const findFirstEditableYouTubeSlot = (draftLetters: readonly string[], active: YouTubeActiveGame): number => {
  /** Provides index behavior. */
  const index = draftLetters.findIndex(
    (letter, candidate) => !letter && !active.hintRevealedIndices.includes(candidate),
  );
  return index < 0 ? 0 : index;
};
/** Validates and strips hinted letters from an ephemeral input row. */
export const normalizeYouTubeDraftLetters = (
  letters: readonly string[],
  active: YouTubeActiveGame,
  riddle: YouTubeRiddle,
  locale: string,
): string[] | null => {
  /** Provides answer behavior. */
  const answer = splitGraphemes(riddle.answer.normalize("NFC"), locale);
  if (
    letters.some(
      (letter) =>
        letter !== "" &&
        (letter !== letter.normalize("NFC") ||
          splitGraphemes(letter, locale).length !== 1 ||
          !ANSWER_GRAPHEME_PATTERN.test(letter)),
    )
  )
    return null;
  if (
    active.hintRevealedIndices.some(
      (index) =>
        lowerCaseGraphemes(letters[index] ?? "", locale).join("") !==
        lowerCaseGraphemes(answer[index] ?? "", locale).join(""),
    )
  )
    return null;
  return letters.map((letter, index) => (active.hintRevealedIndices.includes(index) ? "" : letter));
};
/** Finds the next position whose normalized draft value differs from the answer. */
export const findYouTubeHintIndex = (
  draftLetters: readonly string[],
  active: YouTubeActiveGame,
  riddle: YouTubeRiddle,
  locale: string,
): number => {
  /** Provides answer behavior. */
  const answer = splitGraphemes(riddle.answer.normalize("NFC"), locale);
  /** Normalizes d input. */
  const normalizedInput = projectYouTubeDisplayLetters(draftLetters, active, riddle).map((letter) =>
    lowerCaseGraphemes(letter, locale).join(""),
  );
  /** Normalizes d answer. */
  const normalizedAnswer = answer.map((letter) => lowerCaseGraphemes(letter, locale).join(""));
  return normalizedAnswer.findIndex(
    (letter, candidate) => !active.hintRevealedIndices.includes(candidate) && normalizedInput[candidate] !== letter,
  );
};
/** Applies the authoritative local progression settlement for a finished game. */
export const completeYouTubeGame = (
  next: YouTubeSaveV1,
  mode: YouTubeGameMode,
  isCorrect: boolean,
  attempts: number,
  dailyDate: string | undefined,
): YouTubeResult => {
  /** Provides progress behavior. */
  const progress = next.progression;
  progress.gamesPlayed += 1;
  /** Provides base coins behavior. */
  let baseCoins = 0;
  /** Provides streak coins behavior. */
  let streakCoins = 0;
  /** Provides level coins behavior. */
  let levelCoins = 0;
  /** Provides xp earned behavior. */
  let xpEarned = 0;
  if (isCorrect) {
    progress.totalWins += 1;
    progress.totalGuessesInWins += attempts;
    xpEarned = getYouTubeWinXp(mode, attempts);
    /** Provides prior level behavior. */
    const priorLevel = progress.level;
    progress.xp += xpEarned;
    progress.level = getYouTubeLevelFromXp(progress.xp);
    if (progress.level > priorLevel) levelCoins = YOUTUBE_LEVEL_UP_COINS;
    if (mode === "classic") {
      baseCoins = YOUTUBE_CLASSIC_WIN_COINS;
      progress.classicIndex += 1;
      progress.highestClassicLevel = Math.max(progress.highestClassicLevel, progress.classicIndex);
    } else {
      if (!dailyDate) throw new YouTubeAuthorityError("daily-date-missing");
      baseCoins = YOUTUBE_DAILY_WIN_COINS;
      progress.currentDailyStreak = nextYouTubeDailyStreak(
        progress.currentDailyStreak,
        progress.lastDailyCompletedDate,
        dailyDate,
      );
      progress.bestDailyStreak = Math.max(progress.bestDailyStreak, progress.currentDailyStreak);
      progress.lastDailyCompletedDate = dailyDate;
      progress.dailyPuzzlesCompleted += 1;
      progress.challengeWins += 1;
      streakCoins = getYouTubeDailyStreakBonus(progress.currentDailyStreak);
    }
  } else if (mode === "daily") {
    progress.currentDailyStreak = 0;
  }
  /** Provides non achievement coins behavior. */
  const nonAchievementCoins = isCorrect ? baseCoins + streakCoins + levelCoins : 0;
  progress.coins += nonAchievementCoins;
  /** Provides achievements behavior. */
  const achievements = findNewYouTubeAchievements(progress, {mode, isCorrect, attempts, gameOver: true});
  progress.unlockedAchievementIds.push(...achievements);
  /** Provides achievement coins behavior. */
  const achievementCoins = isCorrect ? countCoinRewardAchievements(achievements) * YOUTUBE_ACHIEVEMENT_COINS : 0;
  progress.coins += achievementCoins;
  next.activeGame = null;
  return {
    kind: isCorrect ? "win" : "loss",
    mode,
    attempts,
    coinsEarned: nonAchievementCoins + achievementCoins,
    xpEarned,
    newlyUnlockedAchievementIds: achievements,
  };
};
