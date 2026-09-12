import {getWebViewMode, requestExpandedMode, showLoginPrompt} from "@devvit/client";
import {useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent} from "react";
import type {
  CommerceProduct,
  PlatformPreferences,
  PlatformSession,
  PlayerData,
  PlayerDataUpdate,
} from "../platform/types";
import type {ProductSummary} from "../play/types";
import {resolveRedditGoldProduct} from "@qwordly/core/pricing/redditCatalog";
import {PlayHostApp} from "../play/PlayHostApp";
import {detectDeviceLanguage, tr, useLocale} from "../play/i18n";
import {applyPlayerPreferences, subscribeToPlayerPreferenceChanges} from "../play/playerPreferences";
import {RedditPlatformBootstrap} from "./RedditPlatformBootstrap";
import {createRedditHostServices} from "./RedditHostServices";
import {createRedditGuestHostServices} from "./RedditGuestHostServices";
import {RedditPollingPresence} from "./RedditPollingPresence";
import {readBrowserStorage} from "../platform/browserStorage";
import {PlayerProjectionPersistence} from "../platform/PlayerProjectionPersistence";
import {createHostedPlaySession} from "../play/HostedPlaySession";

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
  const [expanded] = useState(() => getWebViewMode() === "expanded");
  /** Provides [startup, set startup] behavior. */
  const [startup, setStartup] = useState<StartupState>({state: "loading", progress: 5});
  /** Provides [presence enabled, set presence enabled] behavior. */
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  const playerPersistenceRef = useRef<PlayerProjectionPersistence | null>(null);
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
    () => createRedditGuestHostServices(startup.state === "ready" ? startup.playerData?.profile : undefined),
    [startup.state === "ready" ? startup.playerData?.profile : undefined],
  );

  useEffect(() => {
    detectDeviceLanguage(readBrowserStorage("local", "appLanguage") ?? navigator.language);
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
      /** Provides next behavior. */
      const next = {...preferencesRef.current, ...change};
      void playerPersistenceRef.current
        ?.updatePreferences(change)
        .then(() => {
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
    const presence = new RedditPollingPresence(startup.session.capabilities.presence);
    presenceRef.current = presence;
    /** Provides enabled behavior. */
    const enabled = startup.session.initialPreferences?.presenceEnabled === true;
    setPresenceEnabled(enabled);
    void presence.setEnabled(enabled).catch(() => undefined);
    /** Provides visibility behavior. */
    const visibility = () => void presence.visibilityChanged().catch(() => undefined);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      presenceRef.current = null;
      void presence.stop().catch(() => undefined);
    };
  }, [startup]);

  /** Provides toggle presence behavior. */
  const togglePresence = useCallback(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.presence) return;
    /** Provides next behavior. */
    const next = !presenceEnabled;
    /** Provides preferences behavior. */
    const preferences = {...preferencesRef.current, presenceEnabled: next};
    void playerPersistenceRef.current
      ?.updatePreferences({presenceEnabled: next})
      .then(() => presenceRef.current?.setEnabled(next))
      .then(() => {
        preferencesRef.current = preferences;
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
        playerPersistenceRef.current = new PlayerProjectionPersistence(
          result.value.storage,
          playerData,
          result.value.initialPreferences,
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
      const persistence = playerPersistenceRef.current;
      if (!persistence) return;
      await persistence.update(update);
    },
    [startup],
  );

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
        <PlayHostApp
          session={createHostedPlaySession({
            hostServices,
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
          onAccountDeletionRequested={() => playerPersistenceRef.current?.closeAndFlush()}
        />
      );
    }
    return (
      <>
        <aside className="reddit-entry reddit-guest-banner" aria-label={tr("RedditPlatform.GUEST_ARIA")}>
          <strong>{tr("RedditPlatform.GUEST_TITLE")}</strong> · {tr("RedditPlatform.GUEST_LIMITS")}
          <button type="button" onClick={() => showLoginPrompt()}>
            {tr("RedditPlatform.LOGIN")}
          </button>
        </aside>
        <PlayHostApp
          session={createHostedPlaySession({
            hostServices: guestHostServices,
            economyAvailable: false,
            platformCapabilities: startup.session.capabilities,
            platformPlayerId: startup.session.playerId,
            initialPlayerData: startup.playerData,
            onPlayerDataChange: (update) => void writePlayerData(update),
            raceLocalePolicy: "english-only",
            hostConfigurationWarning: tr("RedditPlatform.CONFIG_WARNING"),
          })}
        />
      </>
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
