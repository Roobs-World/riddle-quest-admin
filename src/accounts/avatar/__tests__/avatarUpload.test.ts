import {describe, expect, it} from "@jest/globals";
import {createAvatarUploadController} from "../avatarUpload";

/** Controllable device/server delivery verifies ownership across real promise turns. */
function deferred<T>() {
  /** Completion remains controlled by the scenario. */
  let resolve: (value: T) => void = () => undefined;
  /** Delivery has the same asynchronous shape as the native bridge and hosted service. */
  const promise = new Promise<T>(ready => {resolve = ready;});
  return {promise, resolve};
}

describe("account-owned avatar upload", () => {
  it("cancels without uploading and permits the next selection", async () => {
    /** Selection results model cancellation followed by a prepared file. */
    const selected: Array<string | null> = [null, "prepared-avatar"];
    /** Server requests are observable independently of rendering. */
    const uploaded: string[] = [];
    /** The controller is shared by native and browser-capable account views. */
    const controller = createAvatarUploadController({pick: async () => selected.shift() ?? null, upload: async image => {uploaded.push(image);}});
    controller.enter(); await controller.select();
    expect(controller.getSnapshot()).toBe("idle"); expect(uploaded).toEqual([]);
    await controller.select();
    expect(uploaded).toEqual(["prepared-avatar"]); expect(controller.getSnapshot()).toBe("updated");
  });

  it("coalesces duplicate taps and never uploads a picker returned to a retired account visit", async () => {
    /** Native picker remains open while the view is retired. */
    const selection = deferred<string | null>();
    /** Count real selection and account requests. */
    let picks = 0, uploads = 0;
    /** Owned controller with a delayed native response. */
    const controller = createAvatarUploadController({pick: () => {picks++; return selection.promise;}, upload: async () => {uploads++;}});
    controller.enter();
    /** Both taps happen before the bridge returns. */
    const first = controller.select();
    await controller.select(); expect(picks).toBe(1);
    controller.dispose(); controller.enter();
    selection.resolve("old-avatar"); await first;
    expect(uploads).toBe(0); expect(controller.getSnapshot()).toBe("idle");
  });

  it("reports a server failure separately and retries only on the player's next request", async () => {
    /** First authoritative update fails, the explicit retry succeeds. */
    let attempts = 0;
    /** Shared controller never schedules a hidden retry. */
    const controller = createAvatarUploadController({pick: async () => "prepared", upload: async () => {if (++attempts === 1) throw Error("offline");}});
    controller.enter(); await controller.select();
    expect(controller.getSnapshot()).toBe("uploadFailed"); expect(attempts).toBe(1);
    await controller.select();
    expect(controller.getSnapshot()).toBe("updated"); expect(attempts).toBe(2);
  });

  it("does not publish an old server completion after account replacement", async () => {
    /** Authority is still processing when the player leaves the profile. */
    const confirmation = deferred<void>();
    /** Target-owned uploader delegates every grant to the backend. */
    const controller = createAvatarUploadController({pick: async () => "prepared", upload: () => confirmation.promise});
    controller.enter();
    /** The pipeline reaches the server before retirement. */
    const request = controller.select(); await Promise.resolve();
    expect(controller.getSnapshot()).toBe("uploading");
    controller.dispose(); controller.enter(); confirmation.resolve(); await request;
    expect(controller.getSnapshot()).toBe("idle");
  });
});
