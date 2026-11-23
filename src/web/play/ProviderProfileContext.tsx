import {createContext, useContext} from "react";

/** Optional display-only identity supplied by a target that owns its profile. */
export type ProviderProfile = {
  /** Provider-selected display name, or null when no profile is configured. */
  username: string | null;
  /** Provider-selected avatar, or null for the local fallback. */
  avatarUrl: string | null;
};

/** Absence leaves game-owned profile editing unchanged on other targets. */
export const ProviderProfileContext = createContext<ProviderProfile | undefined>(undefined);

/** Reads display identity without changing account or economy authority. */
export const useProviderProfile = () => useContext(ProviderProfileContext);
