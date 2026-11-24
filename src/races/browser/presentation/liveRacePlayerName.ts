import type {LiveRaceView} from "../../contracts/index";
import {tr} from "../../../localization/browser/i18n";

/** Keeps short assigned usernames and existing guest names while localising legacy bot labels. */
export const liveRacePlayerName = (player: Pick<LiveRaceView["player"], "displayName" | "bot">): string =>
  !player.bot || /^(?:[A-Z][a-z]{1,4}[A-Z][a-z]{1,4}|Guest_[A-F0-9]{6})$/.test(player.displayName)
    ? player.displayName : tr("RaceTo10.LIVE_OPPONENT");
