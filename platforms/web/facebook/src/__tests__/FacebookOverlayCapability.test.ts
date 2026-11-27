import {describe, expect, jest, test} from "@jest/globals";
import type {FacebookInstantSdk, FacebookOverlayView} from "../fbinstant";
import {createFacebookOverlayCapability} from "../FacebookOverlayCapability";

/** Provides view behavior. */
const view = (): FacebookOverlayView => ({
  showAsync: jest.fn(async () => undefined),
  dismissAsync: jest.fn(async () => undefined),
  destroyAsync: jest.fn(async () => undefined),
});

/** Provides connected surface behavior. */
const connectedSurface = (): HTMLElement => ({isConnected: true}) as HTMLElement;

/** Provides sdk behavior. */
const sdk = (
  apis = ["overlayViews.createProfilePictureOverlayViewAsync", "overlayViews.createProfileNameOverlayViewAsync"],
) => {
  /** Provides picture behavior. */
  const picture = view();
  /** Provides name behavior. */
  const name = view();
  /** Provides value behavior. */
  const value = {
    getSupportedAPIs: () => apis,
    player: {getID: () => "player-1"},
    overlayViews: {
      createProfilePictureOverlayViewAsync: jest.fn(async () => picture),
      createProfileNameOverlayViewAsync: jest.fn(async () => name),
    },
  } as unknown as FacebookInstantSdk;
  return {value, picture, name};
};

