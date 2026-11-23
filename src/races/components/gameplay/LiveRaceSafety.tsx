import {useEffect, useRef, useState} from "react";
import {BlockSocialRivalResponseSchema, ReportSocialRivalResponseSchema, type LiveRaceCapability, type SocialReportCategory} from "../../contracts/index";
import {tr} from "../../../localization/browser/i18n";
import {createRequestId} from "../../../gameplay/session/requestIds";
import {liveRaceDeliveryDeadline} from "../../live/liveRaceDeliveryDeadline";
import {captureBrowserException} from "../../../observability/browserErrorReporter";

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

/** One owned seat and transport determine the safety panel's complete lifetime. */
type LiveRaceSafetyProps = {
  /** Authenticated owning-target transport. */ transport: LiveRaceCapability;
  /** Current player's opaque seat. */ ticketId: string;
  /** Immediately retires visible rival identity after a confirmed block. */ onBlocked: () => void;
};

/** Capability-owned controls cannot retain a retired seat or provider's pending mutation. */
export function LiveRaceSafety(props: LiveRaceSafetyProps) {
  /** Callback and profile changes retain the same seat; ownership changes replace its controls. */
  const [lifetime, setLifetime] = useState(() => ({transport: props.transport, ticketId: props.ticketId, version: 0}));
  if (lifetime.transport !== props.transport || lifetime.ticketId !== props.ticketId)
    setLifetime({transport: props.transport, ticketId: props.ticketId, version: lifetime.version + 1});
  return <LiveRaceSafetyPanel key={lifetime.version} {...props} />;
}

/** Owns immutable safety intents, bounded delivery, and validated acknowledgments. */
function LiveRaceSafetyPanel({transport, ticketId, onBlocked}: LiveRaceSafetyProps) {
  /** Selected fixed report category. */
  const [category, setCategory] = useState<SocialReportCategory>("harassment");
  /** Synchronous exclusion prevents double admission before React disables controls. */
  const pending = useRef(false);
  /** A superseded or retired delivery cannot publish its late acknowledgment. */
  const latestDelivery = useRef<object | null>(null);
  /** The selected immutable request remains available for a delivery retry. */
  const intent = useRef<SafetyIntent | null>(null);
  /** Mounted lifetime rejects late outcomes after account, seat or locale retirement. */
  const active = useRef(true);
  /** Local presentation waits are released when the owning panel retires. */
  const waitAbort = useRef<AbortController | null>(null);
  /** Visible transport pending state. */
  const [busy, setBusy] = useState(false);
  /** Existing translated success acknowledgement. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Only generic localized failure copy reaches the player. */
  const [failed, setFailed] = useState(false);
  /** A confirmed block is not repeated by subsequent clicks. */
  const [blocked, setBlocked] = useState(false);
  /** Canonical block acceptance excludes duplicate clicks before React paints its disabled state. */
  const blockConfirmed = useRef(false);
  useEffect(() => {
    active.current = true;
    /** Effect replay gets a fresh local wait lifetime without cancelling server work. */
    const abort = new AbortController();
    waitAbort.current = abort;
    return () => {active.current = false; latestDelivery.current = null; abort.abort();};
  }, []);
  /** Only validated authority data can confirm a block or report. */
  const confirm = (selected: SafetyIntent, value: unknown) => {
    if (selected.kind === "block") {
      BlockSocialRivalResponseSchema.parse(value);
      setBlocked(true); setNotice("RaceTo10.BLOCK_SUCCESS");
      if (!blockConfirmed.current) {
        blockConfirmed.current = true;
        /** A queued optional callback retains this effect lifetime even through replay. */
        const ownerSignal = waitAbort.current?.signal;
        // Optional parent work cannot reject an already confirmed authority receipt.
        void Promise.resolve().then(() => {if (active.current && !ownerSignal?.aborted) return onBlocked();}).catch(error =>
          captureBrowserException(error, {component: "live_race_safety", operation: "confirmed_block_callback"}));
      }
    } else {
      ReportSocialRivalResponseSchema.parse(value);
      setNotice("RaceTo10.REPORT_SUCCESS");
    }
    intent.current = null; setFailed(false);
  };
  /** Dispatches the originally selected request; responses never become score authority. */
  const deliver = async (selected: SafetyIntent) => {
    if (!active.current || pending.current) return;
    pending.current = true; setBusy(true); setFailed(false); setNotice(null); intent.current = selected;
    /** This request owns confirmation until a new explicit request or panel retirement replaces it. */
    const delivery = {}, signal = waitAbort.current?.signal;
    latestDelivery.current = delivery;
    /** A current late receipt can recover a timeout without overriding a newer operation. */
    const late = (value: unknown) => {
      if (active.current && !signal?.aborted && latestDelivery.current === delivery && !pending.current)
        confirm(selected, value);
    };
    try {
      /** Unknown authority outcomes retain their frozen request identity for retry. */
      const value = await liveRaceDeliveryDeadline(selected.kind === "block"
        ? transport.blockOpponent!(selected.input) : transport.reportOpponent!(selected.input), false, late, signal);
      if (active.current && latestDelivery.current === delivery) confirm(selected, value);
    } catch {if (active.current) setFailed(true);}
    finally {pending.current = false; if (active.current) setBusy(false);}
  };
  /** Same operation retries retain the original request; a new reason starts a distinct explicit report. */
  const select = (kind: SafetyIntent["kind"]) => {
    if (!active.current || pending.current || kind === "block" && blockConfirmed.current) return;
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
