import {RaceSession as SharedRaceSession} from "@riddle-quest/hosted/race/RaceSession";
import type {RaceSessionEntry, RaceSessionOptions} from "@riddle-quest/hosted/race/RaceSession.types";
import {clearActiveRace, readActiveRace, saveActiveRace} from "./logic/activeRaceStorage";
import {browserRaceRecovery} from "./logic/raceRecoveryStorage";
import {browserRaceDraftStorage} from "./logic/raceDraftStorage";

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
