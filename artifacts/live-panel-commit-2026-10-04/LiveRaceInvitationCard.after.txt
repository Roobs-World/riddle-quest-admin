import {useEffect, useMemo, useState} from "react";
import {LiveRaceChallengeSchema, type LiveRaceCapability, type LiveRaceChallenge, type RaceLocale} from "@qwordly/core/race";
import {tr} from "../../i18n";

/** A preview's exact server selector and authenticated provider define acceptance ownership. */
type InvitationCardProps = {
  /** Opaque handle read from the provider SDK entry data. */ challengeId: string;
  /** Target-owned authenticated invitation read. */ transport: LiveRaceCapability;
  /** Inbox already supplies a validated read so polling never fans out another ten requests. */ initialChallenge?: LiveRaceChallenge;
  /** Active content language cannot silently change during invitation acceptance. */ locale?: RaceLocale;
  /** Explicit recipient acceptance mounts the existing live lobby. */ onAccept: (selection: {
    /** Server invitation content category. */ categoryId: LiveRaceChallenge["categoryId"];
    /** Server invitation content language. */ locale: LiveRaceChallenge["locale"];
    /** Invitation being accepted. */ challengeId: string;
  }) => void;
};

/** The complete authority schema and requested handle precede every preview or acceptance. */
function parseInvitation(value: unknown, challengeId: string): LiveRaceChallenge {
  /** The SDK entry handle never supplies creator identity, category, or language. */
  const parsed = LiveRaceChallengeSchema.parse(value);
  if (parsed.challengeId !== challengeId) throw new Error("Invitation receipt mismatch");
  return parsed;
}

/** Ownership replacement removes old acceptance controls before any passive effect runs. */
export function LiveRaceInvitationCard(props: InvitationCardProps) {
  /** Cached receipt changes update in place; a new provider, selector, or read path retires old state. */
  const [lifetime, setLifetime] = useState(() => ({challengeId: props.challengeId, transport: props.transport,
    read: props.transport.challenge, cached: props.initialChallenge !== undefined, version: 0}));
  if (lifetime.challengeId !== props.challengeId || lifetime.transport !== props.transport ||
    lifetime.read !== props.transport.challenge || lifetime.cached !== (props.initialChallenge !== undefined))
    setLifetime({challengeId: props.challengeId, transport: props.transport,
      read: props.transport.challenge, cached: props.initialChallenge !== undefined, version: lifetime.version + 1});
  return <LiveRaceInvitationPanel key={lifetime.version} {...props} />;
}

/** Cached previews render immediately; SDK launches and explicit recovery own bounded reads. */
function LiveRaceInvitationPanel({challengeId, transport, onAccept, initialChallenge, locale}: InvitationCardProps) {
  /** Current inbox data is validated during rendering without a timer, loading flash, or extra request. */
  const cached = useMemo(() => {
    if (initialChallenge === undefined) return null;
    try {return parseInvitation(initialChallenge, challengeId);} catch {return null;}
  }, [initialChallenge, challengeId]);
  /** Only an explicit retry may replace this exact cached receipt with a canonical read. */
  const [retrySource, setRetrySource] = useState<LiveRaceChallenge | undefined>();
  /** A refreshed cached receipt supersedes recovery from its earlier value immediately. */
  const needsRead = initialChallenge === undefined || retrySource === initialChallenge;
  /** Validated preview belonging to the current network read path. */
  const [loaded, setLoaded] = useState<LiveRaceChallenge | null>(null);
  /** Retryable read failure, distinct from unavailable server invitations. */
  const [loadFailed, setLoadFailed] = useState(false);
  /** Explicit retry after an unavailable transport. */
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!needsRead) return;
    /** Read lifetime rejects late replies after close, locale or account changes. */
    let active = true;
    setLoadFailed(false);
    setLoaded(null);
    /** Captured read callback cannot silently switch providers inside a queued microtask. */
    const read = transport.challenge;
    /** Unanswered reads release the intro with an explicit retry. */
    const timer = window.setTimeout(() => {active = false; setLoadFailed(true);}, 8000);
    void Promise.resolve().then(() => active ? read?.call(transport, {challengeId}) : undefined).then(value => {
      if (!active) return;
      /** Server responses remain untrusted until validated against the portable contract. */
      setLoaded(parseInvitation(value, challengeId));
      window.clearTimeout(timer);
    }).catch(() => {if (active) {setLoadFailed(true); window.clearTimeout(timer);}});
    return () => {active = false; window.clearTimeout(timer);};
  }, [challengeId, transport, retry, needsRead]);
  /** Rendering always selects the current receipt rather than copying cached data through an effect. */
  const challenge = needsRead ? loaded : cached, failed = needsRead ? loadFailed : cached === null;
  return <div className="race-panel live-race-invitation" role="alert" aria-live="polite">
    {failed ? <><p>{tr("RaceTo10.ERROR_GENERIC")}</p><button onClick={() => {setRetrySource(initialChallenge); setRetry(value => value + 1);}}>{tr("RaceTo10.RETRY")}</button></> :
      !challenge ? <p>{tr("RaceTo10.LOADING_CHALLENGE")}</p> : <>
        <h2>{tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
        <p>{tr(locale && challenge.locale !== locale ? "RaceTo10.ERROR_LOCALE_MISMATCH" :
          challenge.status === "unavailable" ? "RaceTo10.INVITATION_EXPIRED" : "RaceTo10.FIRST_TO_TEN")}</p>
        {(!locale || challenge.locale === locale) && (challenge.status === "available" || challenge.status === "accepted") && <button className="race-primary"
          onClick={() => onAccept({categoryId: challenge.categoryId, locale: challenge.locale, challengeId: challenge.challengeId})}>{tr("RaceTo10.ACCEPT_CHALLENGE")}</button>}
      </>}
  </div>;
}
