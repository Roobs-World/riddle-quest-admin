import {createNotificationAsset, isValidNotificationAsset, notificationAsset} from "../notifications/inlineAsset";
import {scheduleEngagementReminders} from "../notifications/engagement";
import type {JestPlatformPort} from "../types";

/** Existing notification copy used by renderer fixtures. */
const content = {title: "Riddle-Q", body: "Ada, today's riddle is ready.", ctaText: "Solve it"};
/** Small encoded payload for unit-level boundary tests. */
const png = "data:image/png;base64,YQ==";

afterEach(() => Reflect.deleteProperty(globalThis, "document"));

/** Installs a controllable canvas without a browser. */
function installCanvas(result = png, available = true) {
  /** Text measurements and drawing calls captured for layout assertions. */
  const context = {
    createLinearGradient: () => ({addColorStop: jest.fn()}),
    fillRect: jest.fn(), fillText: jest.fn(),
    measureText: (text: string) => ({width: [...text].length * 36}),
  };
  /** Encoded output and dimensions observed by the tests. */
  const canvas = {width: 0, height: 0, getContext: () => available ? context : null, toDataURL: jest.fn(() => result)};
  Object.defineProperty(globalThis, "document", {configurable: true, value: {createElement: () => canvas}});
  return {canvas, context};
}

it.each(["png", "jpeg", "webp"])("accepts %s inline images", (format) => {
  expect(isValidNotificationAsset(`data:image/${format};base64,YQ==`)).toBe(true);
});

it.each(["", "https://example.com/card.png", "data:image/gif;base64,YQ==", "data:image/svg+xml;base64,YQ==",
  "data:image/png;base64,", "data:image/png;base64,YQ", "data:image/png;base64,!!!!", "data:image/png;base64,Y=Q="])("rejects invalid inline asset %s", (asset) => {
  expect(isValidNotificationAsset(asset)).toBe(false);
});

it("enforces the decoded 2MB boundary, including base64 padding", () => {
  /** Generates precisely sized decoded payloads. */
  const asset = (bytes: number) => `data:image/png;base64,${Buffer.alloc(bytes).toString("base64")}`;
  expect(isValidNotificationAsset(asset(2 * 1024 * 1024))).toBe(true);
  expect(isValidNotificationAsset(asset(2 * 1024 * 1024 + 1))).toBe(false);
});

it("creates a 3:2 card from existing translated content and prefers it to the library reference", () => {
  /** Captured surface and draw operations. */
  const {canvas, context} = installCanvas();
  expect(notificationAsset(content, "approved-card")).toEqual({asset: png});
  expect(canvas).toMatchObject({width: 900, height: 600});
  expect(context.fillText).toHaveBeenCalledWith(content.title, 60, 100, 780);
  expect(context.fillText).toHaveBeenCalledWith(content.ctaText, 84, 532, 732);
  expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
});

it("wraps writing systems without spaces by Unicode code point", () => {
  /** Draw calls verify wrapping for scripts without spaces. */
  const {context} = installCanvas();
  expect(createNotificationAsset({...content, body: "界".repeat(40)})).toBe(png);
  expect(context.fillText).toHaveBeenCalledWith("界".repeat(21), 60, 195, 780);
  expect(context.fillText).toHaveBeenCalledWith("界".repeat(19), 60, 247, 780);
});

it("keeps ordinary words together when wrapping notification text", () => {
  /** Draw calls verify complete words at line boundaries. */
  const {context} = installCanvas();
  createNotificationAsset({...content, body: "A friend finished. Check the result."});
  expect(context.fillText).toHaveBeenCalledWith("A friend finished.", 60, 195, 780);
  expect(context.fillText).toHaveBeenCalledWith("Check the result.", 60, 247, 780);
});

it("falls back instead of sending a card whose text overlaps the call to action", () => {
  installCanvas();
  expect(notificationAsset({...content, body: Array(8).fill("abcdefghijklm").join(" ")}, "approved-card"))
    .toEqual({assetReference: "approved-card"});
});

it("keeps reference/Hero fallbacks when canvas is unavailable, throws, or produces an oversized image", () => {
  expect(notificationAsset(content, "approved-card")).toEqual({assetReference: "approved-card"});
  expect(notificationAsset(content)).toEqual({});
  installCanvas(png, false);
  expect(createNotificationAsset(content)).toBeNull();
  /** Controllable encoded image generation. */
  const {canvas} = installCanvas();
  canvas.toDataURL.mockImplementation(() => {throw new Error("Canvas unavailable");});
  expect(notificationAsset(content, "approved-card")).toEqual({assetReference: "approved-card"});
  installCanvas(`data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}`);
  expect(notificationAsset(content, "approved-card")).toEqual({assetReference: "approved-card"});
});

it("renders only three personalized cards and reuses them across all seven reminders", async () => {
  /** Controllable encoded image generation. */
  const {canvas} = installCanvas();
  canvas.toDataURL.mockReturnValueOnce("data:image/png;base64,YQ==").mockReturnValueOnce("data:image/png;base64,Yg==").mockReturnValueOnce("data:image/png;base64,Yw==");
  /** Records every payload crossing the platform boundary. */
  const scheduleNotification = jest.fn().mockResolvedValue({status: "success", value: undefined});
  await scheduleEngagementReminders({scheduleNotification} as unknown as JestPlatformPort, {
    gameTitle: content.title, dailyBody: content.body, streakBody: "12 wins and a 3-day streak.",
    weeklyBody: "Level 8 solver.", dailyCta: content.ctaText, streakCta: "Start streak", weeklyCta: "Claim coins",
    assetReference: "approved-card",
  });
  expect(canvas.toDataURL).toHaveBeenCalledTimes(3);
  expect(scheduleNotification.mock.calls.map(([payload]) => payload.asset)).toEqual([
    "data:image/png;base64,YQ==", "data:image/png;base64,Yg==", "data:image/png;base64,Yw==",
    "data:image/png;base64,YQ==", "data:image/png;base64,Yg==", "data:image/png;base64,Yw==", "data:image/png;base64,YQ==",
  ]);
  expect(scheduleNotification.mock.calls.every(([payload]) => payload.assetReference === undefined)).toBe(true);
});
