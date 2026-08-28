import type {
  PlatformBootstrap,
  PlatformPreferences,
  PlatformResult,
  PlatformSession,
  PlatformStorage,
  PlayerData,
} from "../platform/types";
import {parsePlayerData} from "../platform/playerDataValidation";
import {
  FindRedditRaceMatchResponseSchema,
  ListFacebookTournamentResponseSchema,
  RecordFacebookTournamentRunResponseSchema,
  type RaceLocale,
} from "@qwordly/core/race";
import {REDDIT_GOLD_PRODUCTS, resolveRedditGoldProduct} from "@qwordly/core/pricing/redditCatalog";
import {purchase} from "@devvit/payments/client";

/** Defines the guest key value. */
const GUEST_KEY = "riddleQuestRedditGuestV1";
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses preferences. */
const parsePreferences = (value: unknown): PlatformPreferences => {
  if (!isRecord(value)) return {};
  return {
    ...(typeof value.locale === "string" && value.locale.length <= 32 ? {locale: value.locale} : {}),
    ...(typeof value.muted === "boolean" ? {muted: value.muted} : {}),
    ...(typeof value.reducedMotion === "boolean" ? {reducedMotion: value.reducedMotion} : {}),
    ...(typeof value.highContrast === "boolean" ? {highContrast: value.highContrast} : {}),
    ...(typeof value.onboardingComplete === "boolean" ? {onboardingComplete: value.onboardingComplete} : {}),
    ...(typeof value.firstMilestoneMarked === "boolean" ? {firstMilestoneMarked: value.firstMilestoneMarked} : {}),
    ...(typeof value.presenceEnabled === "boolean" ? {presenceEnabled: value.presenceEnabled} : {}),
  };
};

/** Selects the guest settings that are safe to carry across Reddit's login reload. */
export const selectMigratableGuestPreferences = (preferences: PlatformPreferences): PlatformPreferences => ({
  ...(preferences.locale === undefined ? {} : {locale: preferences.locale}),
  ...(preferences.muted === undefined ? {} : {muted: preferences.muted}),
  ...(preferences.reducedMotion === undefined ? {} : {reducedMotion: preferences.reducedMotion}),
  ...(preferences.highContrast === undefined ? {} : {highContrast: preferences.highContrast}),
  ...(preferences.onboardingComplete === undefined ? {} : {onboardingComplete: preferences.onboardingComplete}),
});

/** Provides post reddit gateway behavior. */
export const postRedditGateway = async (path: string, body: unknown = {}): Promise<Record<string, unknown>> => {
  /** Provides response behavior. */
  const response = await fetch(path, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  /** Provides payload behavior. */
  const payload: unknown = await response.json();
  if (!response.ok || !isRecord(payload) || payload.ok !== true) throw new Error("reddit-gateway-request-failed");
  return payload;
};

/** Provides reddit server storage behavior. */
class RedditServerStorage implements PlatformStorage {
  /** Reads preferences. */
  async readPreferences(): Promise<PlatformPreferences> {
    return parsePreferences((await postRedditGateway("/api/storage/read")).preferences);
  }
  /** Provides write preferences behavior. */
  async writePreferences(preferences: PlatformPreferences): Promise<void> {
    await postRedditGateway("/api/storage/write", {preferences});
  }
  /** Reads player data. */
  async readPlayerData(): Promise<PlayerData | null> {
    return parsePlayerData((await postRedditGateway("/api/storage/read")).playerData);
  }
  /** Provides write player data behavior. */
  async writePlayerData(playerData: PlayerData): Promise<void> {
    await postRedditGateway("/api/storage/write", {playerData});
  }
  /** Provides clear behavior. */
  async clear(): Promise<void> {
    await postRedditGateway("/api/storage/clear");
  }
  /** Provides flush behavior. */
  async flush(): Promise<void> {
    /* Writes resolve only after the gateway acknowledges Firebase. */
  }
}

/** Provides reddit guest storage behavior. */
class RedditGuestStorage implements PlatformStorage {
  /** Reads raw. */
  private readRaw(): {
    /** Stores preferences. */
    preferences: PlatformPreferences; /** Stores player data. */
    /** Stores player data. */
    playerData: unknown;
  } {
    try {
      /** Parses d. */
      const parsed: unknown = JSON.parse(window.localStorage.getItem(GUEST_KEY) ?? "null");
      if (!isRecord(parsed)) return {preferences: {}, playerData: null};
      return {preferences: parsePreferences(parsed.preferences), playerData: parsed.playerData ?? null};
    } catch {
      return {preferences: {}, playerData: null};
    }
  }
  /** Reads preferences. */
  async readPreferences() {
    return this.readRaw().preferences;
  }
  /** Provides write preferences behavior. */
  async writePreferences(preferences: PlatformPreferences) {
    window.localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({...this.readRaw(), preferences: parsePreferences(preferences)}),
    );
  }
  /** Reads player data. */
  async readPlayerData() {
    return parsePlayerData(this.readRaw().playerData);
  }
  /** Provides write player data behavior. */
  async writePlayerData(playerData: PlayerData) {
    /** Parses d. */
    const parsed = await parsePlayerData(playerData);
    window.localStorage.setItem(GUEST_KEY, JSON.stringify({...this.readRaw(), playerData: parsed}));
  }
  /** Provides clear behavior. */
  async clear() {
    window.localStorage.removeItem(GUEST_KEY);
  }
  /** Provides flush behavior. */
  async flush() {
    /* localStorage writes synchronously. */
  }
}

