import {avatarDownloadUrl, decodeAvatarDataUrl} from "../profile/avatarUpload";

describe("avatar upload validation", () => {
  it("accepts a matching PNG signature", () => {
    /** Provides bytes behavior. */
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeAvatarDataUrl(`data:image/png;base64,${bytes.toString("base64")}`)).toEqual({
      bytes,
      contentType: "image/png",
    });
  });

  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/webp", Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
  ] as const)("accepts a matching %s signature", (contentType, bytes) => {
    expect(decodeAvatarDataUrl(`data:${contentType};base64,${bytes.toString("base64")}`)).toEqual({
      bytes,
      contentType,
    });
  });

  it("rejects malformed and oversized payloads", () => {
    expect(() => decodeAvatarDataUrl("not-a-data-url")).toThrow("invalid-avatar-data");
    /** Provides oversized behavior. */
    const oversized = Buffer.alloc(512 * 1024 + 1, 0x89);
    expect(() => decodeAvatarDataUrl(`data:image/png;base64,${oversized.toString("base64")}`)).toThrow(
      "invalid-avatar-size",
    );
  });

  it("rejects incomplete WebP containers", () => {
    /** Provides wrong container behavior. */
    const wrongContainer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x4e, 0x4f, 0x50, 0x45]);
    expect(() => decodeAvatarDataUrl(`data:image/webp;base64,${wrongContainer.toString("base64")}`)).toThrow(
      "invalid-avatar-signature",
    );
  });

  it("rejects content whose signature does not match its declared type", () => {
    /** Provides bytes behavior. */
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => decodeAvatarDataUrl(`data:image/jpeg;base64,${bytes.toString("base64")}`)).toThrow(
      "invalid-avatar-signature",
    );
  });

  it("uses local Storage only inside the Functions emulator and leaves production URLs unchanged", () => {
    /** Environment values are restored even when an assertion fails. */
    const beforeFunctions = process.env.FUNCTIONS_EMULATOR;
    /** Existing emulator endpoint, if this suite was started under the emulator runner. */
    const beforeStorage = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    try {
      process.env.FUNCTIONS_EMULATOR = "true";
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
      expect(avatarDownloadUrl("bucket", "avatars/player/profile", "token")).toBe(
        "http://127.0.0.1:9199/v0/b/bucket/o/avatars%2Fplayer%2Fprofile?alt=media&token=token",
      );
      delete process.env.FUNCTIONS_EMULATOR;
      expect(avatarDownloadUrl("bucket", "avatars/player/profile", "token")).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\//u);
    } finally {
      if (beforeFunctions === undefined) delete process.env.FUNCTIONS_EMULATOR; else process.env.FUNCTIONS_EMULATOR = beforeFunctions;
      if (beforeStorage === undefined) delete process.env.FIREBASE_STORAGE_EMULATOR_HOST; else process.env.FIREBASE_STORAGE_EMULATOR_HOST = beforeStorage;
    }
  });

  it("creates a tokenized Firebase Storage download URL", () => {
    expect(avatarDownloadUrl("bucket", "avatars/player one/profile", "token value")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/" +
        "avatars%2Fplayer%20one%2Fprofile?alt=media&token=token%20value",
    );
  });
});
