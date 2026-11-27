import {useEffect, useSyncExternalStore, type ReactNode} from "react";
import type {FacebookBanner} from "./FacebookBanner";
import {useTranslator} from "../../../../../src/localization/browser/i18n";
import "./FacebookBannerLayout.css";

function ActiveBannerLayout({banner, children}: {banner: FacebookBanner; children: ReactNode}) {
  const tr = useTranslator();
  const snapshot = useSyncExternalStore(banner.subscribe, banner.getSnapshot, banner.getSnapshot);
  useEffect(() => {banner.setMounted(true); return () => {banner.setMounted(false);};}, [banner]);
  return <div className="facebook-banner-layout" data-banner-reserved={snapshot.reserved || undefined}>
    <div className="facebook-banner-content" inert={snapshot.interactionBlocked || undefined}>{children}</div>
    {snapshot.interactionBlocked && <div className="facebook-banner-recovery" role="status" aria-live="polite">
      <p>{tr(snapshot.retryable ? "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE" : "Accessibility.LOADING")}</p>
      {snapshot.retryable && <button type="button" onClick={banner.refresh}>{tr("CommonButtons.RETRY")}</button>}
    </div>}
  </div>;
}

/** The native banner is outside the game frame; fixed game dialogs stay inside the remaining viewport. */
export function FacebookBannerLayout({banner, children}: {banner?: FacebookBanner; children: ReactNode}) {
  return banner ? <ActiveBannerLayout banner={banner}>{children}</ActiveBannerLayout> : children;
}
