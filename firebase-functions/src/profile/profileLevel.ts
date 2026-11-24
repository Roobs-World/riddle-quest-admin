import {z} from "zod";
import {PlayerStatsSchema} from "../validation/firestoreSchemas";

const ProfileLevelSchema = z.object({stats: PlayerStatsSchema.pick({level: true}).optional()});

/** Reads the earned level from canonical account progression, including masked profile snapshots. */
export function getProfileLevel(profile: unknown): number {
  const parsed = ProfileLevelSchema.safeParse(profile);
  return parsed.success ? parsed.data.stats?.level ?? 1 : 1;
}
