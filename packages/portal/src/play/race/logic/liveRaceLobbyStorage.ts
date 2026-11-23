import {createLiveRaceLobbyStorage as createSharedLobbyStorage, readLiveRaceLobby as readSharedLobby, type LiveRaceLobbyStorage} from "@riddle-quest/hosted/race/logic/liveRaceLobbyStorage";
import {observeBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../../../platform/browserStorage";
import {LIVE_RACE_LOBBY_KEY as KEY} from "./liveRaceLobbyHint";

/** Browser state remains owned by the active web target. */
const storage: LiveRaceLobbyStorage = {
  read: () => observeBrowserStorage("local", KEY),
  write: raw => writeBrowserStorage("local", KEY, raw), remove: () => removeBrowserStorage("local", KEY),
};
/** Resolves the current account's bounded, acknowledged seat selection. */
export function readLiveRaceLobby(ownerId?: string, locale?: string) {return readSharedLobby(ownerId, locale, storage);}
/** Browser wrapper preserves exact-observation ownership across tabs. */
export function createLiveRaceLobbyStorage(ownerId?: string) {return createSharedLobbyStorage(ownerId, storage);}
