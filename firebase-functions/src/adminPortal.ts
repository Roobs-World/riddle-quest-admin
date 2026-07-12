/**
 * @fileoverview
 * Admin-only callable functions used by the project management portal.
 *
 * Portal clients never receive broad Firestore permissions. Every operation
 * passes through this module, verifies the caller's admin role, and returns a
 * deliberately bounded response.
 */
import * as admin from "firebase-admin";
import {HttpsError, onCall, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {captureException} from "./sentry";
import {generateTodaysDailyChallenge} from "./riddleGeneration";
import {requireAdmin} from "./adminAuth";

const OverviewRequestSchema = z
  .object({
    clerkToken: z.string().min(1).optional(),
    userLimit: z.number().int().min(1).max(100).optional(),
    riddleLimit: z.number().int().min(1).max(100).optional(),
    auditLimit: z.number().int().min(1).max(50).optional(),
    leaderboardLimit: z.number().int().min(1).max(25).optional(),
  })
  .optional();

const AdjustCoinsRequestSchema = z.object({
  clerkToken: z.string().min(1).optional(),
  userId: z.string().min(1),
  delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(200),
});

type PortalUser = {
  userId: string;
  username: string;
  email: string;
  coins: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  classicIndex: number;
  preferredLanguage: string;
  lastLogin: number | null;
};

type PortalRiddle = {
  riddleId: string;
  text: string;
  answer: string;
  locale: string;
  category: string;
  index: number | null;
  challengeKey: string | null;
};

type PortalLeaderboardEntry = {
  userId: string;
  username: string;
  level: number;
  xp: number;
  totalWins: number;
  bestStreak: number;
  updatedAt: number | null;
};

type PortalAuditEvent = {
  auditId: string;
  action: string;
  adminUserId: string;
  targetUserId: string;
  delta: number | null;
  previousBalance: number | null;
  newBalance: number | null;
  reason: string;
  createdAt: number | null;
};

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const timestamp = value as {toMillis?: () => number; toDate?: () => Date};
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  }
  return null;
}

async function getCollectionCount(path: string): Promise<number> {
  const result = await admin.firestore().collection(path).count().get();
  return result.data().count;
}

function mapUser(doc: FirebaseFirestore.QueryDocumentSnapshot): PortalUser {
  const data = doc.data();
  return {
    userId: doc.id,
    username: typeof data.username === "string" ? data.username : "Unknown player",
    email: typeof data.email === "string" ? data.email : "",
    coins: typeof data.coins === "number" ? data.coins : 0,
    gamesPlayed: typeof data.stats?.gamesPlayed === "number" ? data.stats.gamesPlayed : 0,
    wins: typeof data.stats?.wins === "number" ? data.stats.wins : 0,
    winRate: typeof data.stats?.winRate === "number" ? data.stats.winRate : 0,
    classicIndex: typeof data.progress?.classicIndex === "number" ? data.progress.classicIndex : 0,
    preferredLanguage: typeof data.preferredLanguage === "string" ? data.preferredLanguage : "en",
    lastLogin: toMillis(data.lastLogin),
  };
}

function mapRiddle(doc: FirebaseFirestore.QueryDocumentSnapshot, locale: string): PortalRiddle {
  const data = doc.data();
  const rawIndex = data.classicIndex ?? data.dailyIndex;
  return {
    riddleId: doc.id,
    text: typeof data.text === "string" ? data.text : "",
    answer: typeof data.answer === "string" ? data.answer : "",
    locale,
    category: typeof data.category === "string" ? data.category : doc.id === "current" ? "daily" : "classic",
    index: typeof rawIndex === "number" ? rawIndex : null,
    challengeKey: typeof data.challengeKey === "string" ? data.challengeKey : null,
  };
}

