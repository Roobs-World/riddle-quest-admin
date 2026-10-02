import {createContext} from "react";
import type {ReactNode} from "react";

/** Optional subscription management UI supplied only by a target that supports it. */
export const ProfileSubscriptionContext = createContext<ReactNode>(null);
