import {createPendingPlayRecoveryStorage} from "@riddle-quest/hosted/play/pendingGuessJournal";
import type {PendingPlayRecoveryAdapters} from "@riddle-quest/hosted/play/pendingPlayAdapters";

/** Browser implementation keeps global access behind the recovery seam. */
export const browserAdapters: PendingPlayRecoveryAdapters = {
  journal: createPendingPlayRecoveryStorage({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  }),
  clock: {
    now: Date.now,
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timer) => window.clearTimeout(timer),
    setInterval: (callback, delay) => window.setInterval(callback, delay),
    clearInterval: (timer) => window.clearInterval(timer),
  },
};