function mapLeaderboardEntry(doc: FirebaseFirestore.QueryDocumentSnapshot): PortalLeaderboardEntry {
  const data = doc.data();
  return {
    userId: typeof data.userId === "string" ? data.userId : doc.id,
    username: typeof data.username === "string" ? data.username : "Player",
    level: typeof data.level === "number" ? data.level : 1,
    xp: typeof data.xp === "number" ? data.xp : 0,
    totalWins: typeof data.totalWins === "number" ? data.totalWins : 0,
    bestStreak: typeof data.bestStreak === "number" ? data.bestStreak : 0,
    updatedAt: toMillis(data.updatedAt),
  };
}

function mapAuditEvent(doc: FirebaseFirestore.QueryDocumentSnapshot): PortalAuditEvent {
  const data = doc.data();
  return {
    auditId: doc.id,
    action: typeof data.action === "string" ? data.action : "unknown",
    adminUserId: typeof data.adminUserId === "string" ? data.adminUserId : "",
    targetUserId: typeof data.targetUserId === "string" ? data.targetUserId : "",
    delta: typeof data.delta === "number" ? data.delta : null,
    previousBalance: typeof data.previousBalance === "number" ? data.previousBalance : null,
    newBalance: typeof data.newBalance === "number" ? data.newBalance : null,
    reason: typeof data.reason === "string" ? data.reason : "",
    createdAt: toMillis(data.createdAt),
  };
}

async function getLeaderboardSnapshot(
  db: FirebaseFirestore.Firestore,
  limit: number,
): Promise<Record<"xp" | "totalWins" | "bestStreak", PortalLeaderboardEntry[]>> {
  const baseRef = db.collection("leaderboard");
  const [xp, totalWins, bestStreak] = await Promise.all([
    baseRef.orderBy("progressScore", "desc").limit(limit).get(),
    baseRef.orderBy("totalWins", "desc").limit(limit).get(),
    baseRef.orderBy("bestStreak", "desc").limit(limit).get(),
  ]);

  return {
    xp: xp.docs.map(mapLeaderboardEntry),
    totalWins: totalWins.docs.map(mapLeaderboardEntry),
    bestStreak: bestStreak.docs.map(mapLeaderboardEntry),
  };
}

/**
 * Returns bounded project health, users, and riddle inventory for admins.
 */
