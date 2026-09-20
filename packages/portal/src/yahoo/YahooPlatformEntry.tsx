import {useEffect, useMemo, useState} from "react";
import {onAuthStateChanged, signInAnonymously, signInWithCustomToken} from "firebase/auth";
import {auth} from "../firebase";
import {PlayHostApp} from "../play/PlayHostApp";
import {createHostedPlaySession} from "../play/HostedPlaySession";
import {createHostServices, resolveHostServicesMode} from "../play/services";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {tr, useLocale} from "../play/i18n";
import type {PlatformCapabilities} from "../platform/types";
import {getYahooAuthState, type YahooAuthState} from "./authState";

/** Yahoo OpenID Connect entry wrapped around the standard Riddle Quest web interface. */
export function YahooPlatformEntry() {
  useLocale();
  /** Provides [auth state, set auth state] behavior. */
  const [authState, setAuthState] = useState<YahooAuthState>("loading");
  /** Starts url. */
  const startUrl = import.meta.env.VITE_YAHOO_OAUTH_START_URL;
  /** Uses the standard injected browser harness without contacting production identity. */
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  /** Provides host services behavior. */
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  /** Keeps Yahoo registration inside the same profile flow used by the Jest game shell. */
  const platformCapabilities = useMemo<PlatformCapabilities>(() => ({
    accountUpgrade: {
      state: authState === "authenticated" ? "complete" : "available",
      begin: async () => {
        if (!startUrl) return {status: "unavailable", message: "Yahoo sign-in is not configured."};
        globalThis.location.assign(startUrl);
        return {status: "success", value: undefined};
      },
    },
    ...(authState === "authenticated"
      ? {accountManagement: {username: true, avatar: true, deletion: true}}
      : {}),
  }), [authState, startUrl]);
  /** Provides session behavior. */
  const session = useMemo(
    () => createHostedPlaySession({hostServices, platformCapabilities, raceAvailable: true}),
    [hostServices, platformCapabilities],
  );

  useEffect(() => {
    if (hostServicesMode === "fake") {
      setAuthState("guest");
      return;
    }
    /** Provides fragment behavior. */
    const fragment = new URLSearchParams(globalThis.location.hash.replace(/^#/u, ""));
    /** Provides token behavior. */
    const token = fragment.get("yahoo_token");
    if (token) {
      globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${globalThis.location.search}`);
      void signInWithCustomToken(auth, token).catch(() => setAuthState("failed"));
    } else if (!auth.currentUser) {
      void signInAnonymously(auth).catch(() => setAuthState("failed"));
    }
    return onAuthStateChanged(auth, (user) => setAuthState(getYahooAuthState(user)));
  }, [hostServicesMode]);

  useEffect(() => {
    /** Opens Yahoo registration from the standard profile upgrade action. */
    const beginRegistration = () => {
      if (startUrl) globalThis.location.assign(startUrl);
    };
    globalThis.addEventListener("riddle-quest:registration-prompt-opened", beginRegistration);
    return () => globalThis.removeEventListener("riddle-quest:registration-prompt-opened", beginRegistration);
  }, [startUrl]);

  if (authState === "loading" || authState === "failed") {
    return (
      <main className="route-loading" aria-live="polite">
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_GAME")} progress={72} />
        {authState === "failed" ? (
          <>
            <p role="alert">{tr("CommonAlerts.TRY_AGAIN_LATER_MESSAGE")}</p>
            <button type="button" disabled={!startUrl} onClick={() => startUrl && globalThis.location.assign(startUrl)}>
              {tr("Profile.JEST_LOGIN_BUTTON")}
            </button>
          </>
        ) : null}
      </main>
    );
  }

  return <PlayHostApp session={session} />;
}
