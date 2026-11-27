import {useLayoutEffect, useMemo, useRef, useState} from "react";
import {useTranslator} from "../../localization/browser/i18n";
import {useReferralSharing, type ReferralResultShareInput} from "./ReferralSharingCapability";

/** Offers the active target's native share dialog for a confirmed result. */
export function ResultShareButton({result}: {
  /** Immutable result copy; authority tokens and answers never enter the share payload. */
  result: ReferralResultShareInput;
}) {
  const tr = useTranslator();
  const share = useReferralSharing()?.shareResult;
  const selected = useMemo(() => ({share, result}), [share, result]);
  const owner = useRef(selected);
  const mounted = useRef(false);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<typeof selected | null>(null);
  useLayoutEffect(() => {owner.current = selected;}, [selected]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  if (!share) return null;
  const send = async () => {
    const current = owner.current;
    if (lock.current || !mounted.current || !current.share) return;
    lock.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const outcome = await current.share(current.result);
      if (outcome === "error" && mounted.current && owner.current === current) setFailure(current);
    } catch {
      if (mounted.current && owner.current === current) setFailure(current);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <div className="result-share">
    <button className="play-secondary" disabled={busy} aria-busy={busy} onClick={() => void send()}>
      {tr("Accessibility.SHARE_SYSTEM")}
    </button>
    {failure === selected && <p role="alert">{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p>}
  </div>;
}
