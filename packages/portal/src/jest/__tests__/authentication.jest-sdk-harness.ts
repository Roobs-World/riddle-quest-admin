import type {Page} from "@playwright/test";
import type {AuthHarnessState} from "./authentication.jest-playwright.support";

/** Provides install jest sdk harness behavior. */
export const installJestSdkHarness = async (page: Page, scenario = "success") => {
  await page.addInitScript((selectedScenario) => {
    /** Provides state behavior. */
    const state: AuthHarnessState = {
      scenario: selectedScenario,
      calls: [],
      backendExchanges: [],
      backendDeletionRetries: [],
      firebaseTokens: [],
      loginPayloads: [],
      overlayOptions: [],
      playerDataReads: 0,
      preferenceWrites: [],
      profileReads: 0,
      notificationSchedules: [],
      notificationRemovals: [],
      referralShares: [],
      referralSharesStartedFromProfileClick: [],
    };
    /** Provides once behavior. */
    const once = (key: string) => {
      /** Provides storage key behavior. */
      const storageKey = `riddleQuest:jestAuthHarness:${key}`;
      if (sessionStorage.getItem(storageKey) === "1") return false;
      sessionStorage.setItem(storageKey, "1");
      return true;
    };
    /** Provides params behavior. */
    const params = new URLSearchParams(location.search);
    /** Provides player behavior. */
    const player = {
      playerId: params.get("playerId") ?? "jest-auth-player-stable",
      registered:
        params.get("registered") === "1" || localStorage.getItem("riddleQuest:jestAuthHarness:registered") === "1",
    };
    /** Provides preferences behavior. */
    const preferences: Record<string, unknown> =
      selectedScenario === "returning-milestone"
        ? {firstMilestoneMarked: true}
        : selectedScenario === "returning-guest-two-wins"
          ? {firstMilestoneMarked: true, jestGuestCompletedRiddles: 2}
          : selectedScenario === "returning-turkish"
            ? {locale: "tr", onboardingComplete: true}
            : {};
    /** Provides overlay closed behavior. */
    let overlayClosed = false;
    /** Provides subscription active behavior. */
    let subscriptionActive = false;
    window.addEventListener("test:subscription-state", (event) => {
      subscriptionActive = Boolean((event as CustomEvent).detail);
    });
    /** Mirrors the hosted loading overlay's effect, which rearms only for changed progress. */
    let lastLoadingProgress = -1;
    /** Provides loading watchdog behavior. */
    let loadingWatchdog: ReturnType<typeof setTimeout> | undefined;
    /** Provides sdk behavior. */
    const sdk = {
      /** Records native analytics independently of game console output. */
      captureEvent: (name: string, properties: unknown) => {
        state.calls.push(`sdk.captureEvent:${name}:${JSON.stringify(properties)}`);
      },
      init: async () => {
        state.calls.push("sdk.init");
        if (selectedScenario === "init-delayed") {
          await new Promise<void>((resolve) => setTimeout(resolve, 18_000));
        }
        if (selectedScenario === "init-timeout") {
          await new Promise<void>(() => undefined);
        }
        if (selectedScenario === "init-failure" || (selectedScenario === "init-once-failure" && once("initFailed"))) {
          throw new Error("Mock Jest SDK initialization failed");
        }
      },
      getPlayer: () => {
        state.calls.push("sdk.getPlayer");
        return {...player};
      },
      getPlayerSigned: async () => {
        state.calls.push("sdk.getPlayerSigned");
        if (selectedScenario === "loading-watchdog") {
          await new Promise<void>((resolve) => setTimeout(resolve, 25_000));
        }
        if (selectedScenario === "signed-player-failure") {
          throw new Error("Mock signed player request failed");
        }
        return {player: {...player}, playerSigned: `signed:${player.playerId}:${player.registered}`};
      },
      login: async (options?: {
        /** Stores entry payload. */
        /** Stores entry payload. */
        entryPayload?: Record<string, string>;
      }) => {
        state.calls.push("sdk.login");
        state.loginPayloads.push(structuredClone(options?.entryPayload ?? {}));
        if (selectedScenario === "overlay-login-failure") {
          throw new Error("Mock Jest login failed");
        }
        player.registered = true;
        localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
      },
      showRegistrationOverlay: (options: {
        /** Stores theme. */
        theme?: string;
        /** Stores registration message. */
        message?: string;
        /** Stores entry payload. */
        entryPayload?: {
          /** Stores source. */
          source?: string;
          /** Stores campaign. */
          campaign?: string;
          /** Stores reference. */
          reference?: string;
          /** Stores acquisition reference. */
          acquisition_reference?: string;
          /** Stores invite kind. */
          inviteKind?: string;
          /** Stores inviter name. */
          inviterName?: string;
          /** Stores custom name. */
          customName?: string;
        };
        /** Stores on close. */
        onClose: () => void;
      }) => {
        state.calls.push("sdk.showRegistrationOverlay");
        state.overlayOptions.push({
          theme: options.theme,
          message: options.message,
          source: options.entryPayload?.source,
          campaign: options.entryPayload?.campaign,
          reference: options.entryPayload?.reference,
          ...(options.entryPayload?.acquisition_reference
            ? {acquisitionReference: options.entryPayload.acquisition_reference}
            : {}),
          ...(options.entryPayload?.inviteKind ? {inviteKind: options.entryPayload.inviteKind} : {}),
          ...(options.entryPayload?.inviterName ? {inviterName: options.entryPayload.inviterName} : {}),
          customName: options.entryPayload?.customName,
        });
        if (selectedScenario === "overlay-failure" || selectedScenario === "overlay-login-failure") {
          throw new Error("Mock registration overlay failed");
        }
        overlayClosed = false;
        /** Provides close behavior. */
        const close = () => {
          if (overlayClosed) return;
          overlayClosed = true;
          state.calls.push("sdk.registration.onClose");
          options.onClose();
          if (selectedScenario === "duplicate-close") options.onClose();
        };
        return {
          loginButtonAction: () => {
            state.calls.push("sdk.registration.loginButtonAction");
            if (selectedScenario === "overlay-action-failure") {
              throw new Error("Mock registration overlay login action failed");
            }
            player.registered = true;
            localStorage.setItem("riddleQuest:jestAuthHarness:registered", "1");
            close();
          },
          closeButtonAction: () => {
            state.calls.push("sdk.registration.closeButtonAction");
            close();
          },
        };
      },
      data: {
        getAll: () => {
          state.calls.push("sdk.data.getAll");
          state.playerDataReads += 1;
          return preferences;
        },
        set: (...args: unknown[]) => {
          state.calls.push("sdk.data.set");
          /** Provides update behavior. */
          const update =
            args.length === 2 && typeof args[0] === "string"
              ? {[String(args[0])]: args[1]}
              : (args[0] as Record<string, unknown>);
          Object.assign(preferences, update);
          state.preferenceWrites.push(update);
        },
        delete: (key: string) => {
          state.calls.push(`sdk.data.delete:${key}`);
          delete preferences[key];
        },
        flush: async () => {
          state.calls.push("sdk.data.flush");
        },
      },
      getEntryPayload: () => ({
        ...(params.get("customName") ? {customName: params.get("customName"), campaign: "jest_onboarding"} : {}),
        ...(params.get("inviteKind") ? {inviteKind: params.get("inviteKind")} : {}),
        ...(params.get("campaign") ? {campaign: params.get("campaign")} : {}),
        ...(params.get("reference") ? {reference: params.get("reference")} : {}),
        ...(params.get("inviterName") ? {inviterName: params.get("inviterName")} : {}),
        ...(params.get("gameMode") ? {gameMode: params.get("gameMode")} : {}),
        ...(params.get("riddleId") ? {riddleId: params.get("riddleId")} : {}),
        ...(params.get("challengeId") ? {challengeId: params.get("challengeId")} : {}),
        ...(params.get("challengeDestination") ? {challengeDestination: params.get("challengeDestination")} : {}),
      }),
      social: {
        getProfile: async () => {
          state.calls.push("sdk.social.getProfile");
          state.profileReads += 1;
          if (selectedScenario === "profile-failure") throw new Error("Mock profile request failed");
          return {
            username: "Authenticated Solver",
            avatarUrl: selectedScenario === "avatar-profile" ? "https://cdn.jest.com/mock-avatar.webp" : null,
          };
        },
        setScreenshotProvider: () => {},
      },
      notifications: {
        scheduleNotification: async (input: AuthHarnessState["notificationSchedules"][number]) => {
          state.calls.push("sdk.notifications.scheduleNotification");
          state.notificationSchedules.push(structuredClone(input));
        },
        unscheduleNotification: async ({
          identifier,
        }: {
          /** Stores identifier. */
          /** Stores identifier. */
          identifier: string;
        }) => {
          state.calls.push("sdk.notifications.unscheduleNotification");
          state.notificationRemovals.push(identifier);
        },
      },
      referrals: {
        listReferrals: async () => ({referralsSigned: "signed-referrals"}),
        shareReferralLink: async (input: AuthHarnessState["referralShares"][number]) => {
          state.calls.push("sdk.referrals.shareReferralLink");
          state.referralSharesStartedFromProfileClick.push(
            Boolean(
              (
                window as typeof window & {
                  /** True only while the profile invite button's synchronous handler is running. */
                  __RIDDLE_QUEST_PROFILE_INVITE_CLICK__?: boolean;
                }
              ).__RIDDLE_QUEST_PROFILE_INVITE_CLICK__,
            ),
          );
          if (selectedScenario === "race-share-delay" && input.entryPayload?.inviteKind === "race") {
            await new Promise((resolve) => window.setTimeout(resolve, 2_000));
          }
          state.referralShares.push(structuredClone(input));
          return {canceled: selectedScenario === "race-share-cancel"};
        },
      },
      payments: {
        getProducts: async () => {
          state.calls.push("sdk.payments.getProducts:start");
          if (selectedScenario === "background-catalog-delay") {
            await new Promise((resolve) => window.setTimeout(resolve, 10_000));
          }
          state.calls.push("sdk.payments.getProducts:end");
          if (selectedScenario === "localized-coin-catalog") return [
            {sku: "com.roobsworld.riddlequest.coinpack6", name: "coin pack 6", description: "", price: 49.99, currency: "USD"},
            {sku: "com.roobsworld.riddlequest.coinpack1", name: "coin pack 1", description: "Provider custom description", price: 1.79, currency: "USD"},
          ];
          return [];
        },
        getIncompletePurchases: async () => {
          state.calls.push("sdk.payments.getIncompletePurchases");
          return {
            purchases: [],
            purchasesSigned: "signed-purchases",
            hasMore: false,
          };
        },
        completePurchase: async () => ({result: "success"}),
        beginPurchase: async () => ({result: "cancel"}),
        getSubscriptions: async () => {
          state.calls.push("sdk.payments.getSubscriptions");
          return {
            subscriptions: player.registered
              ? [
                  {
                    sku: "com.roobsworld.riddlequest.premium.monthly",
                    displayName: "Riddle Quest Premium",
                    displayDescription: "Premium membership",
                    price: 4.99,
                    currency: "USD",
                    billingPeriod: "monthly",
                    status: subscriptionActive ? "active" : "inactive",
                    trialEligible: !subscriptionActive,
                  },
                ]
              : [],
            signed: subscriptionActive ? "mock.subscriptions.active.signed" : "mock.subscriptions.inactive.signed",
          };
        },
        cancelSubscription: async ({
          subscriptionSku,
        }: {
          /** Provider SKU selected by the shop. */
          subscriptionSku: string;
        }) => {
          state.calls.push(`sdk.payments.cancelSubscription:${subscriptionSku}`);
          if (state.scenario === "subscription-cancel-dismiss") return {result: "cancel"};
          if (state.scenario === "subscription-cancel-error") return {result: "error", error: "internal_error"};
          return {result: "success"};
        },
        beginSubscription: async ({
          subscriptionSku,
        }: {
          /** Stores subscription sku. */
          /** Stores subscription sku. */
          subscriptionSku: string;
        }) => {
          state.calls.push("sdk.payments.beginSubscription");
          subscriptionActive = true;
          return {
            result: "success",
            subscription: {
              sku: subscriptionSku,
              displayName: "Riddle Quest Premium",
              displayDescription: "Premium membership",
              price: 4.99,
              currency: "USD",
              billingPeriod: "monthly",
              status: "active",
              trialEligible: false,
            },
            subscriptionSigned: "mock.subscription.active.signed",
          };
        },
      },
      markFirstMilestone: async () => {
        state.calls.push("sdk.markFirstMilestone");
        if (selectedScenario === "milestone-failure") throw new Error("Milestone unavailable");
      },
      setLoadingProgress: (progress: number) => {
        state.calls.push(`sdk.progress:${progress}`);
        if (selectedScenario !== "loading-watchdog" || progress === lastLoadingProgress) return;
        lastLoadingProgress = progress;
        clearTimeout(loadingWatchdog);
        if (progress < 100) loadingWatchdog = setTimeout(() => state.calls.push("host.loadingTimeout"), 15_000);
      },
      markGameLoaded: () => state.calls.push("sdk.markGameLoaded"),
    };
    Object.assign(window, {
      JestSDK: sdk,
      __RIDDLE_QUEST_JEST_AUTH_TEST__: state,
    });
  }, scenario);
};
