/** Defines the max avatar bytes value. */
const MAX_AVATAR_BYTES = 512 * 1024;

/** Indicates whether has prefix. */
const hasPrefix = (value: Buffer, prefix: readonly number[]) => prefix.every((byte, index) => value[index] === byte);

/** Provides decode avatar data url behavior. */
export function decodeAvatarDataUrl(imageDataUrl: string): {
  /** Stores bytes. */
  bytes: Buffer;
  /** Stores content type. */
  contentType: "image/jpeg" | "image/png" | "image/webp";
} {
  /** Provides match behavior. */
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageDataUrl);
  if (!match) throw new Error("invalid-avatar-data");
  /** Provides content type behavior. */
  const contentType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  /** Provides bytes behavior. */
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) throw new Error("invalid-avatar-size");

  /** Provides signature matches behavior. */
  const signatureMatches =
    (contentType === "image/jpeg" && hasPrefix(bytes, [0xff, 0xd8, 0xff])) ||
    (contentType === "image/png" && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (contentType === "image/webp" &&
      hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!signatureMatches) throw new Error("invalid-avatar-signature");
  return {bytes, contentType};
}

/** Provides avatar download url behavior. */
export const avatarDownloadUrl = (bucketName: string, objectPath: string, downloadToken: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/` +
  `${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
