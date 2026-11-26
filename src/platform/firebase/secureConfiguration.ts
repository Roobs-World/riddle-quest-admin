/** Region settings must never become custom Functions endpoint URLs. */
export function isFirebaseFunctionsRegion(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]+(?:-[a-z]+)+[0-9]+$/u.test(value);
}

/** Validates configuration before the SDK can interpret it as a custom domain. */
export function firebaseFunctionsRegion(value: string): string {
  if (!isFirebaseFunctionsRegion(value)) throw new Error("Firebase Functions configuration must use a region name.");
  return value;
}
