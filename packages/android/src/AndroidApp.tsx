import type {HostServices, WebGameMode} from "@qwordly/hosted/hostTypes";
import {resolveYouTubeLocale, type YouTubeContentSource, type YouTubeLocale, type YouTubeSdkPort} from "@qwordly/solo";
import {useEffect, useState} from "react";
import type {HostedFirebaseClient} from "./hosted/firebaseClient";
import {useHostedAccount} from "./hosted/useHostedAccount";
import {hostedText} from "./i18n/hostedCopy";
import {AccountScreen} from "./screens/AccountScreen";
import {LoadingScreen} from "./screens/BootScreens";
import {HostedConnectScreen} from "./screens/HostedConnectScreen";
import type {AndroidPendingPlayStorage} from "./hosted/pendingPlayStorage";
import {HostedGameScreen} from "./screens/HostedGameScreen";
import {HostedHomeScreen} from "./screens/HostedHomeScreen";
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
}>;
/** Screens reachable while the Global Game Account is confirmed. */
type HostedRoute =
  | "home"
  | "account"
  | {
      /** Server-authoritative play. */
      hosted: WebGameMode;
    };
/**
 * Hosted-first root, matching the Jest Web Target: the device connects to its
 * Global Game Account on launch and plays server-issued riddles. The
 * self-contained game remains available as the offline surface.
 */
export function AndroidApp({sdk, contentSource, client, services, onLocaleResolved, journal}: AndroidAppProps) {
  /** Device locale, once the host port has reported it. */
  const [locale, setLocale] = useState<YouTubeLocale | null>(null);
  /** Which surface the player is on. */
  const [surface, setSurface] = useState<"online" | "offline">("online");
  /** Hosted route while the account is confirmed. */
  const [route, setRoute] = useState<HostedRoute>("home");
  /** Account controller; connects as soon as the app mounts. */
  const account = useHostedAccount(client, {autoConnect: true});
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
  if (typeof route === "object") {
    return <HostedGameScreen services={services} mode={route.hosted} locale={locale} onBack={() => setRoute("home")} journal={journal} />;
  }
  if (route === "account") {
    return <AccountScreen locale={locale} client={client} account={account} onBack={() => setRoute("home")} />;
  }
  return (
    <HostedHomeScreen
      locale={locale}
      services={services}
      account={account.state.account}
      onPlay={(mode) => setRoute({hosted: mode})}
      onShowAccount={() => setRoute("account")}
      onPlayOffline={() => setSurface("offline")}
    />
  );
}
