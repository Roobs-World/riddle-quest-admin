import {isValidNotificationAsset} from "../notifications/inlineAsset";

it.each(["png", "jpeg", "webp"])("accepts %s inline images", (format) => {
  expect(isValidNotificationAsset(`data:image/${format};base64,YQ==`)).toBe(true);
});

it.each(["https://example.com/card.png", `https://example.com/${"x".repeat(2048 - "https://example.com/".length)}`])("accepts HTTPS asset %s", (asset) => {
  expect(isValidNotificationAsset(asset)).toBe(true);
});

it.each(["", "http://example.com/card.png", "https://example.com/card image.png", `https://example.com/${"x".repeat(2049 - "https://example.com/".length)}`, "data:image/gif;base64,YQ==", "data:image/svg+xml;base64,YQ==",
  "data:image/png;base64,", "data:image/png;base64,YQ", "data:image/png;base64,!!!!", "data:image/png;base64,Y=Q="])("rejects invalid inline asset %s", (asset) => {
  expect(isValidNotificationAsset(asset)).toBe(false);
});

it("enforces the complete 2MB data URL boundary, including its prefix and base64 expansion", () => {
  /** Generates precisely sized decoded payloads. */
  const asset = (bytes: number) => `data:image/png;base64,${Buffer.alloc(bytes).toString("base64")}`;
  /** Largest complete base64 block that fits with the PNG data URL prefix. */
  const maximumDecodedBytes = Math.floor((2 * 1024 * 1024 - "data:image/png;base64,".length) / 4) * 3;
  expect(isValidNotificationAsset(asset(maximumDecodedBytes))).toBe(true);
  expect(isValidNotificationAsset(asset(maximumDecodedBytes + 1))).toBe(false);
});
