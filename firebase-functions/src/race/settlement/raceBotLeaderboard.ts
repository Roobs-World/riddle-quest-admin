import {createHash} from "node:crypto";
import {z} from "zod";
import type {LeaderboardEntry} from "../../../../src/platform/contracts/requestSchemas.js";
import {admin} from "../../shared/firebaseAdmin";
import {HttpsError} from "firebase-functions/v2/https";
import {LEADERBOARD_MAX_SCAN_ROWS, type LeaderboardCursor} from "../../gameplay/leaderboardPagination";

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
export async function listRaceBotLeaderboardEntries(
  db: FirebaseFirestore.Firestore,
  limit: number,
  cursor?: LeaderboardCursor,
): Promise<LeaderboardEntry[]> {
  const base = db.collection("raceBotLeaderboard").where("multiplayerWins", ">", 0)
    .orderBy("multiplayerWins", "desc").orderBy(admin.firestore.FieldPath.documentId(), "desc");
  const entries: LeaderboardEntry[] = [];
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  while (entries.length < limit) {
    const batchSize = Math.min(limit - entries.length, LEADERBOARD_MAX_SCAN_ROWS - scanned);
    if (batchSize === 0) throw new HttpsError("resource-exhausted", "Leaderboard cleanup limit reached. Please retry later.");
    const query = lastDocument ? base.startAfter(lastDocument) : cursor ? base.startAfter(cursor.score, cursor.userId) : base;
    const snapshot = await query.limit(batchSize).get();
    for (const document of snapshot.docs) {
      const parsed = RaceBotLeaderboardRecord.safeParse(document.data());
      if (!parsed.success || document.id !== raceBotLeaderboardId(parsed.data.username)) continue;
      const {username, multiplayerWins, updatedAt} = parsed.data;
      entries.push({userId: document.id, username, level: 1, xp: 0, progressScore: 1_000_000_000,
        totalWins: 0, multiplayerWins, bestStreak: 0, updatedAt});
    }
    scanned += snapshot.docs.length;
    if (snapshot.docs.length < batchSize) break;
    lastDocument = snapshot.docs.at(-1);
  }
  return entries;
}
