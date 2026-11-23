import type {Persistence} from "firebase/auth";

/**
 * Metro resolves `@firebase/auth` through its `react-native` export condition, which
 * adds AsyncStorage-backed persistence; the published `firebase/auth` typings only
 * describe the browser build, so the React Native entry point is declared here.
 */
declare module "firebase/auth" {
  /** Key-value storage shape accepted by the React Native persistence layer. */
  export interface ReactNativeAsyncStorage {
    /** Persists one value. */
    setItem(key: string, value: string): Promise<void>;
    /** Reads one value or `null`. */
    getItem(key: string): Promise<string | null>;
    /** Removes one value. */
    removeItem(key: string): Promise<void>;
  }
  /** Returns a persistence object that stores the session in the given storage. */
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
