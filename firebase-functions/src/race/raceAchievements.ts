import {RACE_ACHIEVEMENT_IDS, type RaceAchievementId} from "@riddle-quest/core/race";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../shared/constants";

/** Authoritative multiplayer event that can advance achievement progress. */
export type RaceAchievementEvent =
  | {
      /** Stores kind. */
      kind: "completed"; /** Stores won. */
      /** Stores won. */
      won: boolean; /** Stores clean run. */
      /** Stores clean run. */
      cleanRun: boolean;
    }
  | {
      /** Stores kind. */
      kind: "opponent_resolved"; /** Stores won. */
      /** Stores won. */
      won: boolean;
    }
  | {
      /** Stores kind. */
      kind: "challenge_published";
    };

/** Atomic achievement and currency changes resulting from one race event. */
export type RaceAchievementUpdate = {
  /** Stores stats. */
  stats: {
    /** Stores multiplayer games played. */
    multiplayerGamesPlayed: number;
    /** Stores multiplayer wins. */
    multiplayerWins: number;
    /** Stores multiplayer challenges created. */
    multiplayerChallengesCreated: number;
  };
  /** Stores newly unlocked achievement ids. */
  newlyUnlockedAchievementIds: RaceAchievementId[];
  /** Stores unlocked achievement entries. */
  unlockedAchievementEntries: Array<{
    /** Stores achievement id. */
    achievementId: RaceAchievementId; /** Stores unlocked at. */
    /** Stores unlocked at. */
    unlockedAt: number;
  }>;
  /** Stores achievement coins awarded. */
  achievementCoinsAwarded: number;
  /** Stores new coins. */
  newCoins: number;
};

/** Provides nonnegative integer behavior. */
const nonnegativeInteger = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

/** Validates a retained one-time award against supported unique unlocks and their fixed grant amount. */
export function raceRewardAwardsAgree(ids: readonly string[], coins: number): boolean {
  return ids.length <= RACE_ACHIEVEMENT_IDS.length && new Set(ids).size === ids.length &&
    ids.every(id => RACE_ACHIEVEMENT_IDS.some(supported => supported === id)) &&
    coins === ids.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
}

/** Records or empty. */
const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Provides unlocked ids behavior. */
const unlockedIds = (value: unknown): Set<string> =>
  new Set(
    Array.isArray(value)
      ? value.flatMap((entry) => {
          if (typeof entry === "string") return [entry];
          /** Provides record behavior. */
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
  /** Provides current stats behavior. */
  const currentStats = recordOrEmpty(userData.stats);
  /** Provides stats behavior. */
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

  /** Provides eligible behavior. */
  const eligible = new Set<RaceAchievementId>();
  if (stats.multiplayerGamesPlayed >= 1) eligible.add("race_debut");
  if (stats.multiplayerWins >= 1) eligible.add("race_first_win");
  if (stats.multiplayerWins >= 5) eligible.add("race_wins_5");
  if (stats.multiplayerWins >= 25) eligible.add("race_wins_25");
  if (stats.multiplayerChallengesCreated >= 1) eligible.add("race_host");
  if (stats.multiplayerChallengesCreated >= 5) eligible.add("race_hosts_5");
  if (event.kind === "completed" && event.cleanRun) eligible.add("race_clean_run");

  /** Provides existing behavior. */
  const existing = unlockedIds(userData.unlockedAchievements);
  /** Provides newly unlocked achievement ids behavior. */
  const newlyUnlockedAchievementIds = RACE_ACHIEVEMENT_IDS.filter(
    (achievementId) => eligible.has(achievementId) && !existing.has(achievementId),
  );
  /** Provides achievement coins awarded behavior. */
  const achievementCoinsAwarded = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
  /** Provides new coins behavior. */
  const newCoins = nonnegativeInteger(userData.coins) + achievementCoinsAwarded;

  return {
    stats,
    newlyUnlockedAchievementIds,
    unlockedAchievementEntries: newlyUnlockedAchievementIds.map((achievementId) => ({
      achievementId,
      unlockedAt: nowMs,
    })),
    achievementCoinsAwarded,
    newCoins,
  };
}
