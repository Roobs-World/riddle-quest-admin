import {useEffect, useState} from "react";
import {LiveRaceChallengeSchema, type LiveRaceCapability, type LiveRaceChallenge, type RaceLocale} from "../../contracts/index";
import {LiveRaceInvitationCard} from "./LiveRaceInvitationCard";

/** Authenticated inbox ownership is independent of profile renders and launch exclusions. */
type LiveRaceInboxProps = {
  /** Authenticated target inbox transport. */ transport: LiveRaceCapability;
  /** Avoids rendering the current SDK launch invitation twice. */ excludeId?: string;
  /** Inbox presentation is confined to the current content language. */ locale: RaceLocale;
  /** Explicit acceptance opens the existing lobby. */ onAccept: Parameters<typeof LiveRaceInvitationCard>[0]["onAccept"];
};

/** Replacing the transport or its read callback retires every previous invitation immediately. */
export function LiveRaceInbox(props: LiveRaceInboxProps) {
  /** One provider visit owns its rows, background refreshes, and notification observers. */
  const [lifetime, setLifetime] = useState(() => ({transport: props.transport, inbox: props.transport.inbox, version: 0}));
  if (lifetime.transport !== props.transport || lifetime.inbox !== props.transport.inbox)
    setLifetime({transport: props.transport, inbox: props.transport.inbox, version: lifetime.version + 1});
  return <LiveRaceInboxPanel key={lifetime.version} {...props} />;
}

/** Retrieves durable invitations without overlapping reads or losing pending refresh notifications. */
function LiveRaceInboxPanel({transport, excludeId, onAccept, locale}: LiveRaceInboxProps) {
  /** Validated current-provider invitations remain deduplicated before rendering. */
  const [challenges, setChallenges] = useState<LiveRaceChallenge[]>([]);
  useEffect(() => {
    /** Retirement rejects late responses; notification bursts retain one pending refresh. */
    let active = true, pending = false, refreshAgain = false;
    /** Retirement releases the current local wait and its deadline without cancelling server reads. */
    let retireRead: (() => void) | undefined;
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
          retireRead = () => {clearTimeout(timer); reject(new Error("inbox-read-retired"));};
        })]);
        if (!active) return;
        /** Validated notices are deduplicated before rendering. */
        const parsed = LiveRaceChallengeSchema.array().max(10).parse(rows);
        if (active) setChallenges([...new Map(parsed.map(row => [row.challengeId, row])).values()]);
      } catch {
        // Optional invitation discovery retries in the background without failing the multiplayer menu.
      }
      finally {
        clearTimeout(timer); retireRead = undefined; pending = false;
        if (active && refreshAgain) {refreshAgain = false; void refresh();}
      }
    };
    /** A notification during a read gets one immediate follow-up after that read settles. */
    const requestRefresh = () => {if (!active) return; if (pending) refreshAgain = true; else void refresh();};
    void refresh();
    /** Bounded polling discovers invitations while the intro remains open. */
    const interval = setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", requestRefresh);
    window.addEventListener("riddle-quest:live-race-inbox-changed", requestRefresh);
    return () => {active = false; retireRead?.(); clearInterval(interval);
      window.removeEventListener("focus", requestRefresh);
      window.removeEventListener("riddle-quest:live-race-inbox-changed", requestRefresh);};
  }, [transport]);
  return <>{challenges.filter(row => row.challengeId !== excludeId && row.locale === locale).map(row =>
    <LiveRaceInvitationCard key={row.challengeId} challengeId={row.challengeId} initialChallenge={row} locale={locale} transport={transport} onAccept={onAccept} />)}</>;
}
