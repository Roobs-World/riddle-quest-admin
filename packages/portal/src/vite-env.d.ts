/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Compile-time Web Target selected by the Vite build profile. */
  readonly VITE_PLATFORM_TARGET: "jest" | "facebook" | "reddit" | "youtube";
}
