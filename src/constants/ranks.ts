export type RankIconName =
  | "telescope"
  | "compass-rose"
  | "map-marker-path"
  | "shield-star"
  | "crystal-ball"
  | "star-four-points"
  | "weather-night"
  | "crown";

export interface PlayerRank {
  id: string;
  minimumLevel: number;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: RankIconName;
  color: string;
  glowColor: string;
}

export const PLAYER_RANKS: readonly PlayerRank[] = [
  {
    id: "stargazer",
    minimumLevel: 1,
    nameKey: "Ranks.STARGAZER_NAME",
    descriptionKey: "Ranks.STARGAZER_DESCRIPTION",
    icon: "telescope",
    color: "#7A5A8A",
    glowColor: "#D9C4E4",
  },
  {
    id: "pathfinder",
    minimumLevel: 3,
    nameKey: "Ranks.PATHFINDER_NAME",
    descriptionKey: "Ranks.PATHFINDER_DESCRIPTION",
    icon: "compass-rose",
    color: "#2D7C73",
    glowColor: "#A9E1D5",
  },
  {
    id: "riddleScout",
    minimumLevel: 6,
    nameKey: "Ranks.RIDDLE_SCOUT_NAME",
    descriptionKey: "Ranks.RIDDLE_SCOUT_DESCRIPTION",
    icon: "map-marker-path",
    color: "#B36B24",
    glowColor: "#FFD39A",
  },
  {
    id: "cipherKnight",
    minimumLevel: 10,
    nameKey: "Ranks.CIPHER_KNIGHT_NAME",
    descriptionKey: "Ranks.CIPHER_KNIGHT_DESCRIPTION",
    icon: "shield-star",
    color: "#425D8C",
    glowColor: "#B8CCF0",
  },
  {
    id: "oracle",
    minimumLevel: 15,
    nameKey: "Ranks.ORACLE_NAME",
    descriptionKey: "Ranks.ORACLE_DESCRIPTION",
    icon: "crystal-ball",
    color: "#7D3E79",
    glowColor: "#E8B9E3",
  },
  {
    id: "luminary",
    minimumLevel: 21,
    nameKey: "Ranks.LUMINARY_NAME",
    descriptionKey: "Ranks.LUMINARY_DESCRIPTION",
    icon: "star-four-points",
    color: "#C98512",
    glowColor: "#FFE29A",
  },
  {
    id: "astralSage",
    minimumLevel: 28,
    nameKey: "Ranks.ASTRAL_SAGE_NAME",
    descriptionKey: "Ranks.ASTRAL_SAGE_DESCRIPTION",
    icon: "weather-night",
    color: "#334C85",
    glowColor: "#B9C9FF",
  },
  {
    id: "questLegend",
    minimumLevel: 36,
    nameKey: "Ranks.QUEST_LEGEND_NAME",
    descriptionKey: "Ranks.QUEST_LEGEND_DESCRIPTION",
    icon: "crown",
    color: "#9C5A00",
    glowColor: "#FFD66B",
  },
] as const;

export const getRankForLevel = (level: number): PlayerRank => {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return [...PLAYER_RANKS].reverse().find((rank) => normalizedLevel >= rank.minimumLevel) ?? PLAYER_RANKS[0];
};

export const getNextRankForLevel = (level: number): PlayerRank | null => {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return PLAYER_RANKS.find((rank) => rank.minimumLevel > normalizedLevel) ?? null;
};
import type {TranslationKey} from "../i18n/generated/types";
