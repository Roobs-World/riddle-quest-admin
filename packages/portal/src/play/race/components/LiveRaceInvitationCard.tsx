import {useEffect, useState} from "react";
import {LiveRaceChallengeSchema, type LiveRaceCapability, type LiveRaceChallenge} from "@qwordly/core/race";
import {tr} from "../../i18n";

/** Announces an incoming SDK invitation on the initial multiplayer screen without accepting it. */
export function LiveRaceInvitationCard({challengeId, transport, onAccept}: {
  /** Opaque handle read from the provider SDK entry data. */ challengeId: string;
  /** Target-owned authenticated invitation read. */ transport: LiveRaceCapability;
  /** Explicit recipient acceptance mounts the existing live lobby. */ onAccept: (selection: {
    /** Server invitation content category. */ categoryId: LiveRaceChallenge["categoryId"];
    /** Server invitation content language. */ locale: LiveRaceChallenge["locale"];
    /** Invitation being accepted. */ challengeId: string;
  }) => void;
}) {
  /** Validated server preview; launch metadata never supplies identity or game rules. */
  const [challenge, setChallenge] = useState<LiveRaceChallenge | null>(null);
  /** Retryable read failure, distinct from unavailable server invitations. */
  const [failed, setFailed] = useState(false);
  /** Explicit retry after an unavailable transport. */
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    /** Read lifetime rejects late replies after close, locale or account changes. */
    let active = true;
    setFailed(false);
    setChallenge(null);
    /** Unanswered reads release the intro with an explicit retry. */
    const timer = window.setTimeout(() => {active = false; setFailed(true);}, 8000);
    void transport.challenge!({challengeId}).then(value => {
      if (!active) return;
      /** Server responses remain untrusted until validated against the portable contract. */
      const parsed = LiveRaceChallengeSchema.parse(value);
      if (parsed.challengeId !== challengeId) throw new Error("Invitation receipt mismatch");
      setChallenge(parsed);
      window.clearTimeout(timer);
    }).catch(() => {if (active) {setFailed(true); window.clearTimeout(timer);}});
    return () => {active = false; window.clearTimeout(timer);};
  }, [challengeId, transport, retry]);
  return <div className="race-panel live-race-invitation" role="alert" aria-live="polite">
    {failed ? <><p>{tr("RaceTo10.ERROR_GENERIC")}</p><button onClick={() => setRetry(value => value + 1)}>{tr("RaceTo10.RETRY")}</button></> :
      !challenge ? <p>{tr("RaceTo10.LOADING_CHALLENGE")}</p> : <>
        <h2>{tr("RaceTo10.CHALLENGED_BY", {name: challenge.creator.displayName})}</h2>
        <p>{tr(challenge.status === "unavailable" ? "RaceTo10.INVITATION_EXPIRED" : "RaceTo10.FIRST_TO_TEN")}</p>
        {(["available", "accepted"] as string[]).includes(challenge.status) && <button className="race-primary"
          onClick={() => onAccept({categoryId: challenge.categoryId, locale: challenge.locale, challengeId})}>{tr("RaceTo10.ACCEPT_CHALLENGE")}</button>}
      </>}
  </div>;
}
