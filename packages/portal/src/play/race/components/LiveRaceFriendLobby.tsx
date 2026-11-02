import type {LiveRaceView} from "@riddle-quest/core/race";
import {useId, type ReactNode} from "react";
import {tr} from "../../i18n";
import {LiveRaceIdentity} from "./LiveRaceIdentity";
import {LiveRaceSearchWheel} from "./LiveRaceSearchWheel";
import "./LiveRaceFriendLobby.css";

/** Shows both seats in a private invitation while its participants connect. */
export function LiveRaceFriendLobby({view, now, status, children}: {
  /** Latest server-confirmed seats, or null while the lobby loads. */
  view: LiveRaceView | null;
  /** Server-aligned clock used to display the shared countdown. */
  now: number;
  /** Current loading, waiting, countdown, or expiry presentation. */
  status: "loading" | "waiting" | "starting" | "expired";
  /** Platform-owned invitation controls shown beneath the seats. */
  children?: ReactNode;
}) {
  /** Accessible heading identifier unique to this mounted lobby. */
  const titleId = useId();
  /** Translated status label selected by the lobby presentation state. */
  const statusKey = {
    loading: "Accessibility.LOADING",
    waiting: "RaceTo10.LIVE_FRIEND_WAIT",
    starting: "RaceTo10.LIVE_STARTING",
    expired: "RaceTo10.INVITATION_EXPIRED",
  }[status];
  return <section className="friend-lobby" data-state={status} aria-labelledby={titleId}>
    <header className="friend-lobby-heading">
      <h2 id={titleId}>{tr("RaceTo10.LOBBY")}</h2>
      {view && <span className="friend-lobby-count">{view.opponent ? "2/2" : "1/2"}</span>}
    </header>
    <div className="friend-lobby-seats">
      <div className="friend-lobby-seat" data-occupied={Boolean(view)}>
        {view ? <>
          <LiveRaceIdentity player={view.player} />
          <span className="friend-lobby-joined">{tr("RaceTo10.JOINED")}</span>
        </> : <div className="friend-lobby-placeholder">
          <FriendSeatPlaceholder />
          <span>{tr("Accessibility.LOADING")}</span>
        </div>}
      </div>
      <div className="friend-lobby-seat" data-occupied={Boolean(view?.opponent)}>
        {view?.opponent ? <>
          <LiveRaceIdentity player={view.opponent} />
          <span className="friend-lobby-joined">{tr("RaceTo10.JOINED")}</span>
        </> : <div className="friend-lobby-placeholder">
          <FriendSeatPlaceholder />
          <span>{tr(status === "expired" ? "RaceTo10.INVITATION_EXPIRED" : "RaceTo10.LIVE_OPPONENT")}</span>
        </div>}
      </div>
    </div>
    <div className="friend-lobby-status" role="status" aria-atomic="true">
      <p>{tr(statusKey)}</p>
    </div>
    {status === "starting" && <LiveRaceSearchWheel endsAtMs={view?.startsAtMs ?? undefined} now={now} starting />}
    {children && <div className="friend-lobby-actions">{children}</div>}
  </section>;
}

/** Decorative empty-seat avatar shown before a participant is available. */
function FriendSeatPlaceholder() {
  return <span className="friend-lobby-empty-avatar" aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none" focusable="false">
      <circle cx="32" cy="23" r="10" />
      <path d="M13 52c0-10 8-17 19-17s19 7 19 17" />
    </svg>
  </span>;
}
