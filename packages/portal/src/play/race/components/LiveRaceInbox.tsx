import {useEffect, useState} from "react";
import {LiveRaceChallengeSchema, type LiveRaceCapability} from "@qwordly/core/race";
import {LiveRaceInvitationCard} from "./LiveRaceInvitationCard";
import {tr} from "../../i18n";

/** Retrieves durable direct invitations, including those received while the game was closed. */
export function LiveRaceInbox({transport, excludeId, onAccept}: {
  /** Authenticated target inbox transport. */ transport: LiveRaceCapability;
  /** Avoids rendering the current SDK launch invitation twice. */ excludeId?: string;
  /** Explicit acceptance opens the existing lobby. */ onAccept: Parameters<typeof LiveRaceInvitationCard>[0]["onAccept"];
}) {
  /** Local presentation state for this mounted invitation or consent flow. */
  const [ids, setIds] = useState<string[]>([]);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [failed, setFailed] = useState(false);
  /** Local presentation state for this mounted invitation or consent flow. */
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    /** Mounted read lifetime rejects late inbox responses. */
    let active = true, pending = false;
    /** Reads pending invitations without occupying a seat. */
    const refresh = async () => {
      if (!active || pending || !transport.inbox) return;
      pending = true;
      /** Bounded timeout releases an unavailable transport. */
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        /** Answer-free invitation responses from the authenticated server. */
        const rows = await Promise.race([transport.inbox(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("inbox-timeout")), 8000);
        })]);
        /** Validated notices are deduplicated before rendering. */
        const parsed = LiveRaceChallengeSchema.array().max(10).parse(rows);
        if (active) {setIds([...new Set(parsed.map(row => row.challengeId))]); setFailed(false);}
      } catch {if (active) setFailed(true);}
      finally {clearTimeout(timer); pending = false;}
    };
    void refresh();
    /** Bounded polling discovers invitations while the intro remains open. */
    const interval = setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("riddle-quest:live-race-inbox-changed", refresh);
    return () => {active = false; clearInterval(interval); window.removeEventListener("focus", refresh);
      window.removeEventListener("riddle-quest:live-race-inbox-changed", refresh);};
  }, [transport, retry]);
  return <>{ids.filter(id => id !== excludeId).map(id => <LiveRaceInvitationCard key={id} challengeId={id} transport={transport} onAccept={onAccept} />)}
    {failed && <div className="race-panel race-error" role="alert"><p>{tr("RaceTo10.ERROR_GENERIC")}</p>
      <button onClick={() => setRetry(value => value + 1)}>{tr("RaceTo10.RETRY")}</button></div>}</>;
}
