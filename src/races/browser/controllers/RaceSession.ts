import {RaceSession as SharedRaceSession} from "../../controllers/RaceSession";
import type {RaceSessionEntry, RaceSessionOptions} from "../../controllers/RaceSession.types.ts";
import {clearActiveRace, readActiveRace, saveActiveRace} from "../storage/activeRaceStorage";
import {browserRaceRecovery} from "../storage/raceRecoveryStorage";
import {browserRaceDraftStorage} from "../storage/raceDraftStorage";

/** Supplies browser persistence and clocks to the shared race controller. */
export class RaceSession extends SharedRaceSession {
  /** Each target owns storage, lifecycle and timer integration. */
  constructor(entry: RaceSessionEntry, options: RaceSessionOptions) {
    super(entry, {...options,
      clock: options.clock ?? {now: () => performance.now(), schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: timer => window.clearTimeout(timer)},
      persistence: options.persistence ?? {read: readActiveRace, save: saveActiveRace, clear: clearActiveRace},
      recovery: options.recovery ?? browserRaceRecovery,
      draftStorage: options.draftStorage ?? browserRaceDraftStorage});
  }
}
