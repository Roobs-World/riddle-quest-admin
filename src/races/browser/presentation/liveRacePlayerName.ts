import type {LiveRaceView} from "../../contracts/index";
import {tr} from "../../../localization/browser/i18n";

/** Keeps assigned guest usernames while localising retained legacy bot labels. */
export const liveRacePlayerName = (player: Pick<LiveRaceView["player"], "displayName" | "bot">): string =>
  !player.bot || /^Guest_[A-F0-9]{6}$/.test(player.displayName) ? player.displayName : tr("RaceTo10.LIVE_OPPONENT");