/** Provides success behavior. */
const success = <T>(value: T): PlatformResult<T> => ({status: "success", value});
/** Reads commerce recovery scope. */
const readCommerceRecoveryScope = async (): Promise<{
  /** Stores key. */
  key: string; /** Stores metadata key. */
  /** Stores metadata key. */
  metadataKey: string;
}> => {
  /** Provides payload behavior. */
  const payload = await postRedditGateway("/api/commerce/key");
  if (
    typeof payload.key !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(payload.key) ||
    payload.metadataKey !== "riddle-account"
  )
    throw new Error("invalid-reddit-commerce-recovery-scope");
  return {key: payload.key, metadataKey: payload.metadataKey};
};
/** Provides feature names behavior. */
const featureNames = [
  "identity",
  "gameplay",
  "commerce",
  "referrals",
  "notifications",
  "matchmaking",
  "tournaments",
  "presence",
] as const;

/** Indicates whether has enabled authenticated gameplay. */
const hasEnabledAuthenticatedGameplay = (session: Record<string, unknown>): boolean => {
  if (session.authenticated !== true || !isRecord(session.features)) return false;
  /** Provides features behavior. */
  const features = session.features;
  if (
    Object.keys(features).length !== featureNames.length ||
    featureNames.some((name) => typeof features[name] !== "boolean")
  )
    return false;
  return (
    features.identity === true &&
    features.gameplay === true &&
    Number.isSafeInteger(session.accountGeneration) &&
    (session.accountGeneration as number) >= 1 &&
    (session.accountGeneration as number) <= 1_000_000
  );
};

