import type {YouTubeLocale} from "@riddle-quest/solo";
import {useCallback, useMemo, useRef} from "react";
import {StatusBar} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "./AndroidApp";
import {createAndroidSdkPort} from "./androidSdkPort";
import {getPlayBilling} from "./billing/playBilling";
import {androidContentSource} from "./content";
import {createHostedFirebaseClient} from "./hosted/firebaseClient";
import {createAndroidHostServices} from "./hosted/hostedServices";
import {createAndroidPendingPlayStorage} from "./hosted/pendingPlayStorage";
import {hostedConfig} from "./hosted/hostedConfig";
/** Root component registered with React Native. */
export function App() {
  /** Device-bound host port created once for the app lifetime. */
  const sdk = useMemo(() => createAndroidSdkPort(), []);
  /** Hosted Firebase client created once for the app lifetime. */
  const hosted = useMemo(() => createHostedFirebaseClient(hostedConfig), []);
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
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AndroidApp sdk={sdk} contentSource={androidContentSource} client={hosted} services={hostedServices} onLocaleResolved={onLocaleResolved} journal={journal} billing={billing} />
    </SafeAreaProvider>
  );
}
