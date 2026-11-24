import {createContext} from "react";

export type AnalyticsConsent = Readonly<{
  enabled: boolean;
  change(enabled: boolean): void;
}>;

export const AnalyticsConsentContext = createContext<AnalyticsConsent | null>(null);