/** Initializes a Reddit session without exposing Reddit identity or Firebase credentials to the browser. */
export class RedditPlatformBootstrap implements PlatformBootstrap {
  /** Provides initialize behavior. */
  async initialize(reportProgress: (progress: number) => void): Promise<PlatformResult<PlatformSession>> {
    try {
      reportProgress(20);
      /** Provides session behavior. */
      const session = await postRedditGateway("/api/session");
      /** Provides authenticated behavior. */
      const authenticated = hasEnabledAuthenticatedGameplay(session);
      /** Provides guest storage behavior. */
      const guestStorage = new RedditGuestStorage();
      /** Provides storage behavior. */
      const storage = authenticated ? new RedditServerStorage() : guestStorage;
      /** Provides initial preferences behavior. */
      let initialPreferences: PlatformPreferences;
      if (authenticated) {
        /** Provides guest preferences behavior. */
        const guestPreferences = selectMigratableGuestPreferences(await guestStorage.readPreferences());
        /** Provides server preferences behavior. */
        const serverPreferences = await storage.readPreferences();
        initialPreferences = {...guestPreferences, ...serverPreferences};
        if (Object.keys(guestPreferences).length > 0) {
          await storage.writePreferences(initialPreferences);
        }
        // Guest profile/game snapshots are intentionally never promoted to an authenticated account.
        await guestStorage.clear();
        if ((session.features as Record<string, boolean>).commerce) {
          // Recovery is best-effort and independently gated; an unavailable
          // payment service must never prevent core play from starting.
          await postRedditGateway("/api/commerce/recover").catch(() => undefined);
        }
      } else {
        initialPreferences = await storage.readPreferences();
      }
      reportProgress(80);
      /** Provides lifecycle behavior. */
      const lifecycle = {
        /** Provides on pause behavior. */
        onPause(callback: () => void | Promise<void>) {
          /** Lists ener. */
          const listener = () => {
            if (document.visibilityState === "hidden") void callback();
          };
          document.addEventListener("visibilitychange", listener);
          return () => document.removeEventListener("visibilitychange", listener);
        },
        /** Provides on resume behavior. */
        onResume(callback: () => void | Promise<void>) {
          /** Lists ener. */
          const listener = () => {
            if (document.visibilityState === "visible") void callback();
          };
          document.addEventListener("visibilitychange", listener);
          return () => document.removeEventListener("visibilitychange", listener);
        },
      };
      reportProgress(100);
      return success({
        platform: "reddit",
        playerId: authenticated ? "reddit-account" : "reddit-guest",
        storage,
        initialPreferences,
        capabilities: {
          lifecycle,
          ...(authenticated && (session.features as Record<string, boolean>).commerce
            ? {
                commerce: {
                  /** Lists products. */
                  async listProducts() {
                    return success(
                      REDDIT_GOLD_PRODUCTS.map((product) => ({
                        id: product.productId,
                        title: product.coins.toLocaleString(),
                        description: "",
                        price: `${product.goldCost} Gold`,
                        kind: "consumable" as const,
                      })),
                    );
                  },
                  /** Provides purchase behavior. */
                  async purchase(productId: string) {
                    try {
                      resolveRedditGoldProduct(productId);
                      /** Provides recovery behavior. */
                      const recovery = await readCommerceRecoveryScope();
                      /** Provides result behavior. */
                      const result = await purchase(productId, {[recovery.metadataKey]: recovery.key});
                      if (result.status === 0) return {status: "cancelled" as const};
                      if (result.status !== 1 || typeof result.orderId !== "string" || !result.orderId) {
                        return {status: "retryable-failure" as const, message: "reddit-purchase-failed"};
                      }
                      return success({providerReceiptId: result.orderId});
                    } catch (error) {
                      return {
                        status: "retryable-failure" as const,
                        message: error instanceof Error ? error.message : "reddit-purchase-failed",
                      };
                    }
                  },
                  /** Provides recover behavior. */
                  async recover() {
                    try {
                      await postRedditGateway("/api/commerce/recover");
                      return success(undefined);
                    } catch (error) {
                      return {
                        status: "retryable-failure" as const,
                        message: error instanceof Error ? error.message : "reddit-purchase-recovery-failed",
                      };
                    }
                  },
                },
              }
            : {}),
          ...(authenticated && (session.features as Record<string, boolean>).matchmaking
            ? {
                matchmaking: {
                  /** Provides find behavior. */
                  async find(locale: RaceLocale) {
                    try {
                      /** Provides payload behavior. */
                      const payload = await postRedditGateway("/api/game/race.match", {locale});
                      return success(FindRedditRaceMatchResponseSchema.parse(payload.result));
                    } catch (error) {
                      return {
                        status: "retryable-failure" as const,
                        message: error instanceof Error ? error.message : "reddit-matchmaking-failed",
                      };
                    }
                  },
                },
              }
            : {}),
          ...(authenticated && (session.features as Record<string, boolean>).tournaments
            ? {
                tournaments: {
                  /** Provides list behavior. */
                  async list(locale: RaceLocale) {
                    /** Provides payload behavior. */
                    const payload = await postRedditGateway("/api/game/tournament.list", {locale});
                    return ListFacebookTournamentResponseSchema.parse(payload.result);
                  },
                  /** Provides record behavior. */
                  async record(runId: string, locale: RaceLocale) {
                    /** Provides payload behavior. */
                    const payload = await postRedditGateway("/api/game/tournament.record", {runId, locale});
                    return RecordFacebookTournamentRunResponseSchema.parse(payload.result);
                  },
                },
              }
            : {}),
          ...(authenticated && (session.features as Record<string, boolean>).presence
            ? {
                presence: {
                  /** Provides poll behavior. */
                  async poll(input: {
                    /** Stores session id. */
                    sessionId: string; /** Stores state. */
                    /** Stores state. */
                    state: "online" | "playing" | "racing"; /** Stores enabled. */
                    /** Stores enabled. */
                    enabled: boolean;
                  }) {
                    /** Provides payload behavior. */
                    const payload = await postRedditGateway("/api/game/presence.poll", input);
                    if (!Array.isArray(payload.result)) {
                      /** Provides result behavior. */
                      const result = payload.result;
                      if (!isRecord(result) || !Array.isArray(result.rivals))
                        throw new Error("invalid-reddit-presence-response");
                      return result as {
                        /** Stores rivals. */
                        rivals: Array<{
                          /** Stores user id. */
                          userId: string; /** Stores state. */
                          /** Stores state. */
                          state: "offline" | "online" | "playing" | "racing";
                        }>;
                      };
                    }
                    throw new Error("invalid-reddit-presence-response");
                  },
                  /** Provides disconnect behavior. */
                  async disconnect(sessionId: string) {
                    await postRedditGateway("/api/game/presence.disconnect", {sessionId});
                  },
                },
              }
            : {}),
        },
        ...(authenticated ? {accountGeneration: session.accountGeneration as number} : {}),
      });
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : "reddit-startup-failed"};
    }
  }
}
