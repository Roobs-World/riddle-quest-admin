/** Compile-time target guard; Vite removes Facebook's unsupported iframe fallback. */
export const isFacebookWebTarget = import.meta.env.VITE_PLATFORM_TARGET === "facebook";

/** Jest's current release supports English independently of the other web targets. */
export const isJestWebTarget = import.meta.env.VITE_PLATFORM_TARGET === "jest";
