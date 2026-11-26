import {createHostedPlaySession} from "../../../../src/app/session/HostedPlaySession";

/** Assembles the Jest launch policy independently of other Web Targets. */
export function createJestHostedPlaySession(input: Parameters<typeof createHostedPlaySession>[0]) {
  return createHostedPlaySession({...input, initialGameMode: "challenge"});
}
