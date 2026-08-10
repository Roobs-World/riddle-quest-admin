import {prepareAvatarImage, validateAvatarFile} from "../avatarImage";

describe("avatar image validation", () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const originalFileReader = globalThis.FileReader;

  afterEach(() => {
    Object.defineProperty(globalThis, "createImageBitmap", {configurable: true, value: originalCreateImageBitmap});
    Object.defineProperty(globalThis, "document", {configurable: true, value: originalDocument});
    Object.defineProperty(globalThis, "FileReader", {configurable: true, value: originalFileReader});
  });

  it("accepts supported image files within the upload limit", () => {
    expect(() => validateAvatarFile({type: "image/png", size: 1024})).not.toThrow();
    expect(() => validateAvatarFile({type: "image/jpeg", size: 5 * 1024 * 1024})).not.toThrow();
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(() => validateAvatarFile({type: "image/gif", size: 1024})).toThrow("invalid-avatar-file");
    expect(() => validateAvatarFile({type: "image/png", size: 0})).toThrow("invalid-avatar-file");
    expect(() => validateAvatarFile({type: "image/webp", size: 5 * 1024 * 1024 + 1})).toThrow(
      "invalid-avatar-file",
    );
  });

  const installImageEnvironment = ({
    context = {drawImage: jest.fn()},
    encodedBlob = new Blob(["avatar"], {type: "image/webp"}),
    readerResult = "data:image/webp;base64,YXZhdGFy",
    readerError = false,
  }: {
    context?: {drawImage: jest.Mock} | null;
    encodedBlob?: Blob | null;
    readerResult?: unknown;
    readerError?: boolean;
  } = {}) => {
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn(async () => ({width: 400, height: 200, close})),
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context),
      toBlob: jest.fn((callback: (blob: Blob | null) => void) => callback(encodedBlob)),
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {createElement: jest.fn(() => canvas)},
    });
    class TestFileReader {
      public result: unknown = readerResult;
      public onerror: (() => void) | null = null;
      public onload: (() => void) | null = null;

      public readAsDataURL(): void {
        if (readerError) this.onerror?.();
        else this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "FileReader", {configurable: true, value: TestFileReader});
    return {canvas, close, context};
  };

  it("crops, encodes, and reads a square WebP avatar", async () => {
    const environment = installImageEnvironment();

    await expect(prepareAvatarImage({type: "image/png", size: 100} as File)).resolves.toBe(
      "data:image/webp;base64,YXZhdGFy",
    );

    expect(environment.canvas).toEqual(expect.objectContaining({width: 256, height: 256}));
    expect(environment.context?.drawImage).toHaveBeenCalledWith(
      expect.objectContaining({width: 400, height: 200}),
      100,
      0,
      200,
      200,
      0,
      0,
      256,
      256,
    );
    expect(environment.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing canvas", {context: null}, "avatar-canvas-unavailable"],
    ["failed encoding", {encodedBlob: null}, "avatar-encoding-failed"],
    ["oversized output", {encodedBlob: new Blob([new Uint8Array(512 * 1024 + 1)])}, "avatar-output-too-large"],
    ["reader error", {readerError: true}, "avatar-read-failed"],
    ["non-string reader result", {readerResult: new ArrayBuffer(1)}, "avatar-read-failed"],
  ] as const)("closes the bitmap after %s", async (_label, options, message) => {
    const environment = installImageEnvironment(options as Parameters<typeof installImageEnvironment>[0]);

    await expect(prepareAvatarImage({type: "image/png", size: 100} as File)).rejects.toThrow(message);
    expect(environment.close).toHaveBeenCalledTimes(1);
  });
});
