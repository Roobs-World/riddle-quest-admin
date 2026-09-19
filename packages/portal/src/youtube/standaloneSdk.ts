import type {YouTubeSdkPort} from "./types";

const saveKey = `riddle-quest:${import.meta.env.VITE_PLATFORM_TARGET}:save-v1`;
const listen = (event: string, callback: () => void) => {
  globalThis.addEventListener(event, callback);
  return () => globalThis.removeEventListener(event, callback);
};

/** Provider-neutral port for candidate HTML5 hosts without an approved SDK contract. */
export function createStandaloneSdkPort(): YouTubeSdkPort {
  return {
    inPlayablesEnvironment: false,
    firstFrameReady() {},
    gameReady() {},
    async loadData() { return globalThis.localStorage.getItem(saveKey) ?? ""; },
    async saveData(data) { globalThis.localStorage.setItem(saveKey, data); },
    async getLanguage() { return globalThis.navigator.language || "en"; },
    isAudioEnabled: () => true,
    onAudioEnabledChange: () => () => {},
    onPause: (callback) => listen("blur", callback),
    onResume: (callback) => listen("focus", callback),
    logError() {},
    logWarning() {},
  };
}
