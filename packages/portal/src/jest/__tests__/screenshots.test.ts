import {
  captureGameScreenshot,
  captureVictoryShareImage,
  sizeCheckedScreenshotProvider,
} from "../sharing/screenshots";

it("rejects non-PNG and oversized screenshots", async () => {
  expect(await sizeCheckedScreenshotProvider(() => "data:image/jpeg;base64,YQ==")()).toBeNull();
  expect(await sizeCheckedScreenshotProvider(() => `data:image/png;base64,${"A".repeat(2_800_000)}`)()).toBeNull();
});
it("accepts a small PNG data URL", async () => expect(await sizeCheckedScreenshotProvider(() => "data:image/png;base64,YQ==")()).toBe("data:image/png;base64,YQ=="));
it("accounts for single-padding PNG data URLs", async () => expect(
  await sizeCheckedScreenshotProvider(() => "data:image/png;base64,YWI=")(),
).toBe("data:image/png;base64,YWI="));
it("preserves a provider cancellation", async () => expect(await sizeCheckedScreenshotProvider(() => null)()).toBeNull());

const installDocument = (input: {text?: string | null; context?: Record<string, unknown> | null}) => {
  const gradient = {addColorStop: jest.fn()};
  const context = input.context === null ? null : {
    createLinearGradient: jest.fn(() => gradient),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn((text: string) => ({width: text.length * 20})),
    ...input.context,
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(() => "data:image/png;base64,YQ=="),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: jest.fn(() => input.text === undefined ? null : {textContent: input.text}),
      createElement: jest.fn(() => canvas),
    },
  });
  return {canvas, context, gradient};
};

describe("screenshot capture", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("returns null without visible game content or a canvas context", () => {
    installDocument({});
    expect(captureGameScreenshot()).toBeNull();
    installDocument({text: "   "});
    expect(captureGameScreenshot()).toBeNull();
    installDocument({text: "Visible", context: null});
    expect(captureGameScreenshot()).toBeNull();
    installDocument({text: "ignored", context: null});
    expect(captureVictoryShareImage({title: "Win", summary: "Summary", emojiGrid: "🟩"})).toBeNull();
  });

  it("renders game copy with wrapping and returns a PNG", () => {
    const {canvas, context} = installDocument({
      text: "A deliberately long game summary that wraps across several lines for the generated sharing card ".repeat(8),
    });
    expect(captureGameScreenshot()).toBe("data:image/png;base64,YQ==");
    expect(canvas).toMatchObject({width: 1200, height: 630});
    expect(context?.fillText).toHaveBeenCalled();
  });

  it("renders short copy without forcing a line wrap", () => {
    const {context} = installDocument({text: "Short summary"});
    expect(captureGameScreenshot()).toBe("data:image/png;base64,YQ==");
    expect(context?.fillText).toHaveBeenCalledWith("Short summary", 72, 180);
  });

  it("renders a bounded victory card and recent emoji rows", () => {
    const {context, gradient} = installDocument({text: "unused"});
    expect(captureVictoryShareImage({
      title: "T".repeat(100),
      summary: "S".repeat(120),
      emojiGrid: Array.from({length: 9}, () => "🟩".repeat(30)).join("\n"),
    })).toBe("data:image/png;base64,YQ==");
    expect(gradient.addColorStop).toHaveBeenCalledTimes(3);
    expect(context?.fillText).toHaveBeenCalled();
  });
});
