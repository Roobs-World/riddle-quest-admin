import {type YouTubeLocale} from "../../../../src/gameplay/local/types";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {StatusBar} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "./AndroidApp";
import {createAndroidSdkPort} from "./androidSdkPort";
import {getPlayBilling} from "./billing/playBilling";
import {androidContentSource} from "./content";
import {createHostedFirebaseClient, type HostedFirebaseClient} from "./hosted/firebaseClient";
import {createAndroidHostServices} from "./hosted/hostedServices";
import {createAndroidPendingPlayStorage} from "./hosted/pendingPlayStorage";
import {hostedConfig} from "./hosted/hostedConfig";
import {initializeAndroidAnalytics, setAndroidAnalyticsLocale} from "./analytics/androidAnalytics";
import {configureAnalyticsContext, trackEvent} from "../../../../src/observability/analytics/eventsRuntime";
import {AppState} from "react-native";
import {FailureScreen, LoadingScreen} from "./screens/BootScreens";
/** Root component registered with React Native. */
export function App() {
  useEffect(() => {
    const cleanup = configureAnalyticsContext({platform: "android", screen_class: "RiddleQuestAndroid"});
    void initializeAndroidAnalytics(hostedConfig);
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", next => {
      if (next !== previous) trackEvent("app_lifecycle", {state: next});
      previous = next;
    });
    return () => {subscription.remove(); cleanup();};
  }, []);
  /** Hosted Firebase client created once for the app lifetime. */
  const hosted = useMemo(() => createHostedFirebaseClient(hostedConfig), []);
  /** A deleted account cannot carry native controllers or their caches into its replacement. */
  const [revision, setRevision] = useState(0);
  const [recoverLaunchEntries, setRecoverLaunchEntries] = useState(true);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [recovery, setRecovery] = useState<"pending" | "ready" | "failed">("pending");
  useEffect(() => {
    let active = true;
    setRecovery("pending");
    void Promise.resolve().then(() => hosted.recoverAccountDeletion?.()).then(
      recovered => {
        if (!active) return;
        if (recovered) setRecoverLaunchEntries(false);
        setRecovery("ready");
      },
      () => {if (active) setRecovery("failed");},
    );
    return () => {active = false;};
  }, [hosted, recoveryAttempt]);
  const restart = useCallback(() => setRevision(value => value + 1), []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {recovery === "pending" ? <LoadingScreen paused={false} /> : recovery === "failed"
        ? <FailureScreen locale="en" message="loadFailed" paused={false} onRetry={() => setRecoveryAttempt(value => value + 1)} />
        : <AndroidSession key={revision} hosted={hosted} onAccountDeleted={restart} recoverLaunchEntries={recoverLaunchEntries && revision === 0} />}
    </SafeAreaProvider>
  );
}

/** Account-owned adapters and views are recreated only after storage cleanup has succeeded. */
function AndroidSession({hosted, onAccountDeleted, recoverLaunchEntries}: {
  hosted: HostedFirebaseClient;
  onAccountDeleted(): void;
  recoverLaunchEntries: boolean;
}) {
  const sdk = useMemo(() => createAndroidSdkPort(), []);
  /** Device locale once resolved; host-level copy reads it lazily. */
  const localeRef = useRef<YouTubeLocale>("en");
  /** Shared hosted play services bound to that client. */
  const hostedServices = useMemo(() => createAndroidHostServices(hosted, () => localeRef.current), [hosted]);
  /** Provisional Play journal persisted on the device. */
  const journal = useMemo(() => createAndroidPendingPlayStorage(), []);
  /** Google Play Billing native module, when the build includes it. */
  const billing = useMemo(() => getPlayBilling(), []);
  /** Records the resolved locale for the services. */
  const onLocaleResolved = useCallback((locale: YouTubeLocale) => {
    localeRef.current = locale;
    setAndroidAnalyticsLocale(locale);
  }, []);
  return (
    <AndroidApp sdk={sdk} contentSource={androidContentSource} client={hosted} services={hostedServices} onLocaleResolved={onLocaleResolved}
      journal={journal} billing={billing} onAccountDeleted={onAccountDeleted} recoverLaunchEntries={recoverLaunchEntries} />
  );
}
