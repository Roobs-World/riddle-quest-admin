import type {FacebookInstantSdk} from "../fbinstant";

type DisplayMode = "NORMAL" | "EXPANDED" | "FULLSCREEN";
type HostSnapshot = Readonly<{
  facebookPlatform?: "IOS" | "ANDROID" | "WEB" | "MOBILE_WEB";
  facebookSdkVersion?: string;
  facebookEntryPoint?: string;
  facebookDisplayMode?: DisplayMode;
}>;

/** Observes host layout and keeps non-identifying diagnostics at the Facebook boundary. */
export function createFacebookHostEnvironment({sdk, isActive}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
}) {
  let retired = false;
  let snapshot: HostSnapshot = {};
  let sessionDataWritten = false;
  let supported = new Set<string>();
  try {supported = new Set(sdk.getSupportedAPIs());} catch { /* Optional metadata cannot prevent startup. */ }
  const current = () => !retired && isActive();
  const read = (operation: () => void) => {try {if (current()) operation();} catch { /* Host metadata is best effort. */ }};
  const root = document.documentElement;
  const previousDisplayMode = root.dataset.facebookDisplayMode;
  const setDisplayMode = (mode: unknown) => {
    if (!current() || (mode !== "NORMAL" && mode !== "EXPANDED" && mode !== "FULLSCREEN")) return;
    if (snapshot.facebookDisplayMode === mode) return;
    snapshot = {...snapshot, facebookDisplayMode: mode};
    root.dataset.facebookDisplayMode = mode.toLowerCase();
    // Existing responsive canvases and overlays remeasure when the native player changes shape.
    window.dispatchEvent(new Event("resize"));
  };
  read(() => {
    if (!supported.has("getPlatform") || !sdk.getPlatform) return;
    const platform = sdk.getPlatform();
    if (platform === "IOS" || platform === "ANDROID" || platform === "WEB" || platform === "MOBILE_WEB") {
      snapshot = {...snapshot, facebookPlatform: platform};
    }
  });
  read(() => {
    if (!supported.has("getSDKVersion") || !sdk.getSDKVersion) return;
    const version = sdk.getSDKVersion();
    if (typeof version === "string" && /^[A-Za-z0-9._-]{1,32}$/u.test(version)) {
      snapshot = {...snapshot, facebookSdkVersion: version};
    }
  });
  read(() => {
    if (supported.has("onDisplayModeChange") && sdk.onDisplayModeChange) sdk.onDisplayModeChange(setDisplayMode);
  });
  read(() => {
    if (supported.has("getDisplayMode") && sdk.getDisplayMode) setDisplayMode(sdk.getDisplayMode());
  });
  read(() => {
    if (!supported.has("getEntryPointAsync") || !sdk.getEntryPointAsync) return;
    void sdk.getEntryPointAsync().then(entryPoint => {
      if (current() && typeof entryPoint === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(entryPoint)) {
        snapshot = {...snapshot, facebookEntryPoint: entryPoint};
      }
    }).catch(() => undefined);
  });
  return {
    getSnapshot: () => snapshot,
    /** No player IDs, answers, balances, referral tokens or arbitrary entry payloads are attached. */
    setActivity(activity: "online" | "playing" | "racing") {
      read(() => {
        if (!supported.has("setSessionData") || !sdk.setSessionData) return;
        sdk.setSessionData({game: "riddle-quest", activity});
        sessionDataWritten = true;
      });
    },
    retire() {
      if (retired) return;
      retired = true;
      if (sessionDataWritten) {try {sdk.setSessionData?.({});} catch { /* Retire even when the host has gone away. */ }}
      if (root.dataset.facebookDisplayMode === snapshot.facebookDisplayMode?.toLowerCase()) {
        if (previousDisplayMode === undefined) delete root.dataset.facebookDisplayMode;
        else root.dataset.facebookDisplayMode = previousDisplayMode;
      }
      snapshot = {};
    },
  };
}
