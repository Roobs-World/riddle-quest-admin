/** Jest's current release supports English independently of the other web targets. */
export const isJestWebTarget = import.meta.env.VITE_PLATFORM_TARGET === "jest";
