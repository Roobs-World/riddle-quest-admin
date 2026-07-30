import {avatarDownloadUrl, decodeAvatarDataUrl} from "../avatarUpload";

describe("avatar upload validation", () => {
  it("accepts a matching PNG signature", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeAvatarDataUrl(`data:image/png;base64,${bytes.toString("base64")}`)).toEqual({
      bytes,
      contentType: "image/png",
    });
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
