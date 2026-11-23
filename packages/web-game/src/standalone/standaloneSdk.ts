import type {YouTubeSdkPort} from "../playable/types";
/** Saves key. */
const saveKey = `riddle-quest:${import.meta.env.VITE_PLATFORM_TARGET}:save-v1`;
/** Provides listen behavior. */
const listen = (event: string, callback: () => void) => {
  globalThis.addEventListener(event, callback);
  return () => globalThis.removeEventListener(event, callback);
};
/** Provider-neutral port for candidate HTML5 hosts without an approved SDK contract. */
export function createStandaloneSdkPort(): YouTubeSdkPort {
  return {
    inPlayablesEnvironment: false,
    /** Provides first frame ready behavior. */
    firstFrameReady() {},
    /** Provides game ready behavior. */
    gameReady() {},
    /** Loads data. */
    async loadData() {
      return globalThis.localStorage.getItem(saveKey) ?? "";
    },
    /** Saves data. */
    async saveData(data) {
      globalThis.localStorage.setItem(saveKey, data);
    },
    /** Gets language. */
    async getLanguage() {
      return globalThis.navigator.language || "en";
    },
    isAudioEnabled: () => true,
    onAudioEnabledChange: () => () => {},
    onPause: (callback) => listen("blur", callback),
    onResume: (callback) => listen("focus", callback),
    /** Provides log error behavior. */
    logError() {},
    /** Provides log warning behavior. */
    logWarning() {},
  };
}
