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

const OverviewRequestSchema = z
  .object({
    userLimit: z.number().int().min(1).max(100).optional(),
    riddleLimit: z.number().int().min(1).max(100).optional(),
  })
  .optional();

const AdjustCoinsRequestSchema = z.object({
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

async function requireAdmin(request: CallableRequest<unknown>): Promise<string> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to access the management portal.");
  }

  if (request.auth.token?.admin === true) {
    return request.auth.uid;
  }

  const adminDoc = await admin.firestore().collection("admins").doc(request.auth.uid).get();
  if (!adminDoc.exists) {
    throw new HttpsError("permission-denied", "This account does not have portal access.");
  }

  return request.auth.uid;
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

/**
 * Returns bounded project health, users, and riddle inventory for admins.
 */
export const getAdminPortalOverview = onCall(
  {cors: true, region: "us-central1"},
  async (request: CallableRequest<unknown>) => {
    try {
      await requireAdmin(request);
      const input = OverviewRequestSchema.parse(request.data);
      const userLimit = input?.userLimit ?? 50;
      const riddleLimit = input?.riddleLimit ?? 60;
      const db = admin.firestore();

      const [userCount, classicCount, userSnapshot, englishRiddles, ...localizedCounts] = await Promise.all([
        getCollectionCount("users"),
        getCollectionCount("riddles"),
        db.collection("users").orderBy("lastLogin", "desc").limit(userLimit).get(),
        db.collection("localizedRiddles/en/riddles").orderBy("classicIndex", "desc").limit(riddleLimit).get(),
        ...SUPPORTED_LOCALES.map(async (locale) => ({
          locale,
          count: await getCollectionCount(`localizedRiddles/${locale}/riddles`),
        })),
      ]);

      const dailyByLocale = await Promise.all(
        SUPPORTED_LOCALES.map(async (locale) => {
          const snapshot = await db.collection(`localizedRiddles/${locale}/riddles`).doc("current").get();
          const data = snapshot.data();
          return {
            locale,
            available: snapshot.exists,
            challengeKey: typeof data?.challengeKey === "string" ? data.challengeKey : null,
            text: typeof data?.text === "string" ? data.text : null,
          };
        }),
      );

      return {
        generatedAt: Date.now(),
        metrics: {
          userCount,
          classicCount,
          localizedRiddleCount: localizedCounts.reduce((total, item) => total + item.count, 0),
          healthyDailyLocales: dailyByLocale.filter((item) => item.available).length,
          localeCount: SUPPORTED_LOCALES.length,
        },
        users: userSnapshot.docs.map(mapUser),
        riddles: englishRiddles.docs.map((doc) => mapRiddle(doc, "en")),
        localizedCounts,
        dailyByLocale,
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
  {cors: true, region: "us-central1"},
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
    secrets: ["OPENAI_API_KEY"],
  },
  async (request: CallableRequest<unknown>) => {
    try {
      await requireAdmin(request);
      const input = z.object({forceGenerate: z.boolean().optional()}).optional().parse(request.data);
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
