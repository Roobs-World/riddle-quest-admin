import {createHash} from "node:crypto";
import {z} from "zod";
import type {LeaderboardEntry} from "../../../../src/platform/contracts/requestSchemas.js";
import {admin} from "../../shared/firebaseAdmin";

/** Only server-confirmed synthetic victories enter this independent ranking. */
const RaceBotLeaderboardRecord = z.object({
  username: z.string().trim().min(1).max(80),
  multiplayerWins: z.number().int().positive(),
  updatedAt: z.number().int().nonnegative(),
});

/** A generated name identifies one fictional opponent across all of its matches. */
function raceBotLeaderboardId(username: string): string {
  return `race-bot-${createHash("sha256").update(username).digest("hex")}`;
}

/** The caller's terminal match receipt makes this atomic increment apply once. */
export function recordRaceBotWin(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  username: string,
  nowMs: number,
): void {
  transaction.set(db.collection("raceBotLeaderboard").doc(raceBotLeaderboardId(username)), {
    username,
    multiplayerWins: admin.firestore.FieldValue.increment(1),
    updatedAt: nowMs,
  }, {merge: true});
}

/** Projects bounded server-owned bot totals without creating player accounts. */
export async function listRaceBotLeaderboardEntries(db: FirebaseFirestore.Firestore, limit: number): Promise<LeaderboardEntry[]> {
  const snapshot = await db.collection("raceBotLeaderboard").where("multiplayerWins", ">", 0)
    .orderBy("multiplayerWins", "desc").limit(limit).get();
  return snapshot.docs.flatMap(document => {
    const parsed = RaceBotLeaderboardRecord.safeParse(document.data());
    if (!parsed.success || document.id !== raceBotLeaderboardId(parsed.data.username)) return [];
    const {username, multiplayerWins, updatedAt} = parsed.data;
    return [{userId: document.id, username, level: 1, xp: 0, progressScore: 1_000_000_000,
      totalWins: 0, multiplayerWins, bestStreak: 0, updatedAt}];
  });
}
