import {LiveRaceChallengeIdSchema} from "../../../../../src/core/race";

/** Creates a native invitation only for an opaque server-issued private lobby. */
export const liveRaceInvitationUrl = (challengeId: string): string =>
  `riddlequest://race?challengeId=${LiveRaceChallengeIdSchema.parse(challengeId)}`;

/** Accepts the exact app scheme and one validated invitation, never arbitrary navigation. */
export function parseLiveRaceInvitationUrl(value: string): string | null {
  if (value.length > 512 || !/^riddlequest:\/\/race\?challengeId=live_[a-f0-9]{64}$/.test(value)) return null;
  /** Invitation handle validated independently of arbitrary navigation input. */
  const parsed = LiveRaceChallengeIdSchema.safeParse(value.slice("riddlequest://race?challengeId=".length));
  return parsed.success ? parsed.data : null;
}
