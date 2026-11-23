import type {RankIconName} from "../../browser/ranks";
import {RANK_SYMBOL_PATHS} from "./rankArtwork";

/** Renders the rank's custom symbol in profile cards, celebrations, and avatar badges. */
export function RankIcon({name}: {
  /** Symbol earned by the player's progression level. */ name: RankIconName;
}) {
  return <svg aria-hidden="true" focusable="false" className="rank-icon" data-rank-icon={name} fill="none" viewBox="0 0 48 48">
    <path d={RANK_SYMBOL_PATHS[name]} />
  </svg>;
}
