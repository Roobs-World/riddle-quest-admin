import {describe, expect, it} from "@jest/globals";
import {getNextRankForLevel, getRankForLevel, PLAYER_RANKS, RANK_MATERIAL_ORDER} from "../ranks";
import {RANK_FRAME_PATHS, RANK_SYMBOL_PATHS} from "../rankArtwork";

describe("35-rank progression", () => {
  it("has unique identities, custom symbols and frame ornaments in four ordered material bands", () => {
    expect(PLAYER_RANKS).toHaveLength(35);
    expect(new Set(PLAYER_RANKS.map(rank => rank.id)).size).toBe(35);
    expect(new Set(PLAYER_RANKS.map(rank => rank.icon)).size).toBe(35);
    expect(new Set(PLAYER_RANKS.map(rank => RANK_SYMBOL_PATHS[rank.icon])).size).toBe(35);
    expect(new Set(PLAYER_RANKS.map(rank => RANK_FRAME_PATHS[rank.icon])).size).toBe(35);
    expect(RANK_MATERIAL_ORDER.map(material => PLAYER_RANKS.filter(rank => rank.material === material).length)).toEqual([9, 9, 9, 8]);
    expect(PLAYER_RANKS.map(rank => rank.material)).toEqual([
      ...Array(9).fill("bronze"), ...Array(9).fill("silver"), ...Array(9).fill("gold"), ...Array(8).fill("mithril"),
    ]);
    expect(new Set(PLAYER_RANKS.map(rank => rank.color)).size).toBe(4);
  });

  it.each(Array.from({length: 35}, (_, index) => index + 1))("earns the rank at level %i and resolves its next milestone", level => {
    expect(getRankForLevel(level)).toBe(PLAYER_RANKS[level - 1]);
    expect(getRankForLevel(level + 0.9)).toBe(PLAYER_RANKS[level - 1]);
    expect(getNextRankForLevel(level)).toBe(PLAYER_RANKS[level] ?? null);
  });

  it("handles guests, malformed levels, and completion beyond the final rank", () => {
    for (const level of [-10, 0, NaN, Infinity]) {
      expect(getRankForLevel(level)).toBe(PLAYER_RANKS[0]);
      expect(getNextRankForLevel(level)).toBe(PLAYER_RANKS[1]);
    }
    expect(getRankForLevel(100)).toBe(PLAYER_RANKS[34]);
    expect(getNextRankForLevel(100)).toBeNull();
  });
});
