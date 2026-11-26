/** A stable receipt fingerprint lets analytics deduplicate grants without receiving the receipt. */
export async function createPurchaseAnalyticsId(platform: "jest", receipt: string): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(receipt));
    return `${platform}-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return undefined;
  }
}
