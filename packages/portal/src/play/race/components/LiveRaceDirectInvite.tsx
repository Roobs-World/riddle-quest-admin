import {useEffect, useRef, useState} from "react";
import {SendLiveRaceChallengeResponseSchema, type LiveRaceCapability} from "@qwordly/core/race";
import {tr} from "../../i18n";
import {liveRaceDeliveryDeadline} from "../logic/liveRaceDeliveryDeadline";

/** A lobby and its authenticated provider define the direct invitation's lifetime. */
type DirectInviteProps = {
  /** Server-reserved lobby. */ challengeId: string;
  /** Authenticated platform transport. */ transport: LiveRaceCapability;
};
/** The original recipient is pinned while a lost reply may already have queued server work. */
type DirectInviteIntent = Readonly<Parameters<NonNullable<LiveRaceCapability["sendChallenge"]>>[0]>;

/** Invalid or unavailable names can be corrected after an explicit authority refusal. */
const canCorrectRecipient = (error: unknown): boolean => {
  /** Ambiguous delivery and already-addressed lobbies retain their original selection. */
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return /(?:^|\/)(invalid-argument|not-found)$/.test(code);
};

/** Addresses an existing player through server-owned targeting, inbox persistence, and push delivery. */
export function LiveRaceDirectInvite(props: DirectInviteProps) {
  /** Profile renders retain the selected recipient; a new lobby or provider retires it. */
  const [lifetime, setLifetime] = useState(() => ({challengeId: props.challengeId, transport: props.transport, version: 0}));
  if (lifetime.challengeId !== props.challengeId || lifetime.transport !== props.transport)
    setLifetime({challengeId: props.challengeId, transport: props.transport, version: lifetime.version + 1});
  return <LiveRaceDirectInvitePanel key={lifetime.version} {...props} />;
}

/** Owns one recipient selection and its bounded, idempotent authority delivery. */
function LiveRaceDirectInvitePanel({challengeId, transport}: DirectInviteProps) {
  /** Editable recipient before admission or after a confirmed correctable rejection. */
  const [username, setUsername] = useState("");
  /** Only the current transport attempt occupies the delivery controls. */
  const [busy, setBusy] = useState(false);
  /** A validated queue receipt permanently consumes this panel's send action. */
  const [queued, setQueued] = useState(false);
  /** Existing translated error copy exposes uncertain delivery recovery. */
  const [failed, setFailed] = useState(false);
  /** Unknown authority outcomes pin the recipient while leaving exact replay available. */
  const [uncertain, setUncertain] = useState(false);
  /** Immediate exclusion prevents duplicate admission before React updates the controls. */
  const lock = useRef(false);
  /** Accepted queue acknowledgment closes admission before its disabled button is painted. */
  const confirmed = useRef(false);
  /** The immutable original lobby and recipient survive uncertain replies. */
  const intent = useRef<DirectInviteIntent | null>(null);
  /** A later retry refusal cannot prove that an earlier unknown request did not queue. */
  const hadUnknownReply = useRef(false);
  /** Superseded replies cannot settle a newer retry or recipient selection. */
  const latestDelivery = useRef<object | null>(null);
  /** Retired lobby and provider work cannot update the replacement panel. */
  const active = useRef(true);
  /** Cancels only local presentation waits when the owning panel retires. */
  const waitAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    /** Effect replay owns a fresh abortable local delivery lifetime. */
    const abort = new AbortController(); waitAbort.current = abort;
    return () => {active.current = false; latestDelivery.current = null; abort.abort();};
  }, []);
  /** Only the exact validated server response can grant the queued presentation. */
  const confirm = (value: unknown) => {
    SendLiveRaceChallengeResponseSchema.parse(value);
    confirmed.current = true; intent.current = null;
    setQueued(true); setUncertain(false); setFailed(false);
  };
  /** Replays the originally selected recipient until its authority outcome is known. */
  const send = async () => {
    if (!active.current || lock.current || confirmed.current || !transport.sendChallenge) return;
    if (!intent.current && username.trim().length < 3) return;
    /** Recipient text is frozen before any asynchronous provider or server work. */
    const selected = intent.current ?? Object.freeze({challengeId, recipientUsername: username.trim()});
    intent.current = selected;
    lock.current = true; setBusy(true); setFailed(false); setUncertain(true);
    /** The original request's observer remains independent of subsequent retries. */
    const delivery = {}, signal = waitAbort.current?.signal;
    latestDelivery.current = delivery;
    /** Exact original receipts can recover settled retries, but cannot override newer input or pending work. */
    const late = (value: unknown) => {
      if (active.current && !signal?.aborted && intent.current === selected && !lock.current)
        confirm(value);
    };
    try {
      /** A stalled authenticated transport releases controls without claiming server cancellation. */
      const value = await liveRaceDeliveryDeadline(transport.sendChallenge(selected), false, late, signal);
      if (active.current && latestDelivery.current === delivery) confirm(value);
    } catch (error) {
      if (active.current && latestDelivery.current === delivery) {
        setFailed(true);
        if (canCorrectRecipient(error) && !hadUnknownReply.current) {intent.current = null; setUncertain(false);}
        else hadUnknownReply.current = true;
      }
    } finally {lock.current = false; if (active.current) setBusy(false);}
  };
  return transport.sendChallenge ? <div className="live-race-direct-invite">
    <label>{tr("RaceTo10.PLAYER_USERNAME")}<input value={username} maxLength={80} disabled={busy || queued || uncertain}
      autoComplete="off" onChange={event => setUsername(event.target.value)} /></label>
    <button className="race-secondary" disabled={busy || queued || username.trim().length < 3} aria-busy={busy}
      onClick={() => void send()}>{tr(failed && uncertain ? "RaceTo10.RETRY" : "RaceTo10.NOTIFY_PLAYER")}</button>
    {queued && <p role="status">{tr("RaceTo10.INVITE_QUEUED")}</p>}
    {failed && <p role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
  </div> : null;
}
