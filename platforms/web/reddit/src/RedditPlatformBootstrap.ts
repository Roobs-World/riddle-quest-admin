import type {
  PlatformBootstrap,
  PlatformPreferences,
  PlatformResult,
  PlatformSession,
  PlatformStorage,
  PlayerData,
} from "../../../../src/web/platform/types";
import {parsePlayerData} from "../../../../src/web/platform/playerDataValidation";
import {
  FindRedditRaceMatchResponseSchema,
  ListFacebookTournamentResponseSchema,
  RecordFacebookTournamentRunResponseSchema,
  type RaceLocale,
  type RaceMatchRequest,
} from "../../../../src/core/race";
import {REDDIT_GOLD_PRODUCTS, resolveRedditGoldProduct} from "./shared/redditCatalog";
import {purchase} from "@devvit/payments/client";
import {getWebViewMode} from "@devvit/client";
import {readBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../../../../src/web/platform/browserStorage";
import {raceMatchmakingFailureResult} from "../../../../src/web/platform/raceMatchmakingFailure";
import {withRedditGatewayDeadline} from "./redditGatewayDeadline";
export {REDDIT_GATEWAY_REQUEST_TIMEOUT_MS} from "./redditGatewayDeadline";

/** Defines the guest key value. */
const GUEST_KEY = "riddleQuestRedditGuestV1";
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Rejects paths that could escape Reddit's same-origin Devvit gateway namespace. */
const assertRedditGatewayPath = (path: string): void => {
  /** Provides segments behavior. */
  const segments = path.split("/");
  if (
    !/^\/api\/[A-Za-z0-9._/-]+$/.test(path) ||
    path.includes("//") ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("invalid-reddit-gateway-path");
  }
};

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
  assertRedditGatewayPath(path);
  return withRedditGatewayDeadline(async signal => {
    /** Provides response behavior. */
    const response = await fetch(path, {
      method: "POST",
      // A valid initial API path must never authorize a redirect to another route or origin.
      redirect: "error",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body),
      signal,
    });
    /** Provides payload behavior. */
    const payload: unknown = await response.json();
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      /** Stable HTTP categories remain available when older gateways omit typed details. */
      const code = response.status === 404 && path === "/api/game/race.live.retire" &&
        isRecord(payload) && payload.error === "live-race-request-failed" && payload.code === "not-found" ? "not-found" :
        response.status === 409 && /^\/api\/game\/race\.live\.(join|update|retire)$/.test(path) &&
        isRecord(payload) && payload.error === "live-race-request-failed" && payload.code === "failed-precondition" ? "failed-precondition" :
        [401, 403].includes(response.status) ? "permission-denied" : [400, 413].includes(response.status) ? "invalid-argument" :
        response.status === 429 ? "resource-exhausted" : "unavailable";
      throw Object.assign(new Error("reddit-gateway-request-failed"), {code,
        details: {matchmaking: isRecord(payload) ? payload.matchmaking : undefined}});
    }
    return payload;
  });
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
  /** A readable older browser record cannot replace newer unacknowledged session state. */
  private unsaved = false;
  /** Preserves guest progress for the current session when browser storage is unavailable. */
  private fallback: {
    /** Stores preferences. */
    preferences: PlatformPreferences;
    /** Stores player data. */
    playerData: unknown;
  } = {preferences: {}, playerData: null};

  /** Reads raw. */
  private readRaw(): {
    /** Stores preferences. */
    preferences: PlatformPreferences;
    /** Stores player data. */
    playerData: unknown;
  } {
    if (this.unsaved) return this.fallback;
    try {
      /** Parses d. */
      const parsed: unknown = JSON.parse(readBrowserStorage("local", GUEST_KEY) ?? "null");
      if (!isRecord(parsed)) return this.fallback;
      this.fallback = {preferences: parsePreferences(parsed.preferences), playerData: parsed.playerData ?? null};
      return this.fallback;
    } catch {
      return this.fallback;
    }
  }
  /** Persists raw guest state when storage access is permitted. */
  private writeRaw(value: {
    /** Stores preferences. */
    preferences: PlatformPreferences;
    /** Stores player data. */
    playerData: unknown;
  }): void {
    this.fallback = value;
    this.unsaved = true;
    if (!writeBrowserStorage("local", GUEST_KEY, JSON.stringify(value))) {
      throw new Error("reddit-guest-storage-unavailable");
    }
    this.unsaved = false;
  }
  /** Reads preferences. */
  async readPreferences() {
    return this.readRaw().preferences;
  }
  /** Provides write preferences behavior. */
  async writePreferences(preferences: PlatformPreferences) {
    this.writeRaw({...this.readRaw(), preferences: parsePreferences(preferences)});
  }
  /** Reads player data. */
  async readPlayerData() {
    return parsePlayerData(this.readRaw().playerData);
  }
  /** Provides write player data behavior. */
  async writePlayerData(playerData: PlayerData) {
    /** Parses d. */
    const parsed = await parsePlayerData(playerData);
    this.writeRaw({...this.readRaw(), playerData: parsed});
  }
  /** Provides clear behavior. */
  async clear() {
    this.fallback = {preferences: {}, playerData: null};
    // Login cleanup stays best-effort; a failed removal cannot revive old guest data in this session.
    this.unsaved = !removeBrowserStorage("local", GUEST_KEY);
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
          /** Collapsing Devvit's expanded view can leave document visibility unchanged. */
          const focus = () => {
            if (getWebViewMode() !== "expanded") void callback();
          };
          window.addEventListener("focus", focus);
          return () => {
            document.removeEventListener("visibilitychange", listener);
            window.removeEventListener("focus", focus);
          };
        },
        /** Provides on resume behavior. */
        onResume(callback: () => void | Promise<void>) {
          /** Lists ener. */
          const listener = () => {
            if (document.visibilityState === "visible" && getWebViewMode() === "expanded") void callback();
          };
          document.addEventListener("visibilitychange", listener);
          window.addEventListener("focus", listener);
          return () => {
            document.removeEventListener("visibilitychange", listener);
            window.removeEventListener("focus", listener);
          };
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
                  live: {
                    /** Private proof stays on the approved same-origin gateway without a browser provider SDK. */
                    async confirmGuessReceipt(input) {
                      /** Optional lookup contains only a bounded historical locator and acknowledgement. */
                      const {LiveGuessReceiptQuerySchema, LiveGuessReceiptResultSchema} = await import("../../../../src/core/race");
                      return LiveGuessReceiptResultSchema.parse((await postRedditGateway("/api/game/race.live.receipt", LiveGuessReceiptQuerySchema.parse(input))).result);
                    },
                    /** Server resolves the former human from this caller's retained seat. */
                    async rematch(input) {
                      /** Same-origin join remains the only creation boundary. */
                      const {LiveRaceViewSchema} = await import("../../../../src/core/race");
                      return LiveRaceViewSchema.parse((await postRedditGateway("/api/game/race.live.join", input)).result);
                    },
                    /** Reads private in-game invitations without provider notifications or acceptance. */
                    async inbox() {
                      /** Bounded public notices contain no provider subject or canonical account ID. */
                      const {LiveRaceChallengeSchema} = await import("../../../../src/core/race");
                      return LiveRaceChallengeSchema.array().max(10).parse((await postRedditGateway("/api/game/race.live.inbox", {})).result);
                    },
                    /** Explicit acceptance is preceded by an authenticated private preview. */
                    async challenge(input) {
                      /** The original lobby owns locale, category and deadline. */
                      const {LiveRaceChallengeSchema} = await import("../../../../src/core/race");
                      return LiveRaceChallengeSchema.parse((await postRedditGateway("/api/game/race.live.challenge", input)).result);
                    },
                    /** Retained results stay on the approved same-origin signed gateway. */
                    async history(locale) {
                      /** Exact public rows contain no account IDs, decks or confirmed guesses. */
                      const {ListLiveRaceHistoryResponseSchema} = await import("../../../../src/core/race");
                      return ListLiveRaceHistoryResponseSchema.parse((await postRedditGateway("/api/game/race.live.history", {locale, limit: 20})).result);
                    },
                    /** Existing same-origin safety endpoint resolves the private human opponent. */
                    async blockOpponent(input) {
                      /** Lazy strict acknowledgement adds no provider SDK. */
                      const {BlockSocialRivalResponseSchema} = await import("../../../../src/core/race");
                      return BlockSocialRivalResponseSchema.parse((await postRedditGateway("/api/game/safety.block", input)).result);
                    },
                    /** Categorized reports retain their opaque seat and retry identity through Devvit. */
                    async reportOpponent(input) {
                      /** Only the exact bounded queue acknowledgement is accepted. */
                      const {ReportSocialRivalResponseSchema} = await import("../../../../src/core/race");
                      return ReportSocialRivalResponseSchema.parse((await postRedditGateway("/api/game/safety.report", input)).result);
                    },
                    /** Enters live matchmaking through the same-origin Devvit gateway. */
                    async join(input) {
                      /** Answer-free response contract loaded with multiplayer. */
                      const {LiveRaceViewSchema} = await import("../../../../src/core/race");
                      return LiveRaceViewSchema.parse((await postRedditGateway("/api/game/race.live.join", input)).result);
                    },
                    /** Retires the original join under verified same-origin account authority. */
                    async retireJoin(input) {
                      /** Retirement carries only the original request identity through the same-origin gateway. */
                      const {RetireLiveRaceJoinResponseSchema} = await import("../../../../src/core/race");
                      return RetireLiveRaceJoinResponseSchema.parse((await postRedditGateway("/api/game/race.live.retire", input)).result);
                    },
                    /** Reads or mutates an authenticated live seat through Devvit. */
                    async update(input) {
                      /** Strict viewer-specific lobby and progress contract. */
                      const {LiveRaceViewSchema} = await import("../../../../src/core/race");
                      return LiveRaceViewSchema.parse((await postRedditGateway("/api/game/race.live.update", input)).result);
                    },
                  },
                  /** Provides find behavior. */
                  async find(input: RaceMatchRequest | RaceLocale) {
                    try {
                      /** Provides payload behavior. */
                      const payload = await postRedditGateway("/api/game/race.match", typeof input === "string" ? {locale: input} : input);
                      return success(FindRedditRaceMatchResponseSchema.parse(payload.result));
                    } catch (error) {
                      return raceMatchmakingFailureResult(error);
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