export const getAdminPortalOverview = onCall(
  {cors: true, region: "us-central1", secrets: ["CLERK_SECRET_KEY"]},
  async (request: CallableRequest<unknown>) => {
    try {
      await requireAdmin(request);
      const input = OverviewRequestSchema.parse(request.data);
      const userLimit = input?.userLimit ?? 50;
      const riddleLimit = input?.riddleLimit ?? 60;
      const auditLimit = input?.auditLimit ?? 20;
      const leaderboardLimit = input?.leaderboardLimit ?? 10;
      const db = admin.firestore();

      const [
        userCount,
        classicCount,
        userSnapshot,
        englishRiddles,
        localizedCounts,
        dailyByLocale,
        auditSnapshot,
        leaderboard,
      ] = await Promise.all([
        getCollectionCount("users"),
        getCollectionCount("riddles"),
        db.collection("users").orderBy("lastLogin", "desc").limit(userLimit).get(),
        db.collection("localizedRiddles/en/riddles").orderBy("classicIndex", "desc").limit(riddleLimit).get(),
        Promise.all(
          SUPPORTED_LOCALES.map(async (locale) => ({
            locale,
            count: await getCollectionCount(`localizedRiddles/${locale}/riddles`),
          })),
        ),
        Promise.all(SUPPORTED_LOCALES.map(async (locale) => {
          const snapshot = await db.collection(`localizedRiddles/${locale}/riddles`).doc("current").get();
          const data = snapshot.data();
          return {
            locale,
            available: snapshot.exists,
            challengeKey: typeof data?.challengeKey === "string" ? data.challengeKey : null,
            text: typeof data?.text === "string" ? data.text : null,
          };
        })),
        db.collection("adminAuditLog").orderBy("createdAt", "desc").limit(auditLimit).get(),
        getLeaderboardSnapshot(db, leaderboardLimit),
      ]);

      const users = userSnapshot.docs.map(mapUser);
      const riddles = englishRiddles.docs.map((doc) => mapRiddle(doc, "en"));
      const activeWindowStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const activeUsersLoaded = users.filter((user) => (user.lastLogin ?? 0) >= activeWindowStart).length;
      const totalCoinsLoaded = users.reduce((total, user) => total + user.coins, 0);

      return {
        generatedAt: Date.now(),
        metrics: {
          userCount,
          classicCount,
          localizedRiddleCount: localizedCounts.reduce((total, item) => total + item.count, 0),
          healthyDailyLocales: dailyByLocale.filter((item) => item.available).length,
          localeCount: SUPPORTED_LOCALES.length,
          activeUsersLoaded,
          totalCoinsLoaded,
          auditEventsLoaded: auditSnapshot.docs.length,
        },
        users,
        riddles,
        localizedCounts,
        dailyByLocale,
        auditLog: auditSnapshot.docs.map(mapAuditEvent),
        leaderboard,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      captureException(error, {functionName: "getAdminPortalOverview"});
      throw new HttpsError("internal", "Unable to load portal data.");
    }
  },
);

/**
 * Applies an audited coin correction without allowing negative balances.
 */
export const adjustAdminUserCoins = onCall(
  {cors: true, region: "us-central1", secrets: ["CLERK_SECRET_KEY"]},
  async (request: CallableRequest<unknown>) => {
    try {
      const adminUserId = await requireAdmin(request);
      const input = AdjustCoinsRequestSchema.parse(request.data);
      const db = admin.firestore();
      const userRef = db.collection("users").doc(input.userId);
      const auditRef = db.collection("adminAuditLog").doc();

      const newBalance = await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) {
          throw new HttpsError("not-found", "Player not found.");
        }

        const currentBalance = userSnapshot.data()?.coins;
        const safeCurrentBalance = typeof currentBalance === "number" ? currentBalance : 0;
        const nextBalance = safeCurrentBalance + input.delta;
        if (nextBalance < 0) {
          throw new HttpsError("failed-precondition", "Coin balance cannot be negative.");
        }

        transaction.update(userRef, {coins: nextBalance});
        transaction.set(auditRef, {
          action: "adjust-user-coins",
          adminUserId,
          targetUserId: input.userId,
          delta: input.delta,
          previousBalance: safeCurrentBalance,
          newBalance: nextBalance,
          reason: input.reason,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return nextBalance;
      });

      return {success: true, newBalance};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof z.ZodError) {
        throw new HttpsError("invalid-argument", "Invalid coin adjustment request.", error.flatten());
      }
      captureException(error, {functionName: "adjustAdminUserCoins"});
      throw new HttpsError("internal", "Unable to adjust the player's coins.");
    }
  },
);

/**
 * Generates the daily challenge through an admin-authenticated web-safe entrypoint.
 */
export const generateAdminDailyChallenge = onCall(
  {
    cors: true,
    region: "us-central1",
    timeoutSeconds: 540,
    secrets: ["OPENAI_API_KEY", "CLERK_SECRET_KEY"],
  },
  async (request: CallableRequest<unknown>) => {
    try {
      await requireAdmin(request);
      const input = z.object({
        clerkToken: z.string().min(1).optional(),
        forceGenerate: z.boolean().optional(),
      }).optional().parse(request.data);
      await generateTodaysDailyChallenge(input?.forceGenerate ?? false);
      return {
        success: true,
        message: input?.forceGenerate
          ? "Today's daily challenge was regenerated."
          : "Today's daily challenge is available.",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof z.ZodError) {
        throw new HttpsError("invalid-argument", "Invalid generation request.", error.flatten());
      }
      captureException(error, {functionName: "generateAdminDailyChallenge"});
      throw new HttpsError("internal", "Unable to generate today's daily challenge.");
    }
  },
);
