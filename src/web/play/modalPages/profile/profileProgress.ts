import type {BridgeProfile} from "../../../../core/bridge";

/** Derived progression values displayed by profile modal pages. */
export type ProfileProgress = {
  /** Current player level, defaulting to the first level for guests. */
  level: number;
  /** Current experience total, defaulting to zero for guests. */
  xp: number;
  /** Percentage progress from the current level to the next. */
  percentage: number;
};

/** Returns the cumulative experience required to begin a level. */
export const getXpForLevel = (level: number): number => {
  /** Number of fully completed levels before the supplied level. */
  const completedLevels = Math.max(0, level - 1);
  return completedLevels * 100 + ((completedLevels - 1) * completedLevels * 10) / 2;
};

/** Derives clamped profile progression without storing redundant React state. */
export const getProfileProgress = (profile: BridgeProfile | null): ProfileProgress => {
  /** Current level normalized for a missing guest profile. */
  const level = profile?.level ?? 1;
  /** Current experience normalized for a missing guest profile. */
  const xp = profile?.xp ?? 0;
  /** Experience threshold at the beginning of the current level. */
  const currentThreshold = getXpForLevel(level);
  /** Experience threshold at the beginning of the next level. */
  const nextThreshold = getXpForLevel(level + 1);
  /** Experience interval between the current and next level. */
  const levelRange = Math.max(1, nextThreshold - currentThreshold);

  return {
    level,
    xp,
    percentage: Math.min(100, Math.max(0, ((xp - currentThreshold) / levelRange) * 100)),
  };
};
