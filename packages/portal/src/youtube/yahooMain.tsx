import {StrictMode, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {onAuthStateChanged, signInWithCustomToken, signOut} from "firebase/auth";
import {auth} from "../firebase";
import {YouTubePlayableApp} from "../youtube/YouTubePlayableApp";
import {createStandaloneSdkPort} from "../youtube/standaloneSdk";
import "../youtube/styles.css";

type AuthState = "loading" | "guest" | "authenticated" | "failed";

function YahooGame() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setAuthState(user ? "authenticated" : "guest"));
    const fragment = new URLSearchParams(globalThis.location.hash.replace(/^#/u, ""));
    const token = fragment.get("yahoo_token");
    if (token) {
      globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${globalThis.location.search}`);
      void signInWithCustomToken(auth, token).catch(() => setAuthState("failed"));
    }
    return unsubscribe;
  }, []);

  const startUrl = import.meta.env.VITE_YAHOO_OAUTH_START_URL;
  return (
    <>
      <aside style={{position: "fixed", zIndex: 20, right: 8, top: 8}}>
        {authState === "authenticated" ? (
          <button type="button" onClick={() => void signOut(auth)}>Sign out of Yahoo</button>
        ) : (
          <button type="button" disabled={authState === "loading" || !startUrl} onClick={() => {
            if (startUrl) globalThis.location.assign(startUrl);
          }}>
            Sign in with Yahoo
          </button>
        )}
        {authState === "failed" ? <p role="alert">Yahoo sign-in failed. Please try again.</p> : null}
      </aside>
      <YouTubePlayableApp sdk={createStandaloneSdkPort()} />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("yahoo-root-missing");
createRoot(root).render(<StrictMode><YahooGame /></StrictMode>);
