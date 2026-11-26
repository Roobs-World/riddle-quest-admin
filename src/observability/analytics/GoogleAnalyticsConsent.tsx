import {lazy, Suspense, useState, type ReactNode} from "react";
import {AnalyticsConsentContext, type AnalyticsConsent} from "./AnalyticsConsentContext";

export type GoogleAnalyticsConsentProps = Readonly<{
  platform: "jest" | "facebook";
  measurementId: string | undefined;
  available: boolean;
  isCurrent(): boolean;
  lifetimeSignal?: AbortSignal;
  children: ReactNode;
}>;

const ConsentRuntime = lazy(() => import("./GoogleAnalyticsConsentRuntime").catch(() => ({default: () => null})));

/** Optional consent setup loads after the game mounts without suspending its children. */
export function GoogleAnalyticsConsent({children, ...props}: GoogleAnalyticsConsentProps) {
  "use no memo";
  const [consent, publish] = useState<AnalyticsConsent | null>(null);
  return <AnalyticsConsentContext.Provider value={consent}>
    {children}
    {props.available ? <Suspense fallback={null}><ConsentRuntime {...props} publish={publish} /></Suspense> : null}
  </AnalyticsConsentContext.Provider>;
}
