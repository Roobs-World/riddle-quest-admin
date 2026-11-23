import {prepareAvatarImage, validateAvatarFile} from "../avatarImage";

describe("avatar image validation", () => {
  /** Provides original create image bitmap behavior. */
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  /** Provides original document behavior. */
  const originalDocument = globalThis.document;
  /** Provides original file reader behavior. */
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
    expect(() => validateAvatarFile({type: "image/webp", size: 5 * 1024 * 1024 + 1})).toThrow("invalid-avatar-file");
  });

  /** Provides install image environment behavior. */
  const installImageEnvironment = ({
    context = {drawImage: jest.fn()},
    encodedBlob = new Blob(["avatar"], {type: "image/webp"}),
    readerResult = "data:image/webp;base64,YXZhdGFy",
    readerError = false,
  }: {
    /** Stores context. */
    context?: {
      /** Stores draw image. */
      drawImage: jest.Mock;
    } | null;
    /** Stores encoded blob. */
    encodedBlob?: Blob | null;
    /** Stores reader result. */
    readerResult?: unknown;
    /** Stores reader error. */
    readerError?: boolean;
  } = {}) => {
    /** Provides close behavior. */
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn(async () => ({width: 400, height: 200, close})),
    });
    /** Provides canvas behavior. */
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
    /** Provides test file reader behavior. */
    class TestFileReader {
      /** Stores result. */
      public result: unknown = readerResult;
      /** Stores onerror. */
      public onerror: (() => void) | null = null;
      /** Stores onload. */
      public onload: (() => void) | null = null;

      /** Reads as data url. */
      public readAsDataURL(): void {
        if (readerError) this.onerror?.();
        else this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "FileReader", {configurable: true, value: TestFileReader});
    return {canvas, close, context};
  };

  it("crops, encodes, and reads a square WebP avatar", async () => {
    /** Provides environment behavior. */
    const environment = installImageEnvironment();

    await expect(prepareAvatarImage({type: "image/png", size: 100} as File, new AbortController().signal)).resolves.toBe(
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

  it("does not decode an already retired valid selection", async () => {
    /** Retains the existing decoder and canvas controls. */
    const environment = installImageEnvironment();
    /** Represents a selection retired before preparation starts. */
    const controller = new AbortController();
    controller.abort();
    await expect(prepareAvatarImage({type: "image/png", size: 100} as File, controller.signal))
      .rejects.toMatchObject({name: "AbortError"});
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(document.createElement).not.toHaveBeenCalled();
    expect(environment.close).not.toHaveBeenCalled();
  });

  it("closes a decoded bitmap without allocating a canvas after retirement", async () => {
    /** The decoder resolves on the next microtask. */
    const environment = installImageEnvironment();
    /** Retires this selection while decoding remains pending. */
    const controller = new AbortController();
    /** Runs actual preparation across the pending decoder boundary. */
    const preparation = prepareAvatarImage({type: "image/png", size: 100} as File, controller.signal);
    controller.abort();
    await expect(preparation).rejects.toMatchObject({name: "AbortError"});
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(environment.close).toHaveBeenCalledTimes(1);
  });

  it("skips reading a completed encoding after retirement and closes its bitmap", async () => {
    /** Holds the encoder callback while retaining real stage ordering. */
    const environment = installImageEnvironment();
    /** Observes whether preparation starts a file read. */
    const read = jest.spyOn(FileReader.prototype, "readAsDataURL");
    /** Releases the pending encoding after its selection retires. */
    let release: ((blob: Blob | null) => void) | undefined;
    environment.canvas.toBlob.mockImplementation((callback) => {release = callback;});
    /** Cancels work between encoding and file reading. */
    const controller = new AbortController();
    /** Runs preparation until the encoder receives its callback. */
    const preparation = prepareAvatarImage({type: "image/png", size: 100} as File, controller.signal);
    await Promise.resolve();
    expect(environment.canvas.toBlob).toHaveBeenCalledTimes(1);
    controller.abort();
    release?.(new Blob(["avatar"], {type: "image/webp"}));
    await expect(preparation).rejects.toMatchObject({name: "AbortError"});
    expect(read).not.toHaveBeenCalled();
    expect(environment.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing canvas", {context: null}, "avatar-canvas-unavailable"],
    ["failed encoding", {encodedBlob: null}, "avatar-encoding-failed"],
    ["oversized output", {encodedBlob: new Blob([new Uint8Array(512 * 1024 + 1)])}, "avatar-output-too-large"],
    ["reader error", {readerError: true}, "avatar-read-failed"],
    ["non-string reader result", {readerResult: new ArrayBuffer(1)}, "avatar-read-failed"],
  ] as const)("closes the bitmap after %s", async (_label, options, message) => {
    /** Provides environment behavior. */
    const environment = installImageEnvironment(options as Parameters<typeof installImageEnvironment>[0]);

    await expect(prepareAvatarImage({type: "image/png", size: 100} as File)).rejects.toThrow(message);
    expect(environment.close).toHaveBeenCalledTimes(1);
  });
});
