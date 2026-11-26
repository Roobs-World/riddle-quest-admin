import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {LeaderboardTypeSchema, type LeaderboardEntry, type LeaderboardType} from "../../../src/platform/contracts/requestSchemas.js";

/** Cursors keep a fallback query on the same source for its entire traversal. */
const LeaderboardCursorSchema = z.object({
  type: LeaderboardTypeSchema,
  source: z.enum(["leaderboard", "users", "multiplayer"]),
  score: z.number().finite().nonnegative(),
  userId: z.string().min(1).max(1500).refine(value => !value.includes("/")),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
}).strict();

/** Validated query position, including both fields used by fallback XP ranking. */
export type LeaderboardCursor = z.infer<typeof LeaderboardCursorSchema>;

/** One row paired with the exact stored values used by its query. */
export type PositionedLeaderboardEntry = {entry: LeaderboardEntry; cursor: LeaderboardCursor};

/** Limits cleanup reads while failing explicitly rather than hiding remaining rows. */
export const LEADERBOARD_MAX_SCAN_ROWS = 1000;

/** Parses an opaque cursor before it can change a Firestore query. */
export function decodeLeaderboardCursor(value: string | undefined, type: LeaderboardType): LeaderboardCursor | undefined {
  if (value === undefined) return undefined;
  try {
    const buffer = Buffer.from(value, "base64url");
    if (buffer.toString("base64url") !== value) throw new Error("Noncanonical cursor encoding");
    const decoded = LeaderboardCursorSchema.parse(JSON.parse(buffer.toString("utf8")));
    if (decoded.type !== type || (type === "multiplayerWins") !== (decoded.source === "multiplayer")) {
      throw new Error("Cursor does not match the ranking");
    }
    return decoded;
  } catch {
    throw new HttpsError("invalid-argument", "Invalid leaderboard cursor.");
  }
}

/** Encodes only validated server query values for the next page request. */
export function encodeLeaderboardCursor(cursor: LeaderboardCursor): string {
  return Buffer.from(JSON.stringify(LeaderboardCursorSchema.parse(cursor))).toString("base64url");
}

/** Matches Firestore's descending score and descending document ID order. */
export function compareLeaderboardPositions(left: PositionedLeaderboardEntry, right: PositionedLeaderboardEntry): number {
  return right.cursor.score - left.cursor.score
    || Buffer.compare(Buffer.from(right.cursor.userId), Buffer.from(left.cursor.userId));
}
