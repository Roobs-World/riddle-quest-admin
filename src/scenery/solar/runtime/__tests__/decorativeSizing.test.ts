import {createDecorativeSizing} from "../decorativeSizing";

/** Supplies actual visibility events without a browser renderer. */
function visibilityFixture() {
  /** Native visibility listener registration and removal. */
  const visibility = Object.assign(new EventTarget(), {hidden: false});
  Object.defineProperty(globalThis, "document", {configurable: true, value: visibility});
  return visibility;
}
afterEach(() => { Reflect.deleteProperty(globalThis, "document"); });

it("deduplicates rounded dimensions and retains a valid applied size through collapse", () => {
  visibilityFixture();
  /** Observes actual graphics-size work rather than the notification count. */
  const apply = jest.fn();
  /** Owns the current integer buffer size. */
  const owner = createDecorativeSizing({canResize: () => true, apply, onError: jest.fn()});
  owner.update(1279.7, 843.8);owner.refresh();owner.update(1279.1, 843.2);owner.refresh();
  expect(apply.mock.calls).toEqual([[1279, 843]]);
  owner.update(0, 0);owner.refresh();owner.update(Infinity, 100);owner.refresh();owner.update(NaN, 100);owner.refresh();
  owner.update(1279.9, 843.9);owner.refresh();expect(apply).toHaveBeenCalledTimes(1);
  owner.update(.5, .5);owner.refresh();expect(apply).toHaveBeenLastCalledWith(1, 1);owner.dispose();
});

it("keeps only the latest inactive size and applies it before later eligible work", () => {
  /** Actual visibility changes share the same sizing gate as host resume. */
  const visibility = visibilityFixture();
  /** Host/context eligibility changes independently of measured dimensions. */
  let eligible = false;
  /** Counts buffer resets. */
  const apply = jest.fn();
  /** Owner retains the latest blocked measurement. */
  const owner = createDecorativeSizing({canResize: () => eligible, apply, onError: jest.fn()});
  owner.update(390, 844);owner.refresh();owner.update(1280, 720);owner.refresh();expect(apply).not.toHaveBeenCalled();
  eligible = true;visibility.hidden = true;owner.refresh();expect(apply).not.toHaveBeenCalled();
  visibility.hidden = false;visibility.dispatchEvent(new Event("visibilitychange"));owner.refresh();expect(apply.mock.calls).toEqual([[1280, 720]]);
  eligible = false;owner.update(500, 400);owner.update(0, 0);eligible = true;owner.refresh();expect(apply).toHaveBeenCalledTimes(1);owner.dispose();
});

it("contains a failed sizing/reporter and retirement drops queued dimensions", () => {
  /** Real visibility dispatch remains safe after owner retirement. */
  const visibility = visibilityFixture();
  /** Optional resize diagnostics may independently fail. */
  const report = jest.fn(() => {throw new Error("reporter failed");});
  /** Broken buffer update belongs to the optional scene lifetime. */
  const apply = jest.fn(() => {throw new Error("resize failed");});
  /** Owner retires after the first failed buffer operation. */
  const owner = createDecorativeSizing({canResize: () => true, apply, onError: report});
  owner.update(390, 844);expect(() => owner.refresh()).not.toThrow();owner.update(1280, 720);owner.refresh();visibility.dispatchEvent(new Event("visibilitychange"));
  expect(apply).toHaveBeenCalledTimes(1);expect(report).toHaveBeenCalledTimes(1);
  /** Independently retired pending work must never resize later. */
  const retired = createDecorativeSizing({canResize: () => true, apply, onError: report});
  retired.update(500, 500);retired.dispose();retired.refresh();visibility.dispatchEvent(new Event("visibilitychange"));expect(apply).toHaveBeenCalledTimes(1);
});

it("does not overwrite a measurement staged synchronously during a buffer update", () => {
  visibilityFixture();
  /** Records the actual sizes applied across refreshes. */
  const calls: number[] = [];
  /** Graphics callbacks may synchronously stage a more recent size. */
  const owner = createDecorativeSizing({canResize: () => true, apply: width => {calls.push(width);if (width === 390) owner.update(1280, 720);}, onError: jest.fn()});
  owner.update(390, 844);owner.refresh();owner.refresh();expect(calls).toEqual([390, 1280]);owner.dispose();
});
