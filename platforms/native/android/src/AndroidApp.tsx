import {useAuthSnapshot} from "./hosted/useAuthSnapshot";
import {HostedReferralScreen} from "./screens/HostedReferralScreen";
import {createPurchaseRecovery} from "../../../../src/commerce/recovery/purchaseRecovery";
import {AppState, BackHandler} from "react-native";
import type {HostServices, WebGameMode} from "../../../../src/platform/contracts/hostServices";
import {resolveYouTubeLocale, type YouTubeContentSource} from "../../../../src/content/catalog/bundledContent";
import {type YouTubeLocale, type YouTubeSdkPort} from "../../../../src/gameplay/local/types";
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {createAndroidCommerce} from "./billing/androidCommerce";
import type {PlayBillingPort} from "./billing/playBilling";
import type {HostedFirebaseClient} from "./hosted/firebaseClient";
import {useHostedAccount} from "./hosted/useHostedAccount";
import {hostedText} from "./i18n/hostedCopy";
import {AccountScreen} from "./screens/AccountScreen";
import {LoadingScreen} from "./screens/BootScreens";
import {HostedConnectScreen} from "./screens/HostedConnectScreen";
import type {AndroidPendingPlayStorage} from "./hosted/pendingPlayStorage";
import {HostedGameScreen} from "./screens/HostedGameScreen";
import {HostedHomeScreen} from "./screens/HostedHomeScreen";
import {HostedProfileScreen} from "./screens/HostedProfileScreen";
import {HostedRaceScreen} from "./screens/HostedRaceScreen";
import {HostedNotificationScreen} from "./screens/HostedNotificationScreen";
import {useAndroidNotifications} from "./notifications/androidNotifications";
import {useAndroidEntries} from "./hosted/useAndroidEntries";
import {HostedShopScreen} from "./screens/HostedShopScreen";
import {SoloPlayableApp} from "./SoloPlayableApp";
/** Props for {@link AndroidApp}. */
export type AndroidAppProps = Readonly<{
  /** Device-bound host port for the self-contained game. */
  sdk: YouTubeSdkPort;
  /** Bundled content for the self-contained game. */
  contentSource: YouTubeContentSource;
  /** Hosted Firebase client. */
  client: HostedFirebaseClient;
  /** Shared hosted play services. */
  services: HostServices;
  /** Receives the resolved device locale so host-level copy can follow it. */
  onLocaleResolved?: (locale: YouTubeLocale) => void;
  /** Provisional Play journal storage for hosted sessions. */
  journal?: AndroidPendingPlayStorage;
  /** Google Play Billing, or `null` when the device has none. */
  billing?: PlayBillingPort | null;
}>;
/** Screens reachable while the Global Game Account is confirmed. */
type HostedRoute =
  | "home"
  | "account"
  | "profile"
  | "shop"
  | "notifications"
  | {
  /** Stores race. */
  race: string | undefined;
  /** Exact pending preview acknowledged by this route only. */
  entryId?: string}
  | {
  /** Stores referral. */
  referral: string | undefined;
  /** Exact pending preview acknowledged by this route only. */
  entryId?: string}
  | {
      /** Server-authoritative play. */
      hosted: WebGameMode;
    };
/**
 * Hosted-first root, matching the Jest Web Target: the device connects to its
 * Global Game Account on launch and plays server-issued riddles. The
 * self-contained game remains available as the offline surface.
 */
