import {type PlayerStats, type PlayerProgress} from "../../../platform/contracts/firestoreSchemas";
import {RACE_ACHIEVEMENT_DEFINITIONS} from "./raceAchievementDefinitions";
import {SOLO_ACHIEVEMENT_DEFINITIONS} from "./soloAchievements";
import type {AchievementCriteriaType, AchievementDefinition} from "./achievementTypes";
export type {AchievementCriteriaType, AchievementDefinition, AchievementPlayerData} from "./achievementTypes";

const achievementDefinitions = [...SOLO_ACHIEVEMENT_DEFINITIONS, ...RACE_ACHIEVEMENT_DEFINITIONS];

/** Localized display keys preserve the separate milestone and race catalogs. */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = achievementDefinitions.map((definition) => ({
  ...definition,
  nameKey: definition.nameKey ?? `Achievements.SOLO.${definition.id}.NAME`,
  descriptionKey: definition.descriptionKey ?? `Achievements.SOLO.${definition.id}.DESCRIPTION`,
}));

/**
 * @deprecated Use `def.getProgress(playerData)` instead.
 * Kept for any external callers during migration.
 */
export function getAchievementProgress(
  criteriaType: AchievementCriteriaType,
  stats: PlayerStats | undefined | null,
  progress: PlayerProgress | undefined | null,
  hasPurchasedApp?: boolean | null,
): number {
  /** Provides def behavior. */
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.criteriaType === criteriaType);
  if (!def) return 0;
  return def.getProgress({stats, progress, hasPurchasedApp});
}
