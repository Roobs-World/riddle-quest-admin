import {validateAvatarFile} from "../avatarImage";

describe("avatar image validation", () => {
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
});
