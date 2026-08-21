import {describe, expect, jest, test} from "@jest/globals";
import type {FacebookInstantSdk, FacebookOverlayView} from "../fbinstant";
import {createFacebookOverlayCapability} from "../FacebookOverlayCapability";

const view = (): FacebookOverlayView => ({
  showAsync: jest.fn(async () => undefined),
  dismissAsync: jest.fn(async () => undefined),
  destroyOverlayView: jest.fn(async () => undefined),
});

const connectedSurface = (): HTMLElement => ({isConnected: true}) as HTMLElement;

const sdk = (apis = [
  "overlayViews.createProfilePictureOverlayViewAsync",
  "overlayViews.createProfileNameOverlayViewAsync",
]) => {
  const picture = view();
  const name = view();
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
    expect(createFacebookOverlayCapability(sdk([
      "overlayViews.createProfilePictureOverlayViewAsync",
    ]).value)).toBeUndefined();
  });

  test("renders provider-owned current-player overlays and destroys them idempotently", async () => {
    const harness = sdk();
    const surface = connectedSurface();
    const capability = createFacebookOverlayCapability(harness.value)!;
    const result = await capability.renderPlayer({playerId: "player-1", surface});
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(harness.value.overlayViews!.createProfilePictureOverlayViewAsync).toHaveBeenCalledWith(
      surface, expect.any(String), expect.any(String),
    );
    expect(harness.value.overlayViews!.createProfileNameOverlayViewAsync).toHaveBeenCalledWith(
      surface, expect.any(String), expect.any(String), "",
    );
    expect(harness.picture.showAsync).toHaveBeenCalledTimes(1);
    expect(harness.name.showAsync).toHaveBeenCalledTimes(1);
    await result.value();
    await result.value();
    expect(harness.picture.destroyOverlayView).toHaveBeenCalledTimes(1);
    expect(harness.name.destroyOverlayView).toHaveBeenCalledTimes(1);
  });

  test("rejects another player and cleans a partially-created overlay after failure", async () => {
    const harness = sdk();
    const surface = connectedSurface();
    const capability = createFacebookOverlayCapability(harness.value)!;
    await expect(capability.renderPlayer({playerId: "player-2", surface})).resolves.toEqual({
      status: "terminal-failure", message: "facebook-overlay-player-mismatch",
    });
    harness.value.overlayViews!.createProfileNameOverlayViewAsync = jest.fn(async () => {
      throw new Error("overlay-name-failed");
    });
    await expect(capability.renderPlayer({playerId: "player-1", surface})).resolves.toEqual({
      status: "retryable-failure", message: "overlay-name-failed",
    });
    expect(harness.picture.destroyOverlayView).toHaveBeenCalledTimes(1);
  });
});
