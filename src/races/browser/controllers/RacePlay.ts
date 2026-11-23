import {RacePlay as SharedRacePlay} from "../../controllers/RacePlay";
export type {RacePlayClock} from "../../controllers/RacePlay";

/** Browser clock adapter for the shared projection and delivery controller. */
export class RacePlay extends SharedRacePlay {
  /** Preserves the browser's monotonic receipt and loader timer integration. */
  constructor(options: ConstructorParameters<typeof SharedRacePlay>[0]) {
    super({...options, clock: options.clock ?? {
      now: () => performance.now(), schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: timer => window.clearTimeout(timer),
    }});
  }
}
