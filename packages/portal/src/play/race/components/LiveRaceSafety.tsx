import {useEffect, useRef, useState} from "react";
import {BlockSocialRivalResponseSchema, ReportSocialRivalResponseSchema, type LiveRaceCapability, type SocialReportCategory} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {createRequestId} from "../../requestIds";

/** An immutable selected operation survives uncertain transport retries. */
type SafetyIntent = {
  /** Operation identity. */
  kind: "block";
  /** Server target selector. */
  input: {
    /** Own seat. */
    liveTicketId: string;
  };
} | {
  /** Operation identity. */
  kind: "report";
  /** Frozen categorized request. */
  input: {
    /** Own seat. */
    liveTicketId: string;
    /** Fixed reason. */
    category: SocialReportCategory;
    /** Idempotency identity. */
    requestId: string;
  };
};
/** Existing translated reasons avoid free-form personal data in moderation intake. */
const REASONS = [["harassment", "REPORT_HARASSMENT"], ["cheating", "REPORT_CHEATING"],
  ["inappropriate_identity", "REPORT_IDENTITY"], ["spam", "REPORT_SPAM"], ["other", "REPORT_OTHER"]] as const;

/** Capability-owned safety controls never receive or submit the rival's account identity. */
export function LiveRaceSafety({transport, ticketId, onBlocked}: {
  /** Authenticated owning-target transport. */ transport: LiveRaceCapability;
  /** Current player's opaque seat. */ ticketId: string;
  /** Immediately retires visible rival identity after a confirmed block. */ onBlocked: () => void;
}) {
  /** Selected fixed report category. */
  const [category, setCategory] = useState<SocialReportCategory>("harassment");
  /** Synchronous exclusion prevents double admission before React disables controls. */
  const pending = useRef(false);
  /** The selected immutable request remains available for a delivery retry. */
  const intent = useRef<SafetyIntent | null>(null);
  /** Mounted lifetime rejects late outcomes after account, seat or locale retirement. */
  const active = useRef(true);
  /** Visible transport pending state. */
  const [busy, setBusy] = useState(false);
  /** Existing translated success acknowledgement. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Only generic localized failure copy reaches the player. */
  const [failed, setFailed] = useState(false);
  /** A confirmed block is not repeated by subsequent clicks. */
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {active.current = true; return () => {active.current = false;};}, []);
  /** Dispatches the originally selected request; responses never become score authority. */
  const deliver = async (selected: SafetyIntent) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false); setNotice(null); intent.current = selected;
    try {
      if (selected.kind === "block") {
        BlockSocialRivalResponseSchema.parse(await transport.blockOpponent!(selected.input));
        if (active.current) {setBlocked(true); setNotice("RaceTo10.BLOCK_SUCCESS"); onBlocked();}
      } else {
        ReportSocialRivalResponseSchema.parse(await transport.reportOpponent!(selected.input));
        if (active.current) setNotice("RaceTo10.REPORT_SUCCESS");
      }
      if (active.current) intent.current = null;
    } catch {if (active.current) setFailed(true);}
    finally {pending.current = false; if (active.current) setBusy(false);}
  };
  /** Same operation retries retain the original request; a new reason starts a distinct explicit report. */
  const select = (kind: SafetyIntent["kind"]) => {
    if (pending.current || kind === "block" && blocked) return;
    /** Previously uncertain work is retried only with exactly the same operation and category. */
    const previous = intent.current;
    if (previous?.kind === kind && (previous.kind === "block" || previous.input.category === category)) {void deliver(previous); return;}
    void deliver(kind === "block" ? {kind, input: Object.freeze({liveTicketId: ticketId})} :
      {kind, input: Object.freeze({liveTicketId: ticketId, category, requestId: createRequestId("live-report")})});
  };
  return <details className="race-panel live-race-safety">
    <summary>{tr("RaceTo10.SAFETY_ACTIONS")}</summary>
    <button type="button" className="race-secondary live-race-block" disabled={busy || blocked} aria-busy={busy && intent.current?.kind === "block"}
      onClick={() => select("block")}>{tr("RaceTo10.BLOCK_RIVAL")}</button>
    <label><span>{tr("RaceTo10.REPORT_REASON")}</span><select value={category} disabled={busy}
      onChange={event => setCategory(event.target.value as SocialReportCategory)}>
      {REASONS.map(([value, key]) => <option key={value} value={value}>{tr(`RaceTo10.${key}`)}</option>)}
    </select></label>
    <button type="button" className="race-secondary live-race-report" disabled={busy} aria-busy={busy && intent.current?.kind === "report"}
      onClick={() => select("report")}>{tr("RaceTo10.REPORT_RIVAL")}</button>
    {notice && <p role="status">{tr(notice)}</p>}
    {failed && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}<button disabled={busy}
      onClick={() => {if (intent.current) void deliver(intent.current);}}>{tr("RaceTo10.RETRY")}</button></div>}
  </details>;
}
