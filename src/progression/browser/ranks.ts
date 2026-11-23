import type {RankSymbolName} from "../components/ranks/rankArtwork";

/** Custom symbol with matching avatar artwork. */
export type RankIconName = RankSymbolName;
/** Ordered materials earned through player progression. */
export type RankMaterial = "bronze" | "silver" | "gold" | "mithril";

/** Catalogue order matches the earned material progression. */
export const RANK_MATERIAL_ORDER: readonly RankMaterial[] = ["bronze", "silver", "gold", "mithril"];

/** One progression milestone shared by all rank and avatar surfaces. */
export interface PlayerRank {
  /** Stable identity for the earned rank. */ id: string;
  /** First player level that earns this rank. */ minimumLevel: number;
  /** Localized rank name. */ nameKey: string;
  /** Localized description of the rank's achievement. */ descriptionKey: string;
  /** Individually drawn symbol and frame ornament. */ icon: RankIconName;
  /** Material band for the frame. */ material: RankMaterial;
  /** Localized material name. */ materialKey: string;
  /** Dark metal outline. */ color: string;
  /** Main metal finish. */ glowColor: string;
  /** Bright reflection for the metal gradient. */ highlightColor: string;
}

/** Shared metal palettes keep each tier recognizable on every surface. */
const RANK_MATERIALS = {
  "bronze": {
    "color": "#835127",
    "glowColor": "#D69A61",
    "highlightColor": "#FFE1BC"
  },
  "silver": {
    "color": "#566877",
    "glowColor": "#BCCAD8",
    "highlightColor": "#F1F6FF"
  },
  "gold": {
    "color": "#91600C",
    "glowColor": "#EDC05B",
    "highlightColor": "#FFF2B7"
  },
  "mithril": {
    "color": "#176B86",
    "glowColor": "#90E5EA",
    "highlightColor": "#EDFFFF"
  }
} as const;

