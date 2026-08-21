import type {ActivePresenceState} from "./PlatformPresenceSession";

/** Maps the visible game surface to the privacy-safe presence vocabulary. */
export function resolveActivityPresence(input: {
  raceOpen: boolean;
  hasRiddle: boolean;
  modalOpen: boolean;
}): ActivePresenceState {
  if (input.raceOpen) return "racing";
  if (input.hasRiddle && !input.modalOpen) return "playing";
  return "online";
}
