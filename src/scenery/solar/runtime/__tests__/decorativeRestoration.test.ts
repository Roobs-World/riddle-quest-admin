import {createDecorativeRestoration} from "../decorativeRestoration";

/** Native dispatch supplies propagation and callback-removal semantics. */
function fixture() {
  /** Independent document visibility event target. */
  const visibility = new EventTarget();
  Object.assign(visibility, {hidden: false});
  Object.defineProperty(globalThis, "document", {configurable: true, value: visibility});
  /** Actual context event target with a canvas-compatible shape. */
  const canvas = Object.assign(new EventTarget(), {style: {display: "block"}});
  /** Context event target typed from the public owner API. */
  const ownedCanvas = canvas as HTMLCanvasElement;
  return {canvas: ownedCanvas, visibility};
}
afterEach(() => { Reflect.deleteProperty(globalThis, "document"); });

it("defers driver and scene callbacks together and replays once before later draws", () => {
  /** Native event dispatch supplies a real propagation stop. */
  const {canvas} = fixture();
  /** The current host eligibility can change without reconstructing the owner. */
  let eligible = false;
  /** Owner is registered before renderer callbacks. */
  const owner = createDecorativeRestoration({canvas, canRestore: () => eligible, onError: jest.fn()});
  /** Driver and scene callbacks must retain native order. */
  const calls: string[] = [];
  canvas.addEventListener("webglcontextrestored", () => calls.push("driver"));
  canvas.addEventListener("webglcontextrestored", () => calls.push("scene"));
  canvas.dispatchEvent(new Event("webglcontextrestored"));canvas.dispatchEvent(new Event("webglcontextrestored"));
  owner.refresh();expect(calls).toEqual([]);
  eligible = true;owner.refresh();owner.refresh();expect(calls).toEqual(["driver", "scene"]);
  canvas.dispatchEvent(new Event("webglcontextrestored"));expect(calls).toEqual(["driver", "scene", "driver", "scene"]);
  owner.dispose();
});

it("waits for visibility and invalidates a deferred restore after a newer context loss", () => {
  /** Native visibility callbacks trigger the same gate as host/layout refresh. */
  const {canvas, visibility} = fixture();
  Object.assign(visibility, {hidden: true});
  /** Context restored while hidden remains unavailable to the renderer. */
  const owner = createDecorativeRestoration({canvas, canRestore: () => true, onError: jest.fn()});
  /** Native loss cancellation remains the driver's responsibility. */
  const lost = jest.fn(event => event.preventDefault());
  /** Counts actual delegated driver restoration. */
  const driver = jest.fn();
  canvas.addEventListener("webglcontextlost", lost);canvas.addEventListener("webglcontextrestored", driver);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(canvas.dispatchEvent(new Event("webglcontextlost", {cancelable: true}))).toBe(false);
  Object.assign(visibility, {hidden: false});visibility.dispatchEvent(new Event("visibilitychange"));expect(driver).not.toHaveBeenCalled();
  Object.assign(visibility, {hidden: true});canvas.dispatchEvent(new Event("webglcontextrestored"));
  Object.assign(visibility, {hidden: false});visibility.dispatchEvent(new Event("visibilitychange"));expect(driver).toHaveBeenCalledTimes(1);
  owner.dispose();
});

it("retirement drops pending work and a failed refresh cannot escape or repeat", () => {
  /** Separate native event targets for the retired scene. */
  const {canvas, visibility} = fixture();
  /** Eligibility is blocked initially and can later fail. */
  let fail = false;
  /** Counts the one scene failure report. */
  const report = jest.fn(() => {throw new Error("diagnostic failed");});
  /** Driver rebuilding is independent of the gate's error reporting. */
  const driver = jest.fn();
  /** Pending owner contains failures in a host-triggered refresh. */
  const owner = createDecorativeRestoration({canvas, canRestore: () => {if (fail) throw new Error("eligibility failed");return false;}, onError: report});
  canvas.addEventListener("webglcontextrestored", driver);canvas.dispatchEvent(new Event("webglcontextrestored"));
  fail = true;expect(() => owner.refresh()).not.toThrow();owner.refresh();visibility.dispatchEvent(new Event("visibilitychange"));
  expect(report).toHaveBeenCalledTimes(1);expect(driver).not.toHaveBeenCalled();owner.dispose();
  /** Independently retiring a blocked restore must never replay it later. */
  const retired = createDecorativeRestoration({canvas, canRestore: () => false, onError: report});
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  /** Callback count before retirement, independent of earlier native dispatch. */
  const before = driver.mock.calls.length;retired.dispose();retired.refresh();visibility.dispatchEvent(new Event("visibilitychange"));expect(driver).toHaveBeenCalledTimes(before);
});