/** Exactly 35 milestones, one per level, progressing from bronze to mithril. */
const RANK_MILESTONES = [
  {id: "stargazer", minimumLevel: 1, nameKey: "Ranks.STARGAZER_NAME", descriptionKey: "Ranks.STARGAZER_DESCRIPTION", icon: "telescope", material: "bronze"},
  {id: "emberSeeker", minimumLevel: 2, nameKey: "Ranks.EMBER_SEEKER_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "flame", material: "bronze"},
  {id: "pathfinder", minimumLevel: 3, nameKey: "Ranks.PATHFINDER_NAME", descriptionKey: "Ranks.PATHFINDER_DESCRIPTION", icon: "compass-rose", material: "bronze"},
  {id: "clueKeeper", minimumLevel: 4, nameKey: "Ranks.CLUE_KEEPER_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "key", material: "bronze"},
  {id: "runeReader", minimumLevel: 5, nameKey: "Ranks.RUNE_READER_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "rune", material: "bronze"},
  {id: "riddleScout", minimumLevel: 6, nameKey: "Ranks.RIDDLE_SCOUT_NAME", descriptionKey: "Ranks.RIDDLE_SCOUT_DESCRIPTION", icon: "map-marker-path", material: "bronze"},
  {id: "trailWarden", minimumLevel: 7, nameKey: "Ranks.TRAIL_WARDEN_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "tree", material: "bronze"},
  {id: "puzzleAdept", minimumLevel: 8, nameKey: "Ranks.PUZZLE_ADEPT_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "puzzle", material: "bronze"},
  {id: "bronzeSentinel", minimumLevel: 9, nameKey: "Ranks.BRONZE_SENTINEL_NAME", descriptionKey: "Ranks.BRONZE_DESCRIPTION", icon: "tower", material: "bronze"},
  {id: "cipherKnight", minimumLevel: 10, nameKey: "Ranks.CIPHER_KNIGHT_NAME", descriptionKey: "Ranks.CIPHER_KNIGHT_DESCRIPTION", icon: "shield-star", material: "silver"},
  {id: "wordsmith", minimumLevel: 11, nameKey: "Ranks.WORDSMITH_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "quill", material: "silver"},
  {id: "scrollScholar", minimumLevel: 12, nameKey: "Ranks.SCROLL_SCHOLAR_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "scroll", material: "silver"},
  {id: "codeBreaker", minimumLevel: 13, nameKey: "Ranks.CODE_BREAKER_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "broken-lock", material: "silver"},
  {id: "silverRanger", minimumLevel: 14, nameKey: "Ranks.SILVER_RANGER_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "bow", material: "silver"},
  {id: "oracle", minimumLevel: 15, nameKey: "Ranks.ORACLE_NAME", descriptionKey: "Ranks.ORACLE_DESCRIPTION", icon: "crystal-ball", material: "silver"},
  {id: "patternWeaver", minimumLevel: 16, nameKey: "Ranks.PATTERN_WEAVER_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "knot", material: "silver"},
  {id: "labyrinthGuide", minimumLevel: 17, nameKey: "Ranks.LABYRINTH_GUIDE_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "maze", material: "silver"},
  {id: "silverGuardian", minimumLevel: 18, nameKey: "Ranks.SILVER_GUARDIAN_NAME", descriptionKey: "Ranks.SILVER_DESCRIPTION", icon: "helmet", material: "silver"},
  {id: "goldenSeeker", minimumLevel: 19, nameKey: "Ranks.GOLDEN_SEEKER_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "sun", material: "gold"},
  {id: "loreMaster", minimumLevel: 20, nameKey: "Ranks.LORE_MASTER_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "book", material: "gold"},
  {id: "luminary", minimumLevel: 21, nameKey: "Ranks.LUMINARY_NAME", descriptionKey: "Ranks.LUMINARY_DESCRIPTION", icon: "star-four-points", material: "gold"},
  {id: "riddleChampion", minimumLevel: 22, nameKey: "Ranks.RIDDLE_CHAMPION_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "trophy", material: "gold"},
  {id: "cipherSage", minimumLevel: 23, nameKey: "Ranks.CIPHER_SAGE_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "eye", material: "gold"},
  {id: "starForger", minimumLevel: 24, nameKey: "Ranks.STAR_FORGER_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "anvil", material: "gold"},
  {id: "goldenSovereign", minimumLevel: 25, nameKey: "Ranks.GOLDEN_SOVEREIGN_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "sceptre", material: "gold"},
  {id: "dawnHerald", minimumLevel: 26, nameKey: "Ranks.DAWN_HERALD_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "horn", material: "gold"},
  {id: "sunKeeper", minimumLevel: 27, nameKey: "Ranks.SUN_KEEPER_NAME", descriptionKey: "Ranks.GOLD_DESCRIPTION", icon: "winged-sun", material: "gold"},
  {id: "astralSage", minimumLevel: 28, nameKey: "Ranks.ASTRAL_SAGE_NAME", descriptionKey: "Ranks.ASTRAL_SAGE_DESCRIPTION", icon: "weather-night", material: "mithril"},
  {id: "mithrilWarden", minimumLevel: 29, nameKey: "Ranks.MITHRIL_WARDEN_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "crystal-shield", material: "mithril"},
  {id: "voidWalker", minimumLevel: 30, nameKey: "Ranks.VOID_WALKER_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "portal", material: "mithril"},
  {id: "celestialSeer", minimumLevel: 31, nameKey: "Ranks.CELESTIAL_SEER_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "constellation", material: "mithril"},
  {id: "runeSovereign", minimumLevel: 32, nameKey: "Ranks.RUNE_SOVEREIGN_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "rune-crown", material: "mithril"},
  {id: "infinitySage", minimumLevel: 33, nameKey: "Ranks.INFINITY_SAGE_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "infinity", material: "mithril"},
  {id: "mythicArchitect", minimumLevel: 34, nameKey: "Ranks.MYTHIC_ARCHITECT_NAME", descriptionKey: "Ranks.MITHRIL_DESCRIPTION", icon: "pyramid", material: "mithril"},
  {id: "questLegend", minimumLevel: 35, nameKey: "Ranks.QUEST_LEGEND_NAME", descriptionKey: "Ranks.QUEST_LEGEND_DESCRIPTION", icon: "crown", material: "mithril"},
] satisfies readonly Omit<PlayerRank, "materialKey" | "color" | "glowColor" | "highlightColor">[];

/** Completes each milestone with the material palette and translated tier label. */
export const PLAYER_RANKS: readonly PlayerRank[] = RANK_MILESTONES.map(rank => ({...rank, materialKey: `Ranks.${rank.material.toUpperCase()}`, ...RANK_MATERIALS[rank.material]}));

/** Resolves earned progression, including guests and levels beyond the last rank. */
export const getRankForLevel = (level: number): PlayerRank => {
  /** Non-finite input uses the guest rank instead of falsely granting the final rank. */
  const normalizedLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return PLAYER_RANKS[Math.min(normalizedLevel, PLAYER_RANKS.length) - 1];
};

/** Returns the next milestone or null once all 35 ranks are earned. */
export const getNextRankForLevel = (level: number): PlayerRank | null => {
  /** Uses the same normalization as the current-rank resolver. */
  const normalizedLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return PLAYER_RANKS[normalizedLevel] ?? null;
};
