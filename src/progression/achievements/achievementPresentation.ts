import type {AchievementDefinition, AchievementPlayerData, AchievementRequirement} from "./catalog/achievementTypes";

/** Values displayed by accessible achievement progress bars. */
export type AchievementProgressView = Readonly<{
  labelKey: string | null;
  value: number | null;
  target: number;
  ratio: number;
  text: string;
}>;

function requirementView(requirement: AchievementRequirement, unlocked: boolean): AchievementProgressView {
  const {target, comparison, unit = ""} = requirement;
  const value = requirement.value !== null && Number.isFinite(requirement.value) && requirement.value >= 0
    ? requirement.value : null;
  const fraction = value === null ? 0 : comparison === "at-most"
    ? value === 0 ? 1 : target / value : value / target;
  const displayed = unlocked ? target : value;
  const formatted = displayed === null ? "—" : String(Math.round(displayed * 100) / 100);
  return {labelKey: requirement.labelKey || null, value: displayed, target,
    ratio: unlocked ? 1 : Math.max(0, Math.min(1, fraction)),
    text: `${formatted}${unit} ${comparison === "at-most" ? "≤" : "/"} ${target}${unit}`};
}

/** Displays every unlock requirement; only recorded unlocks receive completed styling. */
export function getAchievementProgressViews(
  definition: AchievementDefinition, player: AchievementPlayerData, unlocked: boolean,
): readonly AchievementProgressView[] {
  const requirements = definition.getRequirements?.(player);
  if (requirements) return requirements.map((requirement) => requirementView(requirement, unlocked));
  const raw = definition.getProgress(player);
  return [requirementView({labelKey: "", value: Number.isFinite(raw) ? Math.max(0, Math.min(definition.threshold, raw)) : 0,
    target: definition.threshold, comparison: "at-least"}, unlocked)];
}

/** Keeps earned badges first, followed by the closest remaining goals, in stable catalog order. */
export function orderAchievementDefinitions(
  definitions: readonly AchievementDefinition[], player: AchievementPlayerData, unlockedIds: readonly string[],
): AchievementDefinition[] {
  const unlocked = new Set(unlockedIds);
  return definitions.map((definition) => ({definition, earned: unlocked.has(definition.id),
    completion: Math.min(...getAchievementProgressViews(definition, player, false).map(({ratio}) => ratio)),
  })).sort((a, b) => Number(b.earned) - Number(a.earned) || (a.earned ? 0 : b.completion - a.completion))
    .map(({definition}) => definition);
}
