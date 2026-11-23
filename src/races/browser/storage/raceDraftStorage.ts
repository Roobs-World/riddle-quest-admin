import {RaceDrafts as SharedRaceDrafts, RACE_DRAFT_KEY, type RaceDraftStorage} from "../../drafts/raceDraftStorage";
import {safeBrowserStorageSet, safeBrowserStorageRemove} from "../../../settings/browser/playerPreferences";
import {observeBrowserStorage} from "../../../platform/browser/storage/browserStorage";
export {RACE_DRAFT_KEY, RACE_DRAFT_TTL_MS, type RaceDraftStorage} from "../../drafts/raceDraftStorage";

/** Browser storage stays outside the shared race controller. */
export const browserRaceDraftStorage: RaceDraftStorage = {
  read: () => observeBrowserStorage("local", RACE_DRAFT_KEY),
  write: value => safeBrowserStorageSet("local", RACE_DRAFT_KEY, value),
  remove: () => safeBrowserStorageRemove("local", RACE_DRAFT_KEY),
};
/** Browser-facing default preserves existing reload behavior. */
export class RaceDrafts extends SharedRaceDrafts {
  /** Optional injected storage remains available to deterministic verification. */
  constructor(storage: RaceDraftStorage = browserRaceDraftStorage) {super(storage);}
}
