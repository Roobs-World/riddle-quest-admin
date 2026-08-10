import {RACE_ACHIEVEMENT_IDS, type RaceAchievementId} from "@qwordly/core/race";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../shared/constants";

/** Authoritative multiplayer event that can advance achievement progress. */
export type RaceAchievementEvent =
  | {kind: "completed"; won: boolean; cleanRun: boolean}
  | {kind: "opponent_resolved"; won: boolean}
  | {kind: "challenge_published"};

/** Atomic achievement and currency changes resulting from one race event. */
export type RaceAchievementUpdate = {
  /** Stores stats. */
  stats: {
    multiplayerGamesPlayed: number;
    multiplayerWins: number;
    multiplayerChallengesCreated: number;
  };
  /** Stores newly unlocked achievement ids. */
  newlyUnlockedAchievementIds: RaceAchievementId[];
  /** Stores unlocked achievement entries. */
  unlockedAchievementEntries: Array<{achievementId: RaceAchievementId; unlockedAt: number}>;
  /** Stores achievement coins awarded. */
  achievementCoinsAwarded: number;
  /** Stores new coins. */
  newCoins: number;
};

/** Provides nonnegative integer behavior. */
const nonnegativeInteger = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

/** Records or empty. */
const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Provides unlocked ids behavior. */
const unlockedIds = (value: unknown): Set<string> => new Set(
  Array.isArray(value)
    ? value.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      const record = recordOrEmpty(entry);
      return typeof record.achievementId === "string" ? [record.achievementId] : [];
    })
    : [],
);

/** Evaluates one race event and returns idempotent achievement state changes. */
export function evaluateRaceAchievementEvent(
  userData: Record<string, unknown>,
  event: RaceAchievementEvent,
  nowMs: number,
): RaceAchievementUpdate {
  const currentStats = recordOrEmpty(userData.stats);
  const stats = {
    multiplayerGamesPlayed: nonnegativeInteger(currentStats.multiplayerGamesPlayed),
    multiplayerWins: nonnegativeInteger(currentStats.multiplayerWins),
    multiplayerChallengesCreated: nonnegativeInteger(currentStats.multiplayerChallengesCreated),
  };

  if (event.kind === "completed") {
    stats.multiplayerGamesPlayed += 1;
    if (event.won) stats.multiplayerWins += 1;
  } else if (event.kind === "opponent_resolved") {
    stats.multiplayerGamesPlayed += 1;
    if (event.won) stats.multiplayerWins += 1;
  } else {
    stats.multiplayerChallengesCreated += 1;
  }

  const eligible = new Set<RaceAchievementId>();
  if (stats.multiplayerGamesPlayed >= 1) eligible.add("race_debut");
  if (stats.multiplayerWins >= 1) eligible.add("race_first_win");
  if (stats.multiplayerWins >= 5) eligible.add("race_wins_5");
  if (stats.multiplayerWins >= 25) eligible.add("race_wins_25");
  if (stats.multiplayerChallengesCreated >= 1) eligible.add("race_host");
  if (stats.multiplayerChallengesCreated >= 5) eligible.add("race_hosts_5");
  if (event.kind === "completed" && event.cleanRun) eligible.add("race_clean_run");

  const existing = unlockedIds(userData.unlockedAchievements);
  const newlyUnlockedAchievementIds = RACE_ACHIEVEMENT_IDS.filter(
    (achievementId) => eligible.has(achievementId) && !existing.has(achievementId),
  );
  const achievementCoinsAwarded = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
  const newCoins = nonnegativeInteger(userData.coins) + achievementCoinsAwarded;

  return {
    stats,
    newlyUnlockedAchievementIds,
    unlockedAchievementEntries: newlyUnlockedAchievementIds.map((achievementId) => ({achievementId, unlockedAt: nowMs})),
    achievementCoinsAwarded,
    newCoins,
  };
}
