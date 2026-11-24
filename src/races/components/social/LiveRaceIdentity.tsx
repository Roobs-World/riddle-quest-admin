import type {LiveRaceView} from "../../contracts/index";
import {RankedAvatar} from "../../../progression/components/ranks/RankedAvatar";
import {liveRacePlayerName} from "../../browser/presentation/liveRacePlayerName";

export type LiveRacePlayerIdentity = Pick<LiveRaceView["player"], "displayName" | "avatarUrl" | "level" | "bot">;

/** Presents cached or server-confirmed identity using the shared earned avatar frame. */
export function LiveRaceIdentity({player}: {
  /** Safe participant projection. */
  player: LiveRacePlayerIdentity;
}) {
  const displayName = liveRacePlayerName(player);
  return <div className="live-race-player">
    <RankedAvatar avatarUrl={player.avatarUrl} level={player.level} size={100}
      fallback={displayName.slice(0, 1).toUpperCase()} />
    <strong>{displayName}</strong>
  </div>;
}
