import {getWebViewMode, requestExpandedMode, showLoginPrompt} from "@devvit/client";
import {lazy, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent} from "react";
import type {
  CommerceProduct,
  PlatformPreferences,
  PlatformSession,
  PlayerData,
  PlayerDataUpdate,
} from "../../../../src/platform/contracts/capabilities";
import type {ProductSummary} from "../../../../src/platform/contracts/hostServices";
import {resolveRedditGoldProduct} from "./shared/redditCatalog";
import {PlayHostApp} from "../../../../src/app/components/PlayHostApp";
import {detectDeviceLanguage, tr, useLocale} from "../../../../src/localization/browser/i18n";
import {applyPlayerPreferences, clearBrowserPlayerState, installBrowserPlayerStateMutationGuard, subscribeToPlayerPreferenceChanges} from "../../../../src/settings/browser/playerPreferences";
import {RedditPlatformBootstrap} from "./RedditPlatformBootstrap";
import {createRedditHostServices} from "./RedditHostServices";
import {createRedditGuestHostServices} from "./RedditGuestHostServices";
import {RedditPollingPresence} from "./RedditPollingPresence";
import {readBrowserStorage} from "../../../../src/platform/browser/storage/browserStorage";
import {LocalAccountDeletionGate} from "../../../../src/accounts/browser/deletion/LocalAccountDeletionGate";
import {PlayerProjectionPersistence} from "../../../../src/accounts/browser/playerState/PlayerProjectionPersistence";
import {usePlayerProjectionRecovery} from "../../../../src/accounts/hooks/usePlayerProjectionRecovery";
import {PlayerSaveRecoveryLayout} from "../../../../src/accounts/components/recovery/PlayerSaveRecoveryLayout";
import {createHostedPlaySession} from "../../../../src/app/session/HostedPlaySession";

/** Load the provider-owned board only when multiplayer is opened. */
const RedditRaceEntry = lazy(() => import("./RedditRaceEntry").then(module => ({default: module.RedditRaceEntry})));

/** Describes startup state. */
type StartupState =
  | {
      /** Stores state. */
      state: "loading"; /** Stores progress. */
      /** Stores progress. */
      progress: number;
    }
  | {
      /** Stores state. */
      state: "ready"; /** Stores session. */
      /** Stores session. */
      session: PlatformSession; /** Stores player data. */
      /** Stores player data. */
      playerData: PlayerData | null;
    }
  | {
      /** Stores state. */
      state: "error";
    };

