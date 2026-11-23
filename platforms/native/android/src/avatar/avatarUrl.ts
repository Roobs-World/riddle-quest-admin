/** Adapts only local Storage emulator URLs to the host reachable from this device. */
export function deviceAvatarUrl(value: string, emulatorHost?: string): string {
  if (!emulatorHost) return value;
  // React Native's URL implementation exposes hostname as a getter without a setter.
  return value.replace(/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?=:\d+\/v0\/b\/|\/v0\/b\/)/u, `http://${emulatorHost}`);
}
