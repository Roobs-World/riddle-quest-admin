import {afterEach, beforeEach, describe, expect, it} from "@jest/globals";
import type {OverlayCapability} from "../../../../../src/platform/contracts/capabilities";
import {createFacebookOverlayCapability} from "../FacebookOverlayCapability";
import type {FacebookInstantSdk, FacebookOverlayView, FacebookOverlayViews} from "../fbinstant";

class HostElement extends EventTarget {
  readonly children: HostElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = {cssText: "", pointerEvents: ""};
  readonly attributes = new Map<string, string>();
  parentElement: HostElement | null = null;
  title = "";
  tabIndex = 0;
  textContent = "";
  constructor(readonly tagName: string, private readonly root = false) {super();}
  get isConnected(): boolean {return this.root || this.parentElement?.isConnected === true;}
  get ownerDocument() {return document;}
  get childNodes() {return this.children;}
  appendChild(child: HostElement) {child.remove(); child.parentElement = this; this.children.push(child); return child;}
  append(...children: HostElement[]) {children.forEach(child => this.appendChild(child));}
  contains(node: unknown): boolean {return node === this || this.children.some(child => child.contains(node));}
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      this.parentElement = null;
    }
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "title") this.title = value;
    if (name === "tabindex") this.tabIndex = Number(value);
  }
  getAttribute(name: string) {
    if (name === "title") return this.title || null;
    if (name === "tabindex") return String(this.tabIndex);
    return this.attributes.get(name) ?? null;
  }
}

