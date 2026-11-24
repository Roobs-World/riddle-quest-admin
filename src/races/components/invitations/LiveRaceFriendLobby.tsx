import type {LiveRaceView} from "../../contracts/index";
import {useId, type ReactNode} from "react";
import {tr} from "../../../localization/browser/i18n";
import {LiveRaceIdentity, type LiveRacePlayerIdentity} from "../social/LiveRaceIdentity";
import {LiveRaceSearchWheel} from "../lobby/LiveRaceSearchWheel";
import "./LiveRaceFriendLobby.css";

/** Shows both seats while invitation or public opponents connect. */
export function LiveRaceFriendLobby({view, localPlayer, now, mode = "friend", status, children}: {
  /** Latest server-confirmed seats, or null while the lobby loads. */
  view: LiveRaceView | null;
  /** Device-cached identity is independent of server-confirmed seat ownership. */
  localPlayer?: LiveRacePlayerIdentity;
  /** Server-aligned clock used to display the shared countdown. */
  now: number;
  /** Selects invitation or public matchmaking copy. */
  mode?: "friend" | "random";
  /** Current lobby readiness, synchronization, countdown, or expiry presentation. */
  status: "loading" | "waiting" | "ready" | "connecting" | "starting" | "expired";
  /** Lobby controls shown beneath the seats. */
  children?: ReactNode;
}) {
  /** Accessible heading identifier unique to this mounted lobby. */
  const titleId = useId();
  const player = view?.player ?? localPlayer;
  /** Translated status label selected by the lobby presentation state. */
  const statusKey = {
    loading: "Accessibility.LOADING",
    waiting: mode === "friend" ? "RaceTo10.LIVE_FRIEND_WAIT" : "RaceTo10.LIVE_FINDING",
    ready: "RaceTo10.LIVE_READY",
    connecting: "RaceTo10.LIVE_CONNECTING",
    starting: "RaceTo10.LIVE_STARTING",
    expired: "RaceTo10.INVITATION_EXPIRED",
  }[status];
  return <section className="friend-lobby" data-state={status} aria-labelledby={titleId}>
    <header className="friend-lobby-heading">
      <h2 id={titleId}>{tr(mode === "friend" ? "RaceTo10.LOBBY" : "RaceTo10.MULTIPLAYER_BUTTON")}</h2>
    </header>
    <div className="friend-lobby-seats">
      <div className="friend-lobby-seat" data-occupied={Boolean(view)}>
        {player ? <>
          <LiveRaceIdentity player={player} />
          {view && <span className="friend-lobby-joined">{tr("RaceTo10.JOINED")}</span>}
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
