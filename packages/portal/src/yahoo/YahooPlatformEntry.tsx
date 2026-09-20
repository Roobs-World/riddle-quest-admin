import {useEffect, useMemo, useState} from "react";
import {onAuthStateChanged, signInWithCustomToken, signOut} from "firebase/auth";
import {auth} from "../firebase";
import {PlayHostApp} from "../play/PlayHostApp";
import {createHostedPlaySession} from "../play/HostedPlaySession";
import {createHostServices} from "../play/services";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {tr, useLocale} from "../play/i18n";

/** Describes auth state. */
type AuthState = "loading" | "guest" | "authenticated" | "failed";

/** Yahoo OpenID Connect entry wrapped around the standard Riddle Quest web interface. */
export function YahooPlatformEntry() {
  useLocale();
  /** Provides [auth state, set auth state] behavior. */
  const [authState, setAuthState] = useState<AuthState>("loading");
  /** Provides host services behavior. */
  const hostServices = useMemo(() => createHostServices("firebase"), []);
  /** Provides session behavior. */
  const session = useMemo(() => createHostedPlaySession({hostServices, raceAvailable: true}), [hostServices]);

  useEffect(() => {
    /** Provides fragment behavior. */
    const fragment = new URLSearchParams(globalThis.location.hash.replace(/^#/u, ""));
    /** Provides token behavior. */
    const token = fragment.get("yahoo_token");
    if (token) {
      globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${globalThis.location.search}`);
      void signInWithCustomToken(auth, token).catch(() => setAuthState("failed"));
    }
    return onAuthStateChanged(auth, (user) => setAuthState(user ? "authenticated" : "guest"));
  }, []);

  /** Starts url. */
  const startUrl = import.meta.env.VITE_YAHOO_OAUTH_START_URL;
  if (authState !== "authenticated") {
    return (
      <main className="route-loading" aria-live="polite">
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_GAME")} progress={72} />
        <button
          type="button"
          disabled={authState === "loading" || !startUrl}
          onClick={() => {
            if (startUrl) globalThis.location.assign(startUrl);
          }}
        >
          {tr("Profile.JEST_LOGIN_BUTTON")}
        </button>
        {authState === "failed" ? <p role="alert">{tr("CommonAlerts.TRY_AGAIN_LATER_MESSAGE")}</p> : null}
      </main>
    );
  }

  return (
    <>
      <button
        type="button"
        className="yahoo-sign-out"
        onClick={() => void signOut(auth)}
      >
        {tr("Settings.LOGOUT_BUTTON")}
      </button>
      <PlayHostApp session={session} />
    </>
  );
}
