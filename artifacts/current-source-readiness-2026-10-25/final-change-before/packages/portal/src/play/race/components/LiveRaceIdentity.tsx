import type {LiveRaceView} from "@qwordly/core/race";
import {RankedAvatar} from "../../RankedAvatar";

/** Presents the server-approved lobby identity using the shared earned avatar frame. */
export function LiveRaceIdentity({player}: {
  /** Safe participant projection. */
  player: LiveRaceView["player"];
}) {
  return <div className="live-race-player">
    <RankedAvatar avatarUrl={player.avatarUrl} level={player.level} size={100}
      fallback="👤" fallbackClassName="live-race-avatar" />
    <strong>{player.displayName}</strong>
  </div>;
}
