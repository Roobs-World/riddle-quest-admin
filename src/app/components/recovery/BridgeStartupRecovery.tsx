import {useRef, useState} from "react";
import {captureBrowserException} from "../../../observability/browserErrorReporter";
import {tr} from "../../../localization/browser/i18n";
import {useOnlineStatus} from "../../../platform/browser/useOnlineStatus";

/** Lets a player reload unavailable startup code after connectivity returns. */
export function BridgeStartupRecovery({reload = () => window.location.reload()}: {
  /** Reloads only on an explicit player action; injectable for browser verification. */
  reload?: () => void;
}) {
  /** Offline players keep the recovery screen rather than navigating to an unavailable document. */
  const online = useOnlineStatus();
  /** Immediate exclusion protects against repeated clicks before the disabled state renders. */
  const requested = useRef(false);
  /** Accessible busy state lasts until the current document is replaced. */
  const [retrying, setRetrying] = useState(false);
  /** A denied reload remains retryable without letting exceptions escape the click handler. */
  const retry = () => {
    if (!online || requested.current) return;
    requested.current = true;
    setRetrying(true);
    try {
      reload();
    } catch (error) {
      requested.current = false;
      setRetrying(false);
      captureBrowserException(error, {component: "play_host", operation: "reload_bridge_validation"});
    }
  };
  return <main className="route-missing bridge-startup-recovery">
    <div role="alert">
      <h1>{tr("ErrorMessages.FATAL_STARTUP_TITLE")}</h1>
      <p>{tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")}</p>
      {!online && <p>{tr("CommonAlerts.OFFLINE_MESSAGE")}</p>}
      <button className="play-primary" disabled={!online || retrying} aria-busy={retrying || undefined} onClick={retry}>
        {tr("CommonButtons.RETRY")}
      </button>
    </div>
  </main>;
}
