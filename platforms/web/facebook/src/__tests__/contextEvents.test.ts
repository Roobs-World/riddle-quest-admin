import {describe, expect, jest, test} from "@jest/globals";
import type {NativeSocialCapability, PlatformResult} from "../../../../../packages/web-game/src/platform/types";
import {FacebookContextCoordinator, type FacebookContextBackendPort} from "../contexts";

/** Validated SDK context snapshot, independent of the notification payload. */
type Context = {
  /** Provider-owned context identifier. */ contextId: string;
  /** Valid social setting returned by the SDK adapter. */ contextType: "THREAD" | "GROUP";
};
/** Creates a successful native context result. */
const ok = (contextId: string): PlatformResult<Context> => ({status: "success", value: {contextId, contextType: "GROUP"}});
/** Exercises event delivery through the production coordinator. */
function fixture() {
  /** Controlled operation in this context ownership regression. */
  let current = ok("a"), active = true;
  /** Controlled operation in this context ownership regression. */
  let callback: (() => void) | undefined;
  /** Controlled operation in this context ownership regression. */
  const stopSdk = jest.fn();
  /** Controlled operation in this context ownership regression. */
  const social: NativeSocialCapability = {
    currentContext: () => current,
    chooseContext: async () => current,
    matchPlayer: async () => current,
    onContextChange: listener => {callback = listener; return stopSdk;},
  };
  /** Controlled operation in this context ownership regression. */
  const backend: FacebookContextBackendPort = {join: jest.fn(async () => undefined), leave: jest.fn(async () => undefined)};
  /** Controlled operation in this context ownership regression. */
  const coordinator = new FacebookContextCoordinator(social, () => "fr", backend);
  return {coordinator, backend, social, stopSdk, setActive: () => {active = false;},
    start: () => coordinator.startObserving(() => active),
    emit: (value: PlatformResult<Context>) => {current = value; callback?.();}};
}

