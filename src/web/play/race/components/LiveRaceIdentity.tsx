import type {LiveRaceView} from "../../../../core/race";
import {RankedAvatar} from "../../RankedAvatar";
import {liveRacePlayerName} from "../logic/liveRacePlayerName";

/** Presents the server-approved lobby identity using the shared earned avatar frame. */
export function LiveRaceIdentity({player}: {
  /** Safe participant projection. */
  player: LiveRaceView["player"];
}) {
  return <div className="live-race-player">
    <RankedAvatar avatarUrl={player.avatarUrl} level={player.level} size={100}
      fallback="👤" fallbackClassName="live-race-avatar" />
    <strong>{liveRacePlayerName(player)}</strong>
  </div>;
}
