import type {RacePlayClock} from "./RacePlay";

/** Portable timer ownership independent of browser or native timer handle types. */
export function createRaceClock(): RacePlayClock {
  /** Portable ids remain numeric across browser and native timer implementations. */
  let sequence = 0;
  /** Only active timers retain their runtime-specific handle. */
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    now: () => performance.now(),
    /** Completion releases ownership before the callback can schedule another transition. */
    schedule(callback, delay) {
      /** Unique local ownership prevents cancellation of a replacement timer. */
      const id = ++sequence;
      timers.set(id, setTimeout(() => {timers.delete(id); callback();}, delay));
      return id;
    },
    /** Cancel only the runtime timer belonging to this portable handle. */
    cancel(id) {
      /** Runtime handles never escape into the shared session contract. */
      const timer = timers.get(id);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(id);
    },
  };
}