describe("Facebook native context event ownership", () => {
  test("shares native chooser and event synchronization with a newly mounted board", async () => {
    /** A different view may mount while the native chooser is still open. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    /** Native selection settlement is independent of the already-delivered context event. */
    let finish!: (context: PlatformResult<Context>) => void;
    value.social.chooseContext = () => new Promise(resolve => {finish = resolve;});
    /** Initiating intro can retire without retiring the session's event observer. */
    const choice = value.coordinator.chooseContext();
    /** Activity consumes the event's exact membership reconciliation. */
    let board!: Promise<PlatformResult<Context>>;
    value.coordinator.onContextChange(() => {board = value.coordinator.ensureCurrent();});
    value.emit(ok("b")); finish(ok("b"));
    await expect(choice).resolves.toEqual(ok("b"));
    await expect(board).resolves.toEqual(ok("b"));
    expect(value.backend.join).toHaveBeenCalledTimes(2);
    expect(value.backend.leave).toHaveBeenCalledTimes(1);
  });
  test("notifies a mounted board after explicit selection on a host without native context events", async () => {
    /** Older SDK hosts still support an explicit chooser without emitting context events. */
    const value = fixture(); delete value.social.onContextChange; value.start(); await value.coordinator.ensureCurrent();
    /** Activity may mount after the intro that opened the chooser has retired. */
    let board!: Promise<PlatformResult<Context>>;
    /** Explicit selection should invalidate consumers exactly once. */
    const changed = jest.fn(() => {board = value.coordinator.ensureCurrent();});
    value.coordinator.onContextChange(changed); value.emit(ok("b"));
    await expect(value.coordinator.chooseContext()).resolves.toEqual(ok("b"));
    expect(changed).toHaveBeenCalledTimes(1);
    await expect(board).resolves.toEqual(ok("b"));
    expect(value.backend.join).toHaveBeenCalledTimes(2);
  });
  test("synchronizes external context changes without any mounted board consumer", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    value.emit(ok("b"));
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual(ok("b"));
    expect(value.backend.join).toHaveBeenLastCalledWith({contextId: "b", contextType: "GROUP", locale: "fr"});
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "a"});
  });
  test("retires old synchronization before notifying consumers and reconciles the last rapid switch", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    /** Releases the held native membership delivery. */
    let finish!: () => void;
    (value.backend.join as jest.Mock).mockImplementationOnce(async () => new Promise<void>(resolve => {finish = resolve;}));
    /** Controlled operation in this context ownership regression. */
    const changed = jest.fn(() => expect(value.coordinator.currentContext().status).toBe("unavailable"));
    value.coordinator.onContextChange(changed);
    value.emit(ok("b"));
    /** Next owned operation. */
    const old = value.coordinator.ensureCurrent();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    value.emit(ok("c"));
    /** Next owned operation. */
    const current = value.coordinator.ensureCurrent(); finish();
    await expect(old).resolves.toMatchObject({status: "unavailable"});
    await expect(current).resolves.toEqual(ok("c"));
    expect(changed).toHaveBeenCalledTimes(2);
    expect(value.backend.leave).toHaveBeenLastCalledWith({contextId: "b"});
  });
  test("leaves the previous social membership on an external return to solo", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    value.emit({status: "unavailable", message: "facebook-context-unavailable"});
    await expect(value.coordinator.ensureCurrent()).resolves.toMatchObject({status: "unavailable"});
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "a"});
    expect(value.backend.join).toHaveBeenCalledTimes(1);
    value.emit(ok("c")); await value.coordinator.ensureCurrent();
    expect(value.backend.leave).toHaveBeenCalledTimes(1);
  });
  test("unsubscribes board consumers and suppresses callbacks after session retirement", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture();
    /** Next owned operation. */
    const stop = value.start(); await value.coordinator.ensureCurrent();
    /** Records callbacks delivered to the retiring board consumer. */
    const changed = jest.fn();
    /** Next owned operation. */
    const unsubscribe = value.coordinator.onContextChange(changed); unsubscribe();
    value.emit(ok("b")); await value.coordinator.ensureCurrent(); expect(changed).not.toHaveBeenCalled();
    stop(); value.emit(ok("c")); await Promise.resolve();
    expect(value.stopSdk).toHaveBeenCalledTimes(1); expect(value.backend.join).toHaveBeenCalledTimes(2);
    await expect(value.coordinator.ensureCurrent()).resolves.toMatchObject({status: "unavailable"});
    expect(value.backend.join).toHaveBeenCalledTimes(2);
  });
  test("does not deliver new membership or notify after the account operation gate closes", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    /** Controlled operation in this context ownership regression. */
    const changed = jest.fn(); value.coordinator.onContextChange(changed);
    value.setActive(); value.emit(ok("b")); await Promise.resolve();
    expect(changed).not.toHaveBeenCalled(); expect(value.backend.join).toHaveBeenCalledTimes(1);
    await expect(value.coordinator.ensureCurrent()).resolves.toMatchObject({status: "unavailable"});
    expect(value.backend.join).toHaveBeenCalledTimes(1);
  });
  test("retains explicit context reconciliation when the SDK has no event API", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); delete value.social.onContextChange; value.start();
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual(ok("a"));
  });
  test("allows fresh recovery after native membership delivery fails without caching success", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture(); value.start(); await value.coordinator.ensureCurrent();
    (value.backend.join as jest.Mock).mockRejectedValueOnce(new Error("private-provider-error"));
    value.emit(ok("b"));
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual({status: "retryable-failure", message: "facebook-context-sync-failed"});
    expect(value.coordinator.currentContext().status).toBe("unavailable");
    await expect(value.coordinator.ensureCurrent()).resolves.toEqual(ok("b"));
    expect(value.backend.leave).toHaveBeenCalledWith({contextId: "a"});
  });
  test("does not start a subsequent leave after an in-flight join loses its session owner", async () => {
    /** Controlled operation in this context ownership regression. */
    const value = fixture();
    /** Next owned operation. */
    const stop = value.start(); await value.coordinator.ensureCurrent();
    /** Releases the held native membership delivery. */
    let finish!: () => void;
    (value.backend.join as jest.Mock).mockImplementationOnce(async () => new Promise<void>(resolve => {finish = resolve;}));
    value.emit(ok("b"));
    /** Next owned operation. */
    const pending = value.coordinator.ensureCurrent();
    await new Promise<void>(resolve => setTimeout(resolve, 0)); stop(); finish();
    await expect(pending).resolves.toMatchObject({status: "unavailable"});
    expect(value.backend.leave).not.toHaveBeenCalled();
    value.emit(ok("c")); await value.coordinator.ensureCurrent();
    expect(value.backend.join).toHaveBeenCalledTimes(2);
  });
});
