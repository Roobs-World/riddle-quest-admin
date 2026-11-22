import {setEmulatorSystemTime} from "./helpers/emulatorClock";

afterEach(() => jest.useRealTimers());

it("keeps Date construction and reads aligned without replacing networking timers", async () => {
  /** Retains the real networking primitives before installing the Date-only clock. */
  const timeout = setTimeout, immediate = setImmediate, nextTick = process.nextTick, hrtime = process.hrtime;
  setEmulatorSystemTime(1_800_000_000_000);
  expect(Date.now()).toBe(1_800_000_000_000);
  expect(new Date().getTime()).toBe(Date.now());
  expect(setTimeout).toBe(timeout);
  expect(setImmediate).toBe(immediate);
  expect(process.nextTick).toBe(nextTick);
  expect(process.hrtime).toBe(hrtime);
  await new Promise<void>(resolve => setTimeout(resolve, 1));
  jest.setSystemTime(1_800_000_060_001);
  expect(Date.now()).toBe(1_800_000_060_001);
  expect(new Date().getTime()).toBe(Date.now());
});
