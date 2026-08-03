import {RACE_RULES} from "@qwordly/core/race";

export const raceCallableUserId = "player-1";
export const raceCallableRequestId = "request-0001";

export const raceRunFixture = {
  runId: "run-1",
  role: "creator" as const,
  status: "active" as const,
  categoryId: "history" as const,
  locale: "en" as const,
  rules: RACE_RULES,
  correctCount: 0,
  wallElapsedMs: 1_000,
  totalPenaltyMs: 0,
  adjustedElapsedMs: 1_000,
  currentRiddle: {
    riddleId: "riddle-1",
    text: "What has keys but cannot open locks?",
    answerLength: 5,
    position: 0,
    guessesUsed: 0,
    guessesRemaining: 5,
    hintAvailable: true,
    revealedLetters: [],
  },
  events: [],
};

export const raceRunResponseFixture = {run: raceRunFixture};

export const abandonedRaceResponseFixture = {
  run: {...raceRunFixture, status: "abandoned" as const, currentRiddle: null},
  result: null,
};

export const raceChallengePreviewFixture = {
  challengeId: "challenge-1",
  creator: {displayName: "Ada", avatarUrl: null},
  categoryId: "history" as const,
  targetCorrect: 10 as const,
  adjustedTimeToBeatMs: 75_000,
  rulesVersion: "race10_v1" as const,
  expiresAtMs: 2_000_000_000_000,
  status: "active" as const,
};

export const raceOutcomeFixture = {
  runId: "run-1",
  result: "recorded" as const,
  correctCount: 10,
  wallFinishMs: 60_000,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  totalPenaltyMs: 0,
  adjustedFinishMs: 60_000,
  publishable: true,
  rematchEligible: false,
  newlyUnlockedAchievementIds: [],
  achievementCoinsAwarded: 0,
};

export const raceCategoriesFixture = {
  categories: [
    {
      categoryId: "history" as const,
      nameKey: "RaceTo10.CATEGORY_HISTORY_NAME",
      descriptionKey: "RaceTo10.CATEGORY_HISTORY_DESCRIPTION",
      icon: "history" as const,
      colorToken: "#123456",
      availableRiddleCount: 30,
    },
  ],
  rules: RACE_RULES,
};
