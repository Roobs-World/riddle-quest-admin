"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avatarDownloadUrl = void 0;
exports.decodeAvatarDataUrl = decodeAvatarDataUrl;
/** Defines the max avatar bytes value. */
const MAX_AVATAR_BYTES = 512 * 1024;
/** Indicates whether has prefix. */
const hasPrefix = (value, prefix) => prefix.every((byte, index) => value[index] === byte);
/** Provides decode avatar data url behavior. */
function decodeAvatarDataUrl(imageDataUrl) {
    /** Provides match behavior. */
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageDataUrl);
    if (!match)
        throw new Error("invalid-avatar-data");
    /** Provides content type behavior. */
    const contentType = match[1];
    /** Provides bytes behavior. */
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES)
        throw new Error("invalid-avatar-size");
    /** Provides signature matches behavior. */
    const signatureMatches = (contentType === "image/jpeg" && hasPrefix(bytes, [0xff, 0xd8, 0xff])) ||
        (contentType === "image/png" && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
        (contentType === "image/webp" &&
            hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
            bytes.subarray(8, 12).toString("ascii") === "WEBP");
    if (!signatureMatches)
        throw new Error("invalid-avatar-signature");
    return { bytes, contentType };
}
/** Provides avatar download url behavior. */
const avatarDownloadUrl = (bucketName, objectPath, downloadToken) => `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/` +
    `${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
exports.avatarDownloadUrl = avatarDownloadUrl;
//# sourceMappingURL=avatarUpload.js.map