const disposers: Array<() => Promise<void>> = [];
let originalDocument: PropertyDescriptor | undefined;
beforeEach(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const root = new HostElement("HTML", true);
  const body = new HostElement("BODY");
  root.appendChild(body);
  Object.defineProperty(globalThis, "document", {configurable: true, value: {
    documentElement: root, body, createElement: (tag: string) => new HostElement(tag.toUpperCase()),
  }});
});
afterEach(async () => {
  try {await Promise.all(disposers.splice(0).map(dispose => dispose()));}
  finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

const until = async (condition: () => boolean) => {
  for (let turn = 0; turn < 80; turn++) {if (condition()) return; await Promise.resolve();}
  throw new Error("Expected native overlay transition did not settle");
};
const settle = async () => {for (let turn = 0; turn < 20; turn++) await Promise.resolve();};
const surface = () => {const element = document.createElement("div"); document.body.appendChild(element); return element;};
type Factory = "file-promise" | "inline-promise" | "file-callback" | "inline-callback";
const factories: readonly Factory[] = ["file-promise", "inline-promise", "file-callback", "inline-callback"];
const apiNames = {
  "file-promise": "overlayViews.createOverlayViewAsync",
  "inline-promise": "overlayViews.createOverlayViewWithXMLStringAsync",
  "file-callback": "overlayViews.createOverlayView",
  "inline-callback": "overlayViews.createOverlayViewWithXMLString",
} satisfies Record<Factory, string>;
type NativeRecord = {
  id: string;
  frame: HTMLIFrameElement;
  view: FacebookOverlayView;
  content: string;
  data: unknown;
  state: "created" | "shown" | "dismissed" | "destroyed";
  ready: () => void;
  fail: (error: unknown) => void;
};

const fixture = (factory: Factory, options: {
  holdReady?: boolean;
  initializationFailure?: Error;
  synchronousCallback?: boolean;
  legacyDismiss?: boolean;
} = {}) => {
  const records: NativeRecord[] = [];
  const nativeEvents: string[] = [];
  const managementEvents: string[] = [];
  const inventory = new Map<string, FacebookOverlayView>();
  let customEvent: ((event: string, overlayID: string) => void) | undefined;
  let playerId = "current-player";
  const create = (content: string, data: unknown): NativeRecord => {
    const id = `profile-${records.length + 1}`;
    const frame = document.createElement("iframe");
    const record: NativeRecord = {
      id, frame, content, data, state: "created", ready: () => undefined, fail: () => undefined,
      view: {
        getID: () => id,
        getIFrameElement: () => frame,
        showAsync: async () => {
          if (!frame.isConnected) throw new Error("Showing detached native overlay");
          if (record.state === "destroyed") throw new Error("Showing destroyed native overlay");
          record.state = "shown"; nativeEvents.push(`shown:${id}`);
        },
        dismissAsync: async () => {record.state = "dismissed"; nativeEvents.push(`dismissed:${id}`);},
        ...(!options.legacyDismiss ? {destroyAsync: async () => {
          record.state = "destroyed"; frame.remove(); inventory.delete(id); nativeEvents.push(`destroyed:${id}`);
        }} : {}),
      },
    };
    records.push(record); inventory.set(id, record.view);
    return record;
  };
  const promiseFactory = (content: string, element: HTMLElement, style?: string, data?: unknown) => {
    const record = create(content, data);
    record.frame.style.cssText = style ?? "";
    element.appendChild(record.frame);
    return new Promise<FacebookOverlayView>((resolve, reject) => {
      record.ready = () => resolve(record.view);
      record.fail = reject;
      if (options.initializationFailure) reject(options.initializationFailure);
      else if (!options.holdReady) resolve(record.view);
    });
  };
  const callbackFactory = (content: string, data: unknown,
    ready?: (view: FacebookOverlayView) => void, fail?: (view: FacebookOverlayView, error: unknown) => void) => {
    const record = create(content, data);
    record.ready = () => ready?.(record.view);
    record.fail = error => fail?.(record.view, error);
    const initialize = () => {
      if (options.initializationFailure) record.fail(options.initializationFailure);
      else if (!options.holdReady) record.ready();
    };
    if (options.synchronousCallback) initialize();
    else queueMicrotask(initialize);
    return record.view;
  };
  const overlays: FacebookOverlayViews = {
    getOverlayViews: () => {managementEvents.push("inventory"); return new Map(inventory);},
    setCustomEventHandler: callback => {managementEvents.push("register"); customEvent = callback;},
  };
  switch (factory) {
    case "file-promise": overlays.createOverlayViewAsync = (file, element, style, _css, data) => promiseFactory(file, element, style, data); break;
    case "inline-promise": overlays.createOverlayViewWithXMLStringAsync = (xml, element, style, _css, data) => promiseFactory(xml, element, style, data); break;
    case "file-callback": overlays.createOverlayView = (file, _css, data, ready, fail) => callbackFactory(file, data, ready, fail); break;
    case "inline-callback": overlays.createOverlayViewWithXMLString = (xml, _css, data, ready, fail) => callbackFactory(xml, data, ready, fail); break;
  }
  const sdk: FacebookInstantSdk = {
    initializeAsync: async () => undefined, startGameAsync: async () => undefined,
    setLoadingProgress: () => undefined, onPause: () => undefined,
    getSupportedAPIs: () => [apiNames[factory], "overlayViews.setCustomEventHandler", "overlayViews.getOverlayViews"],
    player: {
      getID: () => playerId,
      getSignedPlayerInfoAsync: async () => {throw new Error("Overlay must not request signed identity");},
      getDataAsync: async () => ({}), setDataAsync: async () => undefined, flushDataAsync: async () => undefined,
    },
    overlayViews: overlays,
  };
  return {sdk, overlays, records, inventory, nativeEvents, managementEvents, create,
    emit: (event: string, id: string) => customEvent?.(event, id),
    setPlayer: (value: string) => {playerId = value;}};
};

const capability = (sdk: FacebookInstantSdk): OverlayCapability => {
  const value = createFacebookOverlayCapability(sdk);
  if (!value) throw new Error("Expected the individually advertised generic factory to enable overlays");
  return value;
};
const rendered = async (sdk: FacebookInstantSdk, element = surface()) => {
  const result = await capability(sdk).renderPlayer({playerId: "current-player", surface: element});
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error(`Overlay failed: ${result.status}`);
  disposers.push(result.value);
  return {element, dispose: result.value};
};

describe("Facebook generic profile overlay alternatives", () => {
  it("keeps the convenience pair preferred when both methods are advertised and callable", async () => {
    const harness = fixture("file-promise");
    harness.sdk.getSupportedAPIs = () => [apiNames["file-promise"],
      "overlayViews.createProfilePictureOverlayViewAsync", "overlayViews.createProfileNameOverlayViewAsync"];
    harness.overlays.createProfilePictureOverlayViewAsync = async element => {
      const record = harness.create("convenience-picture", undefined); element.appendChild(record.frame); return record.view;
    };
    harness.overlays.createProfileNameOverlayViewAsync = async element => {
      const record = harness.create("convenience-name", undefined); element.appendChild(record.frame); return record.view;
    };
    const {dispose} = await rendered(harness.sdk);
    expect(harness.records.map(record => [record.content, record.state])).toEqual([
      ["convenience-picture", "shown"], ["convenience-name", "shown"],
    ]);
    await dispose();
    expect(harness.records.map(record => record.state)).toEqual(["destroyed", "destroyed"]);
  });

  it("uses the generic fallback when an advertised convenience method is not callable", async () => {
    const harness = fixture("file-promise");
    harness.sdk.getSupportedAPIs = () => [apiNames["file-promise"],
      "overlayViews.createProfilePictureOverlayViewAsync", "overlayViews.createProfileNameOverlayViewAsync"];
    harness.overlays.createProfilePictureOverlayViewAsync = async element => {
      const record = harness.create("unpaired-picture", undefined); element.appendChild(record.frame); return record.view;
    };
    await rendered(harness.sdk);
    expect(harness.records.map(record => [record.content, record.state])).toEqual([
      ["facebook-overlays/profile.xml", "shown"],
    ]);
  });

  it.each(factories)("renders and destroys the profile when only the %s factory is advertised", async factory => {
    const harness = fixture(factory);
    const {element, dispose} = await rendered(harness.sdk);
    expect(harness.nativeEvents).toEqual(["shown:profile-1"]);
    expect(element.children.length).toBe(1);
    const record = harness.records[0];
    expect(record.frame.parentElement).toBe(element);
    expect(record.frame.style.cssText).toContain("pointer-events:none");
    expect(record.frame.tabIndex).toBe(-1);
    expect(record.frame.title).toBe("Profile");
    if (factory.startsWith("file")) expect(record.content).toBe("facebook-overlays/profile.xml");
    else {
      expect(record.content).toContain('{{FBInstant.player.name}}');
      expect(record.content).toContain('{{FBInstant.player.photo}}');
      expect(record.content).toContain('onErrorEvent="rq_profile_photo_error"');
    }
    expect(JSON.stringify(record.data) ?? "").not.toContain("current-player");
    await dispose(); await dispose();
    expect(element.children.length).toBe(0);
    expect(harness.nativeEvents).toEqual(["shown:profile-1", "destroyed:profile-1"]);
  });

  it.each<Factory>(["file-callback", "inline-callback"])("attaches the immediate %s handle before waiting for initialization", async factory => {
    const harness = fixture(factory, {holdReady: true});
    const element = surface();
    const pending = capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element});
    await until(() => harness.records.length === 1);
    const record = harness.records[0];
    expect(record.frame.parentElement).toBe(element);
    expect(record.state).toBe("created");
    record.ready();
    const result = await pending;
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Callback overlay did not render");
    disposers.push(result.value);
    expect(record.state).toBe("shown");
  });

  it("captures a callback handle when initialization succeeds synchronously", async () => {
    const harness = fixture("inline-callback", {synchronousCallback: true});
    const {dispose} = await rendered(harness.sdk);
    expect(harness.nativeEvents).toEqual(["shown:profile-1"]);
    await dispose();
    expect(harness.nativeEvents).toEqual(["shown:profile-1", "destroyed:profile-1"]);
  });

  it("rejects synchronous callback readiness when attaching its returned frame fails", async () => {
    const harness = fixture("file-callback", {synchronousCallback: true});
    const element = surface();
    element.appendChild = () => {throw new Error("Owned surface rejected the native frame");};
    const result = await capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element});
    expect(result).toEqual({status: "retryable-failure", message: "Owned surface rejected the native frame"});
    expect(harness.nativeEvents).toEqual(["destroyed:profile-1"]);
    expect(element.children.length).toBe(0);
  });

  it("keeps callback initialization failure final when the host later reports success", async () => {
    const harness = fixture("inline-callback", {holdReady: true});
    const element = surface();
    const pending = capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element});
    await until(() => harness.records.length === 1);
    const record = harness.records[0];
    expect(record.frame.isConnected).toBe(true);
    record.fail(new Error("Native XML rejected"));
    expect(await pending).toEqual({status: "retryable-failure", message: "Native XML rejected"});
    record.ready();
    await settle();
    expect(harness.nativeEvents).toEqual(["destroyed:profile-1"]);
    expect(element.children.length).toBe(0);
  });

  it.each(["unadvertised", "missing"])("renders without management APIs when they are %s", async condition => {
    const harness = fixture("file-promise");
    if (condition === "unadvertised") harness.sdk.getSupportedAPIs = () => [apiNames["file-promise"]];
    else {delete harness.overlays.getOverlayViews; delete harness.overlays.setCustomEventHandler;}
    const {dispose} = await rendered(harness.sdk);
    expect(harness.nativeEvents).toEqual(["shown:profile-1"]);
    harness.emit("rq_profile_photo_error", "profile-1");
    await settle();
    await dispose();
    expect(harness.nativeEvents).toEqual(["shown:profile-1", "destroyed:profile-1"]);
    expect(harness.managementEvents).toEqual([]);
    expect(harness.records.length).toBe(1);
  });

  it("reclaims a callback handle on abort before readiness and ignores its late callback", async () => {
    const harness = fixture("file-callback", {holdReady: true});
    const element = surface();
    const controller = new AbortController();
    const pending = capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element, signal: controller.signal});
    await until(() => harness.records.length === 1);
    const record = harness.records[0];
    expect(record.frame.isConnected).toBe(true);
    controller.abort();
    expect(await pending).toEqual({status: "cancelled"});
    await until(() => record.state === "destroyed");
    record.ready();
    await settle();
    expect(element.children.length).toBe(0);
    expect(harness.nativeEvents).toEqual(["destroyed:profile-1"]);
  });

  it("reclaims rejected async initialization from inventory without destroying another surface", async () => {
    const harness = fixture("file-promise", {initializationFailure: new Error("XML initialization failed")});
    const foreign = harness.create("foreign.xml", undefined);
    const foreignSurface = surface();
    foreignSurface.appendChild(foreign.frame);
    const element = surface();
    const result = await capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element});
    expect(result.status).toBe("retryable-failure");
    expect(harness.records[1].state).toBe("destroyed");
    expect(element.children.length).toBe(0);
    expect(foreign.frame.parentElement).toBe(foreignSurface);
    expect([...harness.inventory.keys()]).toEqual(["profile-1"]);
    expect(harness.nativeEvents).toEqual(["destroyed:profile-2"]);
  });

  it("reclaims a pending async view on abort and does not dispose the same late handle twice", async () => {
    const harness = fixture("file-promise", {holdReady: true});
    const element = surface();
    const controller = new AbortController();
    const pending = capability(harness.sdk).renderPlayer({playerId: "current-player", surface: element, signal: controller.signal});
    await until(() => harness.records.length === 1);
    expect(harness.records[0].frame.parentElement).toBe(element);
    controller.abort();
    expect(await pending).toEqual({status: "cancelled"});
    await until(() => harness.records[0].state === "destroyed");
    harness.records[0].ready();
    await settle();
    expect(harness.nativeEvents).toEqual(["destroyed:profile-1"]);
    expect(element.children.length).toBe(0);
  });

  it("rejects a changed account before a pending generic view can be shown", async () => {
    const harness = fixture("inline-promise", {holdReady: true});
    const pending = capability(harness.sdk).renderPlayer({playerId: "current-player", surface: surface()});
    await until(() => harness.records.length === 1);
    harness.setPlayer("replacement-player");
    harness.records[0].ready();
    expect((await pending).status).toBe("retryable-failure");
    expect(harness.nativeEvents).toEqual(["destroyed:profile-1"]);
  });

  it("routes image errors to their owning overlay and replaces only that profile with a name-only view", async () => {
    const harness = fixture("file-promise");
    const first = await rendered(harness.sdk);
    const second = await rendered(harness.sdk);
    harness.emit("unknown-event", "profile-1");
    harness.emit("rq_profile_photo_error", "unknown-view");
    harness.emit("rq_profile_photo_error", "profile-1");
    await until(() => harness.records.length === 3 && harness.records[2].state === "shown");
    expect(harness.records.map(record => [record.content, record.state])).toEqual([
      ["facebook-overlays/profile.xml", "destroyed"],
      ["facebook-overlays/profile.xml", "shown"],
      ["facebook-overlays/profile-name.xml", "shown"],
    ]);
    expect(harness.records[2].frame.parentElement).toBe(first.element);
    expect(harness.records[1].frame.parentElement).toBe(second.element);
    harness.emit("rq_profile_photo_error", "profile-1");
    harness.emit("rq_profile_photo_error", "profile-3");
    await settle();
    expect(harness.records.length).toBe(3);
    await first.dispose();
    harness.emit("rq_profile_photo_error", "profile-3");
    harness.emit("rq_profile_photo_error", "profile-2");
    await until(() => harness.records.length === 4 && harness.records[3].state === "shown");
    expect(first.element.children.length).toBe(0);
    expect(second.element.children.length).toBe(1);
    expect(harness.records[3].content).toBe("facebook-overlays/profile-name.xml");
  });

  it("supports the legacy dismiss-only view contract when no destroy method exists", async () => {
    const harness = fixture("inline-promise", {legacyDismiss: true});
    const {dispose} = await rendered(harness.sdk);
    await dispose(); await dispose();
    expect(harness.nativeEvents).toEqual(["shown:profile-1", "dismissed:profile-1"]);
    expect(harness.records[0].state).toBe("dismissed");
  });
});
