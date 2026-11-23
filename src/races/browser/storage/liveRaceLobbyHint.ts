import {hasLiveRaceLobby as hasSharedLobby, LIVE_RACE_LOBBY_KEY} from "../../recovery/liveRaceLobbyHint";
import {observeBrowserStorage} from "../../../platform/browser/storage/browserStorage";
export {LIVE_RACE_LOBBY_KEY} from "../../recovery/liveRaceLobbyHint";

/** The browser startup hint never reads native or another target's storage. */
export function hasLiveRaceLobby(ownerId?: string, locale?: string): boolean {
  return hasSharedLobby(ownerId, locale, () => observeBrowserStorage("local", LIVE_RACE_LOBBY_KEY));
}
