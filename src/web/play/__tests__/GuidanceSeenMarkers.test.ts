import {GuidanceSeenMarkers} from "../guidance/GuidanceSeenMarkers";

/** Original storage owner restored after the embedded-browser failure tests. */
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
/** Independent markers in the two browser storage areas. */
const localValues = new Map<string, string>(), sessionValues = new Map<string, string>();
/** Whether the browser rejects writes while retaining readable older markers. */
let quotaBlocked = false;
/** Minimal browser storage used by the real defensive storage helpers. */
const storage = (values: Map<string, string>) => ({
  /** Reads only durable markers. */
  getItem: (key: string) => values.get(key) ?? null,
  /** A failed marker write must not trap the current view in its completed tour. */
  setItem: (key: string, value: string) => {
    if (quotaBlocked) throw new DOMException("Full", "QuotaExceededError");
    values.set(key, value);
  },
});

beforeEach(() => {
  localValues.clear();sessionValues.clear();quotaBlocked = false;
  Object.defineProperty(globalThis, "window", {configurable: true, value: {
    localStorage: storage(localValues), sessionStorage: storage(sessionValues),
  }});
});
afterAll(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

it("ends a completed tour in the current view despite a quota failure", () => {
  quotaBlocked = true;
  /** Current presentation lifetime retains completion despite failed browser persistence. */
  const markers = new GuidanceSeenMarkers();
  markers.markSeen("local", "tour:player-a");
  expect(localValues.has("tour:player-a")).toBe(false);
  expect(markers.hasSeen("local", "tour:player-a")).toBe(true);
  expect(markers.hasSeen("local", "tour:player-b")).toBe(false);
  expect(markers.hasSeen("session", "tour:player-a")).toBe(false);
});

it("ends completed guidance when both browser getters are blocked", () => {
  Object.defineProperties(window, {
    localStorage: {get: () => {throw new DOMException("Blocked", "SecurityError");}},
    sessionStorage: {get: () => {throw new DOMException("Blocked", "SecurityError");}},
  });
  /** Both welcome and subsequent tooltip completion belong to the mounted view. */
  const markers = new GuidanceSeenMarkers();
  markers.markSeen("session", "welcome:player-a");
  markers.markSeen("local", "tour:player-a");
  expect(markers.hasSeen("session", "welcome:player-a")).toBe(true);
  expect(markers.hasSeen("local", "tour:player-a")).toBe(true);
});

it("does not give a replacement player view a false durability acknowledgement", () => {
  quotaBlocked = true;
  /** The first view has completed a tour whose browser marker was rejected. */
  const previous = new GuidanceSeenMarkers();
  previous.markSeen("local", "tour:player-a");
  /** Replacement lifetime must read the real durable marker independently. */
  const replacement = new GuidanceSeenMarkers();
  expect(replacement.hasSeen("local", "tour:player-a")).toBe(false);
});

it("reads successfully saved markers in a replacement view", () => {
  /** Healthy storage retains the existing reload behavior. */
  const previous = new GuidanceSeenMarkers();
  previous.markSeen("local", "tour:player-a");
  expect(localValues.get("tour:player-a")).toBe("seen");
  expect(new GuidanceSeenMarkers().hasSeen("local", "tour:player-a")).toBe(true);
});
