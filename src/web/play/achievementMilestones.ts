import {ACHIEVEMENT_MILESTONES} from "../../core/game";
import english from "../../locales/en/achievements.json";
import type {AchievementDefinition} from "./achievementTypes";

/** Localized display and progress for the shared solo milestone rules. */
export const MILESTONE_ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = ACHIEVEMENT_MILESTONES.map(
  ({id, stat, threshold, icon}) => ({
    id, criteriaType: id, threshold, icon,
    name: english.Achievements.MILESTONES[id].NAME,
    description: english.Achievements.MILESTONES[id].DESCRIPTION,
    nameKey: `Achievements.MILESTONES.${id}.NAME`,
    descriptionKey: `Achievements.MILESTONES.${id}.DESCRIPTION`,
    getProgress: (player) => player.stats?.[stat] ?? 0,
  }),
);
