/** Compile-time target guard; Vite removes Facebook's unsupported iframe fallback. */
export const isFacebookWebTarget = import.meta.env.VITE_PLATFORM_TARGET === "facebook";
