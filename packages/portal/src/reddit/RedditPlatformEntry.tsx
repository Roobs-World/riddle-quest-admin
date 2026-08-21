import {getWebViewMode, requestExpandedMode, showLoginPrompt} from "@devvit/client";
import {useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent} from "react";
import type {CommerceProduct, PlatformPreferences, PlatformSession, PlayerData, PlayerDataUpdate} from "../platform/types";
import type {ProductSummary} from "../play/types";
import {resolveRedditGoldProduct} from "@qwordly/core/pricing/redditCatalog";
import {PlayHostApp} from "../play/PlayHostApp";
import {detectDeviceLanguage, tr, useLocale} from "../play/i18n";
import {applyPlayerPreferences, subscribeToPlayerPreferenceChanges} from "../play/playerPreferences";
import {RedditPlatformBootstrap} from "./RedditPlatformBootstrap";
import {createRedditHostServices} from "./RedditHostServices";
import {createRedditGuestHostServices} from "./RedditGuestHostServices";
import {RedditPollingPresence} from "./RedditPollingPresence";

/** Describes startup state. */
type StartupState =
  | {state: "loading"; progress: number}
  | {state: "ready"; session: PlatformSession; playerData: PlayerData | null}
  | {state: "error"};

/** Reddit-only entry point. Devvit supplies authenticated services through same-origin /api routes. */
export function PlatformEntry() {
  useLocale();
  const [expanded] = useState(() => getWebViewMode() === "expanded");
  const [startup, setStartup] = useState<StartupState>({state: "loading", progress: 5});
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  const playerDataRef = useRef<PlayerData | null>(null);
  const preferencesRef = useRef<PlatformPreferences>({});
  const presenceRef = useRef<RedditPollingPresence | null>(null);
  const hostServices = useMemo(() => createRedditHostServices(
    startup.state === "ready" ? startup.session.accountGeneration ?? 1 : 1,
  ), [startup.state === "ready" ? startup.session.accountGeneration : undefined]);
  const [commerceProducts, setCommerceProducts] = useState<ProductSummary[]>([]);
  const guestHostServices = useMemo(() => createRedditGuestHostServices(startup.state === "ready" ? startup.playerData?.profile : undefined), [startup.state === "ready" ? startup.playerData?.profile : undefined]);

  useEffect(() => {
    detectDeviceLanguage(window.localStorage.getItem("appLanguage") ?? navigator.language);
  }, []);

  useEffect(() => {
    if (startup.state !== "ready") return;
    const effective = {
      ...startup.session.initialPreferences,
      ...applyPlayerPreferences(startup.session.initialPreferences ?? {}),
    };
    preferencesRef.current = effective;
    return subscribeToPlayerPreferenceChanges((change) => {
      const next = {...preferencesRef.current, ...change};
      void startup.session.storage.writePreferences(next).then(() => startup.session.storage.flush())
        .then(() => { preferencesRef.current = next; }).catch(() => undefined);
    });
  }, [startup]);

  useEffect(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.commerce) {
      setCommerceProducts([]);
      return;
    }
    let active = true;
    void startup.session.capabilities.commerce.listProducts().then((result) => {
      if (!active || result.status !== "success") return;
      setCommerceProducts(result.value.map((product: CommerceProduct) => {
        const configured = resolveRedditGoldProduct(product.id);
        return {productId: configured.productId, productType: "consumable", name: product.title,
          description: product.description, coins: configured.coins, displayPrice: product.price};
      }));
    }).catch(() => { if (active) setCommerceProducts([]); });
    return () => { active = false; };
  }, [startup]);

  useEffect(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.presence) return;
    const presence = new RedditPollingPresence(startup.session.capabilities.presence);
    presenceRef.current = presence;
    const enabled = startup.session.initialPreferences?.presenceEnabled === true;
    setPresenceEnabled(enabled);
    void presence.setEnabled(enabled).catch(() => undefined);
    const visibility = () => void presence.visibilityChanged().catch(() => undefined);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      presenceRef.current = null;
      void presence.stop().catch(() => undefined);
    };
  }, [startup]);

  const togglePresence = useCallback(() => {
    if (startup.state !== "ready" || !startup.session.capabilities.presence) return;
    const next = !presenceEnabled;
    const preferences = {...preferencesRef.current, presenceEnabled: next};
    void startup.session.storage.writePreferences(preferences).then(() => startup.session.storage.flush())
      .then(() => presenceRef.current?.setEnabled(next))
      .then(() => { preferencesRef.current = preferences; setPresenceEnabled(next); })
      .catch(() => undefined);
  }, [presenceEnabled, startup]);

  useEffect(() => {
    let active = true;
    void new RedditPlatformBootstrap().initialize((progress) => {
      if (active) setStartup({state: "loading", progress});
    }).then(async (result) => {
      if (!active) return;
      if (result.status !== "success") { setStartup({state: "error"}); return; }
      const playerData = await result.value.storage.readPlayerData();
      playerDataRef.current = playerData;
      if (active) setStartup({state: "ready", session: result.value, playerData});
    }).catch(() => {
      if (active) setStartup({state: "error"});
    });
    return () => { active = false; };
  }, []);

  const writePlayerData = useCallback(async (update: PlayerDataUpdate) => {
    if (startup.state !== "ready") return;
    const next: PlayerData = {
      ...(playerDataRef.current ?? {}),
      ...update,
      schemaVersion: 1,
      updatedAt: Date.now(),
    };
    playerDataRef.current = next;
    await startup.session.storage.writePlayerData(next);
    await startup.session.storage.flush();
  }, [startup]);

  if (startup.state === "loading") return <main className="reddit-entry"><h1>Riddle Quest</h1><p role="status">{tr("RedditPlatform.LOADING", {progress: startup.progress})}</p></main>;
  if (startup.state === "error") return <main className="reddit-entry"><h1>Riddle Quest</h1><p role="alert">{tr("RedditPlatform.CONNECT_ERROR")}</p><button onClick={() => window.location.reload()}>{tr("CommonButtons.RETRY")}</button></main>;

  if (expanded) {
    if (startup.session.playerId !== "reddit-guest") {
      return (
        <PlayHostApp
          hostServices={hostServices}
          platformProducts={commerceProducts}
          platformPurchase={startup.session.capabilities.commerce ? async (productId) => {
            const before = await hostServices.loadProfile(startup.session.playerId);
            const result = await startup.session.capabilities.commerce!.purchase(productId);
            if (result.status === "cancelled") return {success: false, cancelled: true, productId, purchaseType: "consumable"};
            if (result.status !== "success") throw new Error(result.message);
            const after = await hostServices.loadProfile(startup.session.playerId);
            return {success: true, productId, purchaseType: "consumable",
              coinsAwarded: Math.max(0, (after?.coins ?? 0) - (before?.coins ?? 0)),
              newCoins: after?.coins};
          } : undefined}
          platformCapabilities={startup.session.capabilities}
          platformPlayerId={startup.session.playerId}
          initialPlayerData={startup.playerData}
          onPlayerDataChange={(update) => void writePlayerData(update)}
          raceLocalePolicy="all"
          presenceEnabled={presenceEnabled}
          onTogglePresence={startup.session.capabilities.presence ? togglePresence : undefined}
          onPresenceStateChange={(state) => void presenceRef.current?.setState(state).catch(() => undefined)}
          onAccountDeletionRequested={() => startup.session.storage.flush()}
        />
      );
    }
    return <>
      <aside className="reddit-entry reddit-guest-banner" aria-label={tr("RedditPlatform.GUEST_ARIA")}>
        <strong>{tr("RedditPlatform.GUEST_TITLE")}</strong> · {tr("RedditPlatform.GUEST_LIMITS")}
        <button type="button" onClick={() => showLoginPrompt()}>{tr("RedditPlatform.LOGIN")}</button>
      </aside>
      <PlayHostApp
        hostServices={guestHostServices}
        platformCapabilities={startup.session.capabilities}
        platformPlayerId={startup.session.playerId}
        initialPlayerData={startup.playerData}
        onPlayerDataChange={(update) => void writePlayerData(update)}
        raceLocalePolicy="english-only"
        hostConfigurationWarning={tr("RedditPlatform.CONFIG_WARNING")}
      />
    </>;
  }

  return (
    <main className="reddit-entry">
      <h1>Riddle Quest</h1>
      <p>{tr("RedditPlatform.TAGLINE")}</p>
      <button type="button" onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        requestExpandedMode(event.nativeEvent, "game");
      }}>{tr("RedditPlatform.PLAY")}</button>
    </main>
  );
}
