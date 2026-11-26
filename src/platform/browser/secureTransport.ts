type SecureTransportOptions = Readonly<{allowInsecureLoopback?: boolean}>;

function assertSecureUrl(url: URL, options: SecureTransportOptions): void {
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.username || url.password ||
      !(url.protocol === "https:" || options.allowInsecureLoopback && url.protocol === "http:" && loopback)) {
    throw new Error("Server connections must use HTTPS.");
  }
}

/** Prevents a remotely hosted HTTP page from sending game data or credentials. */
export function assertSecureBrowserOrigin(options: SecureTransportOptions = {}): void {
  if (!globalThis.location?.origin) throw new Error("A secure browser origin is required.");
  assertSecureUrl(new URL(globalThis.location.origin), options);
}

/** Validates the actual transport used by absolute and same-origin server URLs. */
export function resolveSecureHttpUrl(value: string, options: SecureTransportOptions = {}): string {
  const trimmed = value.trim();
  if (!trimmed || /[\\\u0000-\u001f\u007f]/u.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error("Server URL must be HTTPS or a root-relative path.");
  }
  if (trimmed.startsWith("/")) {
    assertSecureBrowserOrigin(options);
    const url = new URL(trimmed, globalThis.location.origin);
    if (url.origin !== globalThis.location.origin) throw new Error("Server URL must remain same-origin.");
    return trimmed;
  }
  const url = new URL(trimmed);
  assertSecureUrl(url, options);
  return url.toString();
}
