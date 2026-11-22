/** Keeps both Date APIs consistent while emulator networking uses real timers. */
export function setEmulatorSystemTime(nowMs: number): void {
  jest.useFakeTimers({
    now: nowMs,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
      "setTimeout", "clearTimeout",
    ],
  });
}
