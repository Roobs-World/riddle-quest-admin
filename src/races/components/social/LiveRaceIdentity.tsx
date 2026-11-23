import type {LiveRaceView} from "../../contracts/index";
import {RankedAvatar} from "../../../progression/components/ranks/RankedAvatar";
import {liveRacePlayerName} from "../../browser/presentation/liveRacePlayerName";

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