/** Reddit-only application. Devvit supplies authenticated services through same-origin /api routes. */
export function RedditPlatformEntry() {
  useLocale();
  /** Provides [expanded] behavior. */
  const [expanded, setExpanded] = useState(() => getWebViewMode() === "expanded");
  /** Provides [startup, set startup] behavior. */
  const [startup, setStartup] = useState<StartupState>({state: "loading", progress: 5});
  /** Provides [presence enabled, set presence enabled] behavior. */
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  /** Provides player persistence ref behavior. */
  const playerPersistenceRef = useRef<PlayerProjectionPersistence | null>(null);
  const [deletionGate] = useState(() => new LocalAccountDeletionGate({scope: "reddit"}));
  useEffect(() => installBrowserPlayerStateMutationGuard(() => deletionGate.isOpen()), []);
  /** Inline posts retain progress but recovery runs only in the expanded target-owned view. */
  const saveRecovery = usePlayerProjectionRecovery(startup.state === "ready" ? playerPersistenceRef.current : null, {
    lifecycle: startup.state === "ready" ? startup.session.capabilities.lifecycle : undefined,
    canRecover: () => deletionGate.isOpen() && getWebViewMode() === "expanded",
  });
  /** Provides preferences ref behavior. */
  const preferencesRef = useRef<PlatformPreferences>({});
  /** Provides presence ref behavior. */
  const presenceRef = useRef<RedditPollingPresence | null>(null);
  /** Provides host services behavior. */
  const hostServices = useMemo(
    () => createRedditHostServices(startup.state === "ready" ? (startup.session.accountGeneration ?? 1) : 1),
    [startup.state === "ready" ? startup.session.accountGeneration : undefined],
  );
  /** Provides [commerce products, set commerce products] behavior. */
  const [commerceProducts, setCommerceProducts] = useState<ProductSummary[]>([]);
  /** Provides guest host services behavior. */
  const guestHostServices = useMemo(
    () => createRedditGuestHostServices(startup.state === "ready" ? startup.playerData?.profile : undefined,
      startup.state === "ready" ? startup.playerData?.activeGame : undefined),
    [startup.state === "ready" ? startup.playerData?.profile : undefined,
      startup.state === "ready" ? startup.playerData?.activeGame : undefined],
  );

  useEffect(() => {
    detectDeviceLanguage(readBrowserStorage("local", "appLanguage") ?? navigator.language);
  }, []);

  useEffect(() => {
    /** Devvit signals a return to the inline post through focus, not a legacy mode listener. */
    const focus = () => setExpanded(getWebViewMode() === "expanded");
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);

  useEffect(() => {
    if (startup.state !== "ready") return;
    /** Provides effective behavior. */
    const effective = {
      ...startup.session.initialPreferences,
      ...applyPlayerPreferences(startup.session.initialPreferences ?? {}),
    };
    preferencesRef.current = effective;
    return subscribeToPlayerPreferenceChanges((change) => {
      void playerPersistenceRef.current
        ?.updatePreferences(change)
        .then((next) => {
          preferencesRef.current = next;
        })
        .catch(() => undefined);
    });
  }, [startup]);

  useEffect(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.commerce) {
      setCommerceProducts([]);
      return;
    }
    /** Provides active behavior. */
    let active = true;
    void startup.session.capabilities.commerce
      .listProducts()
      .then((result) => {
        if (!active || result.status !== "success") return;
        setCommerceProducts(
          result.value.map((product: CommerceProduct) => {
            /** Provides configured behavior. */
            const configured = resolveRedditGoldProduct(product.id);
            return {
              productId: configured.productId,
              productType: "consumable",
              name: product.title,
              description: product.description,
              coins: configured.coins,
              displayPrice: product.price,
            };
          }),
        );
      })
      .catch(() => {
        if (active) setCommerceProducts([]);
      });
    return () => {
      active = false;
    };
  }, [startup]);

  useEffect(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.presence) return;
    /** Provides presence behavior. */
    const presence = new RedditPollingPresence(startup.session.capabilities.presence, {
      /** A visible inline post is not an active expanded game session. */
      visibility: () => deletionGate.isOpen() && document.visibilityState === "visible" && getWebViewMode() === "expanded" ? "visible" : "hidden",
    });
    presenceRef.current = presence;
    /** Provides enabled behavior. */
    const enabled = startup.session.initialPreferences?.presenceEnabled === true;
    setPresenceEnabled(enabled);
    void presence.setEnabled(enabled).catch(() => undefined);
    /** Provides visibility behavior. */
    const visibility = () => void presence.visibilityChanged().catch(() => undefined);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      presenceRef.current = null;
      void presence.stop().catch(() => undefined);
    };
  }, [startup]);

  /** Provides toggle presence behavior. */
  const togglePresence = useCallback(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.presence || !deletionGate.isOpen()) return;
    /** Provides next behavior. */
    const next = !presenceEnabled;
    void playerPersistenceRef.current
      ?.updatePreferences({presenceEnabled: next})
      .then(async (preferences) => {
        preferencesRef.current = preferences;
        await presenceRef.current?.setEnabled(next);
        setPresenceEnabled(next);
      })
      .catch(() => undefined);
  }, [presenceEnabled, startup]);

  useEffect(() => {
    /** Provides active behavior. */
    let active = true;
    void new RedditPlatformBootstrap()
      .initialize((progress) => {
        if (active) setStartup({state: "loading", progress});
      })
      .then(async (result) => {
        if (!active) return;
        if (result.status !== "success") {
          setStartup({state: "error"});
          return;
        }
        /** Provides player data behavior. */
        const playerData = await result.value.storage.readPlayerData();
        if (!active) return;
        playerPersistenceRef.current = new PlayerProjectionPersistence(
          result.value.storage,
          playerData,
          result.value.initialPreferences,
          deletionGate,
        );
        if (active) setStartup({state: "ready", session: result.value, playerData});
      })
      .catch(() => {
        if (active) setStartup({state: "error"});
      });
    return () => {
      active = false;
    };
  }, []);

  /** Provides write player data behavior. */
  const writePlayerData = useCallback(
    async (update: PlayerDataUpdate) => {
      if (startup.state !== "ready") return;
      /** Provides persistence behavior. */
      const persistence = playerPersistenceRef.current;
      if (!persistence) return;
      // The persistence owner exposes bounded recovery; fire-and-forget game callbacks never reject globally.
      await persistence.update(update).catch(() => undefined);
    },
    [startup],
  );

  const requestAccountDeletion = useCallback(async () => {
    deletionGate.close();
    await presenceRef.current?.stop();
    await playerPersistenceRef.current?.closeAndFlush();
  }, []);

  const completeAccountDeletion = useCallback(() => {
    // The server deletion already removes provider storage; no retired account request may recreate it.
    playerPersistenceRef.current = null;
    clearBrowserPlayerState();
    preferencesRef.current = {};
    setPresenceEnabled(false);
    window.location.reload();
  }, []);

  if (startup.state === "loading")
    return (
      <main className="reddit-entry">
        <h1>Riddle Quest</h1>
        <p role="status">{tr("RedditPlatform.LOADING", {progress: startup.progress})}</p>
      </main>
    );
  if (startup.state === "error")
    return (
      <main className="reddit-entry">
        <h1>Riddle Quest</h1>
        <p role="alert">{tr("RedditPlatform.CONNECT_ERROR")}</p>
        <button onClick={() => window.location.reload()}>{tr("CommonButtons.RETRY")}</button>
      </main>
    );

  if (expanded) {
    if (startup.session.playerId !== "reddit-guest") {
      return (
        <PlayerSaveRecoveryLayout recovery={saveRecovery}>
          <PlayHostApp
            raceSurface={RedditRaceEntry}
            session={createHostedPlaySession({
              hostServices,
              accountDeletionServiceGate: deletionGate,
              platformProducts: commerceProducts,
              platformPurchase:
              startup.session.capabilities.commerce
                ? async (productId) => {
                    /** Provides before behavior. */
                    const before = await hostServices.loadProfile(startup.session.playerId);
                    /** Provides result behavior. */
                    const result = await startup.session.capabilities.commerce!.purchase(productId);
                    if (result.status === "cancelled")
                      return {success: false, cancelled: true, productId, purchaseType: "consumable"};
                    if (result.status !== "success") throw new Error(result.message);
                    /** Provides after behavior. */
                    const after = await hostServices.loadProfile(startup.session.playerId);
                    return {
                      success: true,
                      productId,
                      purchaseType: "consumable",
                      coinsAwarded: Math.max(0, (after?.coins ?? 0) - (before?.coins ?? 0)),
                      newCoins: after?.coins,
                    };
                  }
                : undefined,
              platformCapabilities: startup.session.capabilities,
              platformPlayerId: startup.session.playerId,
              initialPlayerData: startup.playerData,
              onPlayerDataChange: (update) => void writePlayerData(update),
              raceLocalePolicy: "all",
              presenceEnabled,
              onTogglePresence: startup.session.capabilities.presence ? togglePresence : undefined,
              onPresenceStateChange: (state) => void presenceRef.current?.setState(state).catch(() => undefined),
            })}
            onAccountDeletionRequested={requestAccountDeletion}
            onAccountDeleted={completeAccountDeletion}
          />
        </PlayerSaveRecoveryLayout>
      );
    }
    return (
      <div className="reddit-guest-layout">
        <aside className="reddit-entry reddit-guest-banner" aria-label={tr("RedditPlatform.GUEST_ARIA")}>
          <details>
            <summary><strong>{tr("RedditPlatform.GUEST_TITLE")}</strong></summary>
            <div className="reddit-guest-details">
              <p>{tr("RedditPlatform.GUEST_LIMITS")}</p>
              <p>{tr("RedditPlatform.CONFIG_WARNING")}</p>
            </div>
          </details>
          <button type="button" onClick={() => showLoginPrompt()}>
            {tr("RedditPlatform.LOGIN")}
          </button>
        </aside>
        <PlayerSaveRecoveryLayout recovery={saveRecovery}>
          <PlayHostApp
            session={createHostedPlaySession({
              hostServices: guestHostServices,
              economyAvailable: false,
              platformCapabilities: startup.session.capabilities,
              platformPlayerId: startup.session.playerId,
              initialPlayerData: startup.playerData,
              onPlayerDataChange: (update) => void writePlayerData(update),
              raceLocalePolicy: "english-only",
            })}
          />
        </PlayerSaveRecoveryLayout>
      </div>
    );
  }

  return (
    <main className="reddit-entry">
      <h1>Riddle Quest</h1>
      <p>{tr("RedditPlatform.TAGLINE")}</p>
      <button
        type="button"
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          requestExpandedMode(event.nativeEvent, "game");
        }}
      >
        {tr("RedditPlatform.PLAY")}
      </button>
    </main>
  );
}
