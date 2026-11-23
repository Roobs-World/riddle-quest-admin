import type {ActivePresenceState} from "./PlatformPresenceSession";

/** Maps the visible game surface to the privacy-safe presence vocabulary. */
export function resolveActivityPresence(input: {
  /** Stores race open. */
  raceOpen: boolean;
  /** Stores has riddle. */
  hasRiddle: boolean;
  /** Stores modal open. */
  modalOpen: boolean;
}): ActivePresenceState {
  if (input.raceOpen) return "racing";
  if (input.hasRiddle && !input.modalOpen) return "playing";
  return "online";
}
