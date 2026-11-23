import {createFirebaseRaceMatchmaking} from "../../../../src/races/transport/browser/firebaseRaceMatchmaking";

/** Enables Jest's ticket-bound live safety and human rematches through the shared transport. */
export function createJestRaceMatchmaking() {
  return createFirebaseRaceMatchmaking(undefined, {liveSafety: true, liveRematch: true});
}
