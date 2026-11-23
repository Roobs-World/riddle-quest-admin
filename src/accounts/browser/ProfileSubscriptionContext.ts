import {createContext} from "react";
import type {ReactNode} from "react";

/** Optional subscription management UI shared by Profile and Settings on supported targets. */
export const ProfileSubscriptionContext = createContext<ReactNode>(null);