export function AndroidApp({sdk, contentSource, client, services, onLocaleResolved, journal, billing = null}: AndroidAppProps) {
  /** Device locale, once the host port has reported it. */
  const [locale, setLocale] = useState<YouTubeLocale | null>(null);
  /** Which surface the player is on. */
  const [surface, setSurface] = useState<"online" | "offline">("online");
  /** Hosted route while the account is confirmed. */
  const [route, setRoute] = useState<HostedRoute>("home");
  /** Retains [account return route, set account return route] for this operation. */
  const [accountReturnRoute, setAccountReturnRoute] = useState<HostedRoute>("home");
  /** Retains route ref for this operation. */
  const routeRef = useRef(route);
  /** A persisted preview is replaceable until a join or owned seat needs retirement. */
  const [raceOccupied, setRaceOccupied] = useState(false);
  /** Native layout reports activity before queued navigation effects can run. */
  const reportRaceActivity = useCallback((active: boolean) => {setRaceOccupied(active);}, []);
  useLayoutEffect(() => {routeRef.current = route;}, [route]);
  /** Retains [incoming route, set incoming route] for this operation. */
  const [incomingRoute, setIncomingRoute] = useState<HostedRoute | null>(null);
  /** Native reads are optional and never hold up authentication or the hosted home. */
  const {pending, acknowledge} = useAndroidEntries({
    ignoreEntry: entry => {
      /** Current native route checked before a duplicate invitation can replace queued work. */
      const active = routeRef.current;
      return entry.kind === "race" && typeof active === "object" && "race" in active && active.race === entry.challengeId;
    },
    onDaily: () => setIncomingRoute({hosted: "challenge"}),
  });
  useEffect(() => {
    if (!pending) return;
    setIncomingRoute(pending.entry.kind === "race"
      ? {race: pending.entry.challengeId, entryId: pending.id}
      : {referral: pending.entry.token, entryId: pending.id});
  }, [pending]);
  useEffect(() => {
    if (!incomingRoute) return;
    // Preserve an active race until its controller confirms retirement.
    if (typeof route === "object" && "race" in route && (raceOccupied || route.entryId === undefined)) {
      if (typeof incomingRoute === "object" && "race" in incomingRoute && route.race === incomingRoute.race) setIncomingRoute(null);
      return;
    }
    setSurface("online");
    setRoute(incomingRoute);
    setIncomingRoute(null);
  }, [incomingRoute, route, raceOccupied]);
  useEffect(() => {
    /** Retains subscription for this operation. */
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (surface === "offline") { setSurface("online"); return true; }
      if (typeof route === "object" && "race" in route) return false;
      if (route === "home") return false;
      if (typeof route === "object" && "referral" in route && route.entryId) void acknowledge(route.entryId);
      setRoute(route === "account" ? accountReturnRoute : "home");
      return true;
    });
    return () => subscription.remove();
  }, [route, surface, accountReturnRoute, acknowledge]);
  /** Auth can observe a missing document before provisioning; refresh after that write commits. */
  const confirmProfile = useCallback((uid: string) => services.loadProfile(uid), [services]);
  /** Account controller publishes readiness only after host authority is refreshed. */
  const account = useHostedAccount(client, {autoConnect: true, onConfirmed: confirmProfile});
  /** Retains confirmed for this operation. */
  const confirmed = useAuthSnapshot(services);
  /** Shop flow over Play and the backend, when the device has Play Billing. */
  const commerce = useMemo(() => (billing ? createAndroidCommerce(billing, client.purchases, {canCheckout: uid => client.currentUser()?.uid === uid && client.googleIdentity?.isLinked() === true}) : null), [billing, client]);
  /** Confirmed account uid, once connected. */
  const accountUid = account.state.kind === "ready" ? account.state.account.uid : null;
  /** Retains notifications for this operation. */
  const notifications = useAndroidNotifications(accountUid, locale ?? "en", client.notifications);
  useEffect(() => {
    if (!commerce || !accountUid) return;
    /** Retains recovery for this operation. */
    const recovery = createPurchaseRecovery({restore: () => commerce.restore(), onRecovered: () => services.loadProfile(accountUid)});
    void recovery.request();
    /** Retains foreground for this operation. */
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") void recovery.request();
    });
    /** Retains unsubscribe for this operation. */
    const unsubscribe = billing?.onPurchasesChanged?.(() => { void recovery.request(); });
    return () => {
      recovery.dispose();
      foreground.remove();
      unsubscribe?.();
    };
  }, [accountUid, billing, commerce, services]);
  useEffect(() => {
    /** Whether a newer effect superseded this one. */
    let cancelled = false;
    /** Publishes the resolved locale. */
    const apply = (tag: string): void => {
      if (cancelled) return;
      /** Supported locale for the device language. */
      const resolved = resolveYouTubeLocale(tag);
      onLocaleResolved?.(resolved);
      setLocale(resolved);
    };
    sdk.getLanguage().then(apply, () => apply("en"));
    return () => {
      cancelled = true;
    };
  }, [onLocaleResolved, sdk]);
  if (!locale) return <LoadingScreen paused={false} />;
  if (surface === "offline") {
    return <SoloPlayableApp sdk={sdk} contentSource={contentSource} online={{label: hostedText(locale, "playOnline"), onPress: () => setSurface("online")}} />;
  }
  if (account.state.kind !== "ready") {
    return <HostedConnectScreen locale={locale} client={client} state={account.state} onRetry={account.connect} onPlayOffline={() => setSurface("offline")} />;
  }
  if (route === "notifications") {
    return <HostedNotificationScreen locale={locale} controller={notifications} onBack={() => setRoute("home")} />;
  }
  if (typeof route === "object" && "race" in route) {
    return <HostedRaceScreen locale={locale} accountUid={account.state.account.uid} client={client} services={services} challengeId={route.race} onActivityChange={reportRaceActivity}
      selfProfile={confirmed.user?.uid === account.state.account.uid ? confirmed.profile : null}
      onEntryHandled={() => {if (route.entryId) void acknowledge(route.entryId);}}
      onBack={() => {if (route.entryId) void acknowledge(route.entryId); setRoute("home");}} />;
  }
  if (typeof route === "object" && "referral" in route) {
    return <HostedReferralScreen locale={locale} accountUid={account.state.account.uid} backend={client.referrals} token={route.referral}
      onEntryHandled={() => {if (route.entryId) void acknowledge(route.entryId);}}
      onBack={() => {if (route.entryId) void acknowledge(route.entryId); setRoute("home");}} onGoogle={() => {setAccountReturnRoute(route); setRoute("account");}} />;
  }
  if (typeof route === "object") {
    return <HostedGameScreen services={services} mode={route.hosted} locale={locale} onBack={() => setRoute("home")} journal={journal} />;
  }
  if (route === "profile") {
    return (
      <HostedProfileScreen
        locale={locale}
        services={services}
        accountUid={account.state.account.uid}
        onBack={() => setRoute("home")}
        onDeleted={() => {
          // The shared services signed the deleted account out; provision a fresh anonymous one.
          setRoute("home");
          account.connect();
        }}
      />
    );
  }
  if (route === "shop") {
    return (
      <HostedShopScreen
        locale={locale}
        services={services}
        accountUid={account.state.account.uid}
        fallbackCoins={account.state.account.coins}
        billing={billing}
        commerce={commerce}
        durableAccount={client.googleIdentity?.isLinked() === true}
        onShowAccount={() => {setAccountReturnRoute("shop"); setRoute("account");}}
        onBack={() => setRoute("home")}
      />
    );
  }
  if (route === "account") {
    return <AccountScreen locale={locale} client={client} account={account} confirmedCoins={confirmed.user?.uid === account.state.account.uid ? confirmed.profile?.coins : undefined} onBack={() => setRoute(accountReturnRoute)} />;
  }
  return (
    <HostedHomeScreen
      locale={locale}
      services={services}
      account={account.state.account}
      onPlay={(mode) => setRoute({hosted: mode})}
      onShowRace={() => setRoute({race: undefined})}
      onShowNotifications={() => setRoute("notifications")}
      onShowReferrals={() => setRoute(pending?.entry.kind === "referral" ? {referral: pending.entry.token, entryId: pending.id} : {referral: undefined})}
      onShowAccount={() => {setAccountReturnRoute("home"); setRoute("account");}}
      onShowShop={() => setRoute("shop")}
      onShowProfile={() => setRoute("profile")}
      onPlayOffline={() => setSurface("offline")}
    />
  );
}
