import {avatarDownloadUrl, decodeAvatarDataUrl} from "../profile/avatarUpload";

describe("avatar upload validation", () => {
  it("accepts a matching PNG signature", () => {
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
    const oversized = Buffer.alloc(512 * 1024 + 1, 0x89);
    expect(() => decodeAvatarDataUrl(`data:image/png;base64,${oversized.toString("base64")}`)).toThrow(
      "invalid-avatar-size",
    );
  });

  it("rejects incomplete WebP containers", () => {
    const wrongContainer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x4e, 0x4f, 0x50, 0x45]);
    expect(() => decodeAvatarDataUrl(`data:image/webp;base64,${wrongContainer.toString("base64")}`)).toThrow(
      "invalid-avatar-signature",
    );
  });

  it("rejects content whose signature does not match its declared type", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => decodeAvatarDataUrl(`data:image/jpeg;base64,${bytes.toString("base64")}`)).toThrow(
      "invalid-avatar-signature",
    );
  });

  it("creates a tokenized Firebase Storage download URL", () => {
    expect(avatarDownloadUrl("bucket", "avatars/player one/profile", "token value")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/" +
      "avatars%2Fplayer%20one%2Fprofile?alt=media&token=token%20value",
    );
  });
});
