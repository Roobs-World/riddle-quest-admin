import {createDecorativeResources} from "../decorativeResources";

it("releases partial construction in reverse order and deduplicates shared resources", () => {
  /** Partial allocations exist before a later scene constructor fails. */
  const calls: string[] = [];
  /** Driver and DOM retirement must happen after resource release. */
  const owner = createDecorativeResources(jest.fn());
  owner.defer(() => calls.push("canvas"));
  owner.defer(() => calls.push("context"));
  /** The renderer belongs to this scene before its first setup operation. */
  const renderer = {dispose: () => calls.push("renderer")};
  /** Geometry may not yet be reachable through any completed mesh. */
  const geometry = {dispose: () => calls.push("geometry")};
  /** Texture can be shared by more than one material. */
  const texture = {dispose: () => calls.push("texture")};
  owner.own(renderer);owner.own(geometry);owner.own(texture);owner.own(texture);
  owner.dispose();owner.dispose();
  expect(calls).toEqual(["texture", "geometry", "renderer", "context", "canvas"]);
});

it("continues through multiple cleanup failures and reports only the first", () => {
  /** Remaining resources must retire even when diagnostics themselves fail. */
  const released = jest.fn();
  /** A broken reporting adapter cannot interrupt cleanup. */
  const report = jest.fn(() => {throw new Error("reporting failure");});
  /** One owner limits driver failure reporting across all its resources. */
  const owner = createDecorativeResources(report);
  owner.defer(released);
  owner.defer(() => {throw new Error("context cleanup failed");});
  owner.own({dispose: () => {throw new Error("texture cleanup failed");}});
  expect(() => owner.dispose()).not.toThrow();
  expect(report).toHaveBeenCalledTimes(1);
  expect(report.mock.calls[0]?.[0]).toEqual(new Error("texture cleanup failed"));
  expect(released).toHaveBeenCalledTimes(1);
});

it("immediately retires late allocations and callbacks without double disposal", () => {
  /** A delayed constructor or browser callback cannot revive a retired scene. */
  const owner = createDecorativeResources(jest.fn());
  /** Late resource identity remains deduplicated after retirement. */
  const resource = {dispose: jest.fn()};
  /** Late subscription is removed immediately. */
  const unsubscribe = jest.fn();
  owner.dispose();
  expect(owner.own(resource)).toBe(resource);
  owner.own(resource);owner.defer(unsubscribe);owner.dispose();
  expect(resource.dispose).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
