import {createFirebaseRaceMatchmaking} from "../../../../packages/web-game/src/play/firebaseRaceMatchmaking";

/** Enables Jest's ticket-bound live safety and human rematches through the shared transport. */
export function createJestRaceMatchmaking() {
  return createFirebaseRaceMatchmaking(undefined, {liveSafety: true, liveRematch: true});
}
