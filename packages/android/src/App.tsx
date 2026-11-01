import {useMemo} from "react";
import {StatusBar} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {createAndroidSdkPort} from "./androidSdkPort";
import {androidContentSource} from "./content";
import {createHostedFirebaseClient} from "./hosted/firebaseClient";
import {hostedConfig} from "./hosted/hostedConfig";
import {SoloPlayableApp} from "./SoloPlayableApp";
/** Root component registered with React Native. */
export function App() {
  /** Device-bound host port created once for the app lifetime. */
  const sdk = useMemo(() => createAndroidSdkPort(), []);
  /** Hosted Firebase client created once for the app lifetime. */
  const hosted = useMemo(() => createHostedFirebaseClient(hostedConfig), []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SoloPlayableApp sdk={sdk} contentSource={androidContentSource} hosted={hosted} />
    </SafeAreaProvider>
  );
}
