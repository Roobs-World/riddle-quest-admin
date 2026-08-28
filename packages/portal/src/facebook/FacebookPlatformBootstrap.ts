import type {
  PlatformBootstrap,
  PlatformPreferences,
  PlatformResult,
  PlatformSession,
  PlatformStorage,
  PlayerData,
} from "../platform/types";
import {parsePlayerData} from "../platform/playerDataValidation";
import {requireFacebookInstant, type FacebookInstantSdk} from "./fbinstant";
import {resolveFacebookCapabilityVisibility, type FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {createFacebookOverlayCapability} from "./FacebookOverlayCapability";

/** Defines the preferences key value. */
const PREFERENCES_KEY = "riddleQuestPreferences";
/** Defines the player data key value. */
const PLAYER_DATA_KEY = "riddleQuestPlayerState";
/** Provides success behavior. */
const success = <T>(value: T): PlatformResult<T> => ({status: "success", value});
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses preferences. */
const parsePreferences = (value: unknown): PlatformPreferences => {
  if (!isRecord(value)) return {};
  return {
    ...(typeof value.locale === "string" ? {locale: value.locale.slice(0, 32)} : {}),
    ...(typeof value.muted === "boolean" ? {muted: value.muted} : {}),
    ...(typeof value.reducedMotion === "boolean" ? {reducedMotion: value.reducedMotion} : {}),
    ...(typeof value.highContrast === "boolean" ? {highContrast: value.highContrast} : {}),
    ...(typeof value.onboardingComplete === "boolean" ? {onboardingComplete: value.onboardingComplete} : {}),
    ...(Number.isSafeInteger(value.registrationPromptDismissedAt)
      ? {registrationPromptDismissedAt: value.registrationPromptDismissedAt as number}
      : {}),
    ...(typeof value.firstMilestoneMarked === "boolean" ? {firstMilestoneMarked: value.firstMilestoneMarked} : {}),
    ...(typeof value.presenceEnabled === "boolean" ? {presenceEnabled: value.presenceEnabled} : {}),
    ...(value.facebookNotificationPermission === "unknown" ||
    value.facebookNotificationPermission === "declined" ||
    value.facebookNotificationPermission === "accepted"
      ? {facebookNotificationPermission: value.facebookNotificationPermission}
      : {}),
    ...(Number.isSafeInteger(value.facebookNotificationLastPromptAtMs) &&
    (value.facebookNotificationLastPromptAtMs as number) >= 0
      ? {facebookNotificationLastPromptAtMs: value.facebookNotificationLastPromptAtMs as number}
      : {}),
  };
};

/** Provides facebook context result behavior. */
const facebookContextResult = (
  sdk: FacebookInstantSdk,
): PlatformResult<{
  /** Stores context id. */
  contextId: string; /** Stores context type. */
  /** Stores context type. */
  contextType: "THREAD" | "GROUP";
}> => {
  /** Provides context id behavior. */
  const contextId = sdk.context?.getID();
  /** Provides context type behavior. */
  const contextType = sdk.context?.getType();
  if (
    !contextId ||
    !/^[A-Za-z0-9._:-]{1,256}$/u.test(contextId) ||
    (contextType !== "THREAD" && contextType !== "GROUP")
  ) {
    return {status: "unavailable", message: "facebook-context-unavailable"};
  }
  return success({contextId, contextType});
};

/** Provides facebook social failure behavior. */
const facebookSocialFailure = (error: unknown): PlatformResult<never> => {
  /** Provides code behavior. */
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(
          (
            error as {
              /** Stores code. */
              code: unknown;
            }
          ).code,
        )
      : "";
  if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
  return {
    status: "retryable-failure",
    message: error instanceof Error ? error.message : "facebook-social-failed",
  };
};

/** Provides facebook storage behavior. */
class FacebookStorage implements PlatformStorage {
  /** Stores sdk. */
  private readonly sdk: FacebookInstantSdk;
  /** Stores operation tail. */
  private operationTail: Promise<void> = Promise.resolve();

  /** Creates a facebook storage instance. */
  constructor(sdk: FacebookInstantSdk) {
    this.sdk = sdk;
  }

  /** Provides enqueue behavior. */
  private enqueue(operation: () => Promise<void>): Promise<void> {
    /** Provides result behavior. */
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Provides after pending operations behavior. */
  private async afterPendingOperations<Result>(operation: () => Promise<Result>): Promise<Result> {
    await this.operationTail;
    return operation();
  }

  /** Reads preferences. */
  async readPreferences(): Promise<PlatformPreferences> {
    /** Provides data behavior. */
    const data = await this.afterPendingOperations(() => this.sdk.player.getDataAsync([PREFERENCES_KEY]));
    return parsePreferences(data[PREFERENCES_KEY]);
  }

  /** Provides write preferences behavior. */
  async writePreferences(preferences: PlatformPreferences): Promise<void> {
    await this.enqueue(() => this.sdk.player.setDataAsync({[PREFERENCES_KEY]: preferences}));
  }

  /** Reads player data. */
  async readPlayerData(): Promise<PlayerData | null> {
    /** Provides data behavior. */
    const data = await this.afterPendingOperations(() => this.sdk.player.getDataAsync([PLAYER_DATA_KEY]));
    return await parsePlayerData(data[PLAYER_DATA_KEY]);
  }

  /** Provides write player data behavior. */
  async writePlayerData(playerData: PlayerData): Promise<void> {
    await this.enqueue(() => this.sdk.player.setDataAsync({[PLAYER_DATA_KEY]: playerData}));
  }

  /** Provides clear behavior. */
  async clear(): Promise<void> {
    await this.enqueue(async () => {
      await this.sdk.player.setDataAsync({[PREFERENCES_KEY]: null, [PLAYER_DATA_KEY]: null});
      await this.sdk.player.flushDataAsync();
    });
  }

  /** Provides flush behavior. */
  async flush(): Promise<void> {
    await this.enqueue(() => this.sdk.player.flushDataAsync());
  }
}

/** Owns Facebook's strict initialize/read/start ordering behind the shared boundary. */
export class FacebookPlatformBootstrap implements PlatformBootstrap {
  /** Stores get sdk. */
  private readonly getSdk: () => FacebookInstantSdk;
  /** Stores age category. */
  private readonly ageCategory: FacebookAgeCategory;

  /** Creates a facebook platform bootstrap instance. */
  constructor(getSdk: () => FacebookInstantSdk = requireFacebookInstant, ageCategory: FacebookAgeCategory = "unknown") {
    this.getSdk = getSdk;
    this.ageCategory = ageCategory;
  }

  /** Provides initialize behavior. */
  async initialize(reportProgress: (progress: number) => void): Promise<PlatformResult<PlatformSession>> {
    try {
      /** Provides sdk behavior. */
      const sdk = this.getSdk();
      await sdk.initializeAsync();
      sdk.setLoadingProgress(30);
      reportProgress(30);
      /** Provides player id behavior. */
      const playerId = sdk.player.getID();
      if (!playerId || playerId.length > 256) {
        return {status: "terminal-failure", message: "facebook-player-id-invalid"};
      }
      /** Provides storage behavior. */
      const storage = new FacebookStorage(sdk);
      await storage.readPreferences();
      sdk.setLoadingProgress(70);
      reportProgress(70);
      await sdk.startGameAsync();
      sdk.setLoadingProgress(100);
      reportProgress(100);
      /** Provides supported apis behavior. */
      const supportedApis = new Set(sdk.getSupportedAPIs());
      /** Provides visibility behavior. */
      const visibility = resolveFacebookCapabilityVisibility({
        ageCategory: this.ageCategory,
        available: {
          commerce: false,
          ads: false,
          notifications: false,
          nativeSocial:
            Boolean(sdk.context) &&
            supportedApis.has("context.chooseAsync") &&
            supportedApis.has("context.matchPlayerAsync"),
        },
      });
      /** Provides native social behavior. */
      const nativeSocial =
        sdk.context && visibility.nativeSocial
          ? {
              /** Provides current context behavior. */
              currentContext() {
                return facebookContextResult(sdk);
              },
              /** Provides choose context behavior. */
              async chooseContext() {
                try {
                  await sdk.context!.chooseAsync({minSize: 2, maxSize: 50});
                  return facebookContextResult(sdk);
                } catch (error) {
                  return facebookSocialFailure(error);
                }
              },
              /** Provides match player behavior. */
              async matchPlayer(tag?: string) {
                try {
                  if (tag !== undefined && (tag.length === 0 || tag.length > 100)) {
                    return {status: "terminal-failure" as const, message: "facebook-match-tag-invalid"};
                  }
                  await sdk.context!.matchPlayerAsync(tag, true, true);
                  return facebookContextResult(sdk);
                } catch (error) {
                  return facebookSocialFailure(error);
                }
              },
            }
          : undefined;
      /** Provides overlay behavior. */
      const overlay = this.ageCategory === "13_plus" ? createFacebookOverlayCapability(sdk) : undefined;
      return success({
        platform: "facebook",
        playerId,
        storage,
        capabilities: {
          ...(nativeSocial ? {nativeSocial} : {}),
          ...(overlay ? {overlay} : {}),
          lifecycle: {
            /** Provides on pause behavior. */
            onPause(callback) {
              /** Provides active behavior. */
              let active = true;
              sdk.onPause(() => {
                if (active) void callback();
              });
              return () => {
                active = false;
              };
            },
            /** Provides on resume behavior. */
            onResume(callback) {
              /** Provides active behavior. */
              let active = true;
              /** Handles visibility. */
              const handleVisibility = () => {
                if (active && document.visibilityState === "visible") void callback();
              };
              document.addEventListener("visibilitychange", handleVisibility);
              return () => {
                active = false;
                document.removeEventListener("visibilitychange", handleVisibility);
              };
            },
          },
        },
      });
    } catch (error) {
      return {
        status: "retryable-failure",
        message: error instanceof Error ? error.message : "facebook-startup-failed",
      };
    }
  }
}
