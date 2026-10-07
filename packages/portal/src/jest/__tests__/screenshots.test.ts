import {
  captureGameScreenshot,
  captureVictoryShareImage,
  sizeCheckedScreenshotProvider,
  sizeCheckedShareImage,
} from "../sharing/screenshots";

it("rejects non-PNG and oversized screenshots", async () => {
  expect(await sizeCheckedScreenshotProvider(() => "data:image/jpeg;base64,YQ==")()).toBeNull();
  expect(await sizeCheckedScreenshotProvider(() => `data:image/png;base64,${"A".repeat(2_800_000)}`)()).toBeNull();
});
it("rejects base64 expansion that exceeds the URL limit even when decoded bytes fit", async () => {
  /** A 1.5 MiB image expands to 2 MiB before the data URL prefix is added. */
  const image = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`;
  expect(await sizeCheckedScreenshotProvider(async () => image)()).toBeNull();
});
it("accepts the largest base64 block below the URL limit and rejects the next block", async () => {
  /** Largest multiple-of-four payload that fits with the PNG data URL prefix. */
  const image = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024 - 24)}`;
  expect(await sizeCheckedScreenshotProvider(() => image)()).toBe(image);
  expect(await sizeCheckedScreenshotProvider(() => `${image}AAAA`)()).toBeNull();
});
it("accepts a small PNG data URL", async () =>
  expect(await sizeCheckedScreenshotProvider(() => "data:image/png;base64,YQ==")()).toBe("data:image/png;base64,YQ=="));
it("accounts for single-padding PNG data URLs", async () =>
  expect(await sizeCheckedScreenshotProvider(() => "data:image/png;base64,YWI=")()).toBe("data:image/png;base64,YWI="));
it("preserves a provider cancellation", async () =>
  expect(await sizeCheckedScreenshotProvider(() => null)()).toBeNull());
it("validates an already-created custom share image synchronously", () => {
  expect(sizeCheckedShareImage("data:image/png;base64,YQ==")).toBe("data:image/png;base64,YQ==");
  expect(sizeCheckedShareImage("data:image/jpeg;base64,YQ==")).toBeNull();
});

/** Provides install document behavior. */
const installDocument = (input: {
  /** Stores text. */
  text?: string | null; /** Stores context. */
  /** Stores context. */
  context?: Record<string, unknown> | null;
}) => {
  /** Provides gradient behavior. */
  const gradient = {addColorStop: jest.fn()};
  /** Provides context behavior. */
  const context =
    input.context === null
      ? null
      : {
          createLinearGradient: jest.fn(() => gradient),
          fillRect: jest.fn(),
          fillText: jest.fn(),
          measureText: jest.fn((text: string) => ({width: text.length * 20})),
          ...input.context,
        };
  /** Provides canvas behavior. */
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(() => "data:image/png;base64,YQ=="),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: jest.fn(() => (input.text === undefined ? null : {textContent: input.text})),
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
    /** Provides {canvas, context} behavior. */
    const {canvas, context} = installDocument({
      text: "A deliberately long game summary that wraps across several lines for the generated sharing card ".repeat(
        8,
      ),
    });
    expect(captureGameScreenshot()).toBe("data:image/png;base64,YQ==");
    expect(canvas).toMatchObject({width: 1200, height: 630});
    expect(context?.fillText).toHaveBeenCalled();
  });

  it("renders short copy without forcing a line wrap", () => {
    /** Provides {context} behavior. */
    const {context} = installDocument({text: "Short summary"});
    expect(captureGameScreenshot()).toBe("data:image/png;base64,YQ==");
    expect(context?.fillText).toHaveBeenCalledWith("Short summary", 72, 180);
  });

  it("renders a bounded victory card and recent emoji rows", () => {
    /** Provides {context, gradient} behavior. */
    const {context, gradient} = installDocument({text: "unused"});
    expect(
      captureVictoryShareImage({
        title: "T".repeat(100),
        summary: "S".repeat(120),
        emojiGrid: Array.from({length: 9}, () => "🟩".repeat(30)).join("\n"),
      }),
    ).toBe("data:image/png;base64,YQ==");
    expect(gradient.addColorStop).toHaveBeenCalledTimes(3);
    expect(context?.fillText).toHaveBeenCalled();
  });
});
