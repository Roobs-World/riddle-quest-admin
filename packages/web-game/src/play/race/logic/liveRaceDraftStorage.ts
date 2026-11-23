import {createLiveRaceDraftStorage as createSharedDraftStorage, liveRaceDraftKey, type LiveRaceDraftStorage} from "@riddle-quest/hosted/race/logic/liveRaceDraftStorage";
import {observeBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../../../platform/browserStorage";
export {LIVE_RACE_DRAFT_TTL_MS, liveRaceDraftKey, type LiveRaceDraftStorage} from "@riddle-quest/hosted/race/logic/liveRaceDraftStorage";

/** Connects the shared checkpoint owner to optional browser storage. */
export function createLiveRaceDraftStorage(ownerId?: string, injected?: LiveRaceDraftStorage, now = Date.now) {
  /** Account-specific keys retain the existing browser checkpoint format. */
  const key = ownerId ? liveRaceDraftKey(ownerId) : "";
  return createSharedDraftStorage(ownerId, injected ?? {
    read: () => observeBrowserStorage("local", key),
    write: raw => writeBrowserStorage("local", key, raw), remove: () => removeBrowserStorage("local", key),
  }, now);
}