describe("Facebook overlay capability", () => {
  test("fails closed unless both profile overlay APIs are supported", () => {
    expect(createFacebookOverlayCapability(sdk([]).value)).toBeUndefined();
    expect(
      createFacebookOverlayCapability(sdk(["overlayViews.createProfilePictureOverlayViewAsync"]).value),
    ).toBeUndefined();
  });

  test("renders provider-owned current-player overlays and destroys them idempotently", async () => {
    /** Provides harness behavior. */
    const harness = sdk();
    /** Provides surface behavior. */
    const surface = connectedSurface();
    /** Provides capability behavior. */
    const capability = createFacebookOverlayCapability(harness.value)!;
    /** Provides result behavior. */
    const result = await capability.renderPlayer({playerId: "player-1", surface});
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(harness.value.overlayViews!.createProfilePictureOverlayViewAsync).toHaveBeenCalledWith(
      surface,
      expect.any(String),
      expect.any(String),
    );
    expect(harness.value.overlayViews!.createProfileNameOverlayViewAsync).toHaveBeenCalledWith(
      surface,
      expect.any(String),
      expect.any(String),
      "",
    );
    expect(harness.picture.showAsync).toHaveBeenCalledTimes(1);
    expect(harness.name.showAsync).toHaveBeenCalledTimes(1);
    await result.value();
    await result.value();
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
    expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
  });

  test("retains dismissal cleanup for older views without native destruction", async () => {
    /** Older runtime views remain usable when only dismissal is available. */
    const documented: FacebookOverlayView = {
      showAsync: jest.fn(async () => undefined),
      dismissAsync: jest.fn(async () => undefined),
    };
    /** The real adapter receives this documented SDK shape, rather than an augmented test view. */
    const harness = sdk();
    harness.value.overlayViews!.createProfilePictureOverlayViewAsync = jest.fn(async () => documented);
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(async () => documented);
    /** Presentation returns idempotent cleanup even when the provider offers no destruction extension. */
    const result = await createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface()});
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("documented overlay failed");
    await result.value(); await result.value();
    expect(documented.showAsync).toHaveBeenCalledTimes(2);
    expect(documented.dismissAsync).toHaveBeenCalledTimes(2);
  });

  test("rejects another player and cleans a partially-created overlay after failure", async () => {
    /** Provides harness behavior. */
    const harness = sdk();
    /** Provides surface behavior. */
    const surface = connectedSurface();
    /** Provides capability behavior. */
    const capability = createFacebookOverlayCapability(harness.value)!;
    await expect(capability.renderPlayer({playerId: "player-2", surface})).resolves.toEqual({
      status: "terminal-failure",
      message: "facebook-overlay-player-mismatch",
    });
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(async () => {
      throw new Error("overlay-name-failed");
    });
    await expect(createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface})).resolves.toEqual({
      status: "retryable-failure",
      message: "overlay-name-failed",
    });
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
  });

  test("destroys both provider views without waiting for a stalled dismissal", async () => {
    /** Isolated provider views used to exercise dismissal failures. */
    const harness = sdk();
    harness.picture.dismissAsync = jest.fn(() => new Promise<void>(() => undefined));
    /** Overlay initialization result whose cleanup is exercised. */
    const result = await createFacebookOverlayCapability(harness.value)!.renderPlayer({
      playerId: "player-1", surface: connectedSurface(),
    });
    if (result.status !== "success") throw new Error("overlay failed");
    await result.value();
    expect(harness.picture.dismissAsync).not.toHaveBeenCalled();
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
    expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("retired picture creation never admits a profile-name or show operation", async () => {
    /** The connected native surface retires while its original picture operation is pending. */
    const harness = sdk(), surface = connectedSurface();
    /** Resolve only the original SDK operation after its consumer retires. */
    let ready!: (value: FacebookOverlayView) => void;
    harness.value.overlayViews!.createProfilePictureOverlayViewAsync = jest.fn(() => new Promise(resolve => {ready = resolve;}));
    /** Render through the same adapter used by the Facebook game. */
    const pending = createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface});
    Object.defineProperty(surface, "isConnected", {value: false}); ready(harness.picture);
    await expect(pending).resolves.toMatchObject({status: "retryable-failure", message: "facebook-overlay-retired"});
    expect(harness.value.overlayViews!.createProfileNameOverlayViewAsync).not.toHaveBeenCalled();
    expect(harness.picture.showAsync).not.toHaveBeenCalled();
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("a changed native player after name creation retires both views before show", async () => {
    /** Name completion must still belong to the SDK's originally validated player. */
    const harness = sdk();
    /** Keep the actual name SDK operation pending after the picture resolves. */
    let ready!: (value: FacebookOverlayView) => void;
    /** Observe actual SDK admission instead of assuming a fixed number of promise continuations. */
    let requested!: () => void;
    /** The test retires identity only after native name creation has started. */
    const nameRequested = new Promise<void>(resolve => {requested = resolve;});
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(() => new Promise(resolve => {ready = resolve; requested();}));
    /** The adapter must not pair an old picture with a newly authenticated player. */
    const pending = createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface()});
    await nameRequested; harness.value.player.getID = () => "player-2"; ready(harness.name);
    await expect(pending).resolves.toMatchObject({status: "retryable-failure"});
    expect(harness.picture.showAsync).not.toHaveBeenCalled(); expect(harness.name.showAsync).not.toHaveBeenCalled();
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1); expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("retirement during an admitted show still disposes both original views", async () => {
    /** An already admitted SDK display finishes, then its retired views must be reclaimed. */
    const harness = sdk(), surface = connectedSurface();
    /** The original picture show is held independently of name display. */
    let shown!: () => void;
    /** Observe native display admission before retiring the surface. */
    let requested!: () => void;
    /** The test waits for the actual SDK show operation. */
    const showRequested = new Promise<void>(resolve => {requested = resolve;});
    harness.picture.showAsync = jest.fn(() => new Promise(resolve => {shown = resolve; requested();}));
    /** Both native creations finish before display admission. */
    const pending = createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface});
    await showRequested;
    Object.defineProperty(surface, "isConnected", {value: false}); shown();
    await expect(pending).resolves.toMatchObject({status: "retryable-failure"});
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1); expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("a pre-cancelled mount never admits native identity or creation work", async () => {
    /** Cancellation is scoped to this mount and precedes any native getter. */
    const harness = sdk(), controller = new AbortController(); controller.abort();
    /** Native identity is opaque and unnecessary for an already retired consumer. */
    const identity = jest.spyOn(harness.value.player, "getID");
    await expect(createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface(), signal: controller.signal})).resolves.toEqual({status: "cancelled"});
    expect(identity).not.toHaveBeenCalled();
    expect(harness.value.overlayViews!.createProfilePictureOverlayViewAsync).not.toHaveBeenCalled();
  });
  test("pending name cancellation reclaims the picture and observes the original late name", async () => {
    /** The original name operation remains pending while its completed picture is reclaimed. */
    const harness = sdk(), controller = new AbortController();
    /** Resolve only the original admitted name creation. */
    let ready!: (value: FacebookOverlayView) => void;
    /** Actual SDK creation admission gates the test action. */
    let requested!: () => void;
    /** Picture reclamation is observed at the native port. */
    let pictureDestroyed!: () => void;
    /** Late name reclamation is independently observed. */
    let nameDestroyed!: () => void;
    /** Explicit SDK events avoid coupling assertions to promise queue depth. */
    const admitted = new Promise<void>(resolve => {requested = resolve;});
    /** Native disposal acknowledgement for the completed picture. */
    const pictureDone = new Promise<void>(resolve => {pictureDestroyed = resolve;});
    /** Native disposal acknowledgement for the original late name. */
    const nameDone = new Promise<void>(resolve => {nameDestroyed = resolve;});
    harness.picture.destroyAsync = jest.fn(async () => {pictureDestroyed();});
    harness.name.destroyAsync = jest.fn(async () => {nameDestroyed();});
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(() => new Promise(resolve => {ready = resolve; requested();}));
    /** The production adapter receives the same signal shared presentation retires. */
    const pending = createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface(), signal: controller.signal});
    await admitted; controller.abort();
    await expect(pending).resolves.toEqual({status: "cancelled"}); await pictureDone;
    expect(harness.picture.dismissAsync).not.toHaveBeenCalled(); expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
    ready(harness.name); await nameDone;
    expect(harness.name.showAsync).not.toHaveBeenCalled(); expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("cancellation observes an admitted show rejection after both views are reclaimed", async () => {
    /** A started native show cannot be revoked, but its original promise remains observed. */
    const harness = sdk(), controller = new AbortController();
    /** Reject only the original show after local cancellation has completed. */
    let reject!: (error: Error) => void;
    /** Native show admission is independently observable. */
    let requested!: () => void;
    /** Both resource cleanup operations must finish before the original show settles. */
    let destroyed!: () => void;
    /** Track actual native disposal acknowledgements. */
    let count = 0;
    /** Original show admission event. */
    const admitted = new Promise<void>(resolve => {requested = resolve;});
    /** Independent disposal completion event. */
    const done = new Promise<void>(resolve => {destroyed = resolve;});
    harness.picture.showAsync = jest.fn(() => new Promise((_resolve, fail) => {reject = fail; requested();}));
    for (const native of [harness.picture, harness.name]) native.destroyAsync = jest.fn(async () => {if (++count === 2) destroyed();});
    /** The real adapter admits both original SDK creations before showing them. */
    const pending = createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface(), signal: controller.signal});
    await admitted; controller.abort(); await expect(pending).resolves.toEqual({status: "cancelled"}); await done;
    reject(new Error("late-native-show")); await Promise.resolve(); await Promise.resolve();
    expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1); expect(harness.name.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("native destruction triggering cancellation cannot initiate duplicate cleanup", async () => {
    /** Cleanup is registered before SDK invocation, containing synchronous reentry. */
    const harness = sdk(), controller = new AbortController();
    /** Observe the original picture's disposal after dismissal cancels its owner. */
    let destroyed!: () => void;
    /** Native cleanup acknowledgement is independent of local render settlement. */
    const done = new Promise<void>(resolve => {destroyed = resolve;});
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(async () => {throw new Error("name-unavailable");});
    harness.picture.destroyAsync = jest.fn(async () => {controller.abort(); destroyed();});
    await expect(createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface(), signal: controller.signal})).resolves.toEqual({status: "cancelled"});
    await done;
    expect(harness.picture.dismissAsync).not.toHaveBeenCalled(); expect(harness.picture.destroyAsync).toHaveBeenCalledTimes(1);
  });
  test("a native show cancelling its scope cannot admit the next view's show", async () => {
    /** Native SDK calls may synchronously deliver lifecycle callbacks. */
    const harness = sdk(), controller = new AbortController();
    harness.picture.showAsync = jest.fn(async () => {controller.abort(); throw new Error("cancelled-native-show");});
    await expect(createFacebookOverlayCapability(harness.value)!.renderPlayer({playerId: "player-1", surface: connectedSurface(), signal: controller.signal})).resolves.toEqual({status: "cancelled"});
    expect(harness.picture.showAsync).toHaveBeenCalledTimes(1);
    expect(harness.name.showAsync).not.toHaveBeenCalled();
  });
});
