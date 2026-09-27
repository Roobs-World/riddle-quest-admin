import {useRef, type KeyboardEvent} from "react";
import {tr} from "../../i18n";

/** Describes race hub tab. */
export type RaceHubTab = "play" | "activity" | "tournaments";

/** Accessible, capability-aware navigation for the shared social hub. */
export function RaceHubTabs({
  active,
  onPlay,
  onActivity,
  onTournaments,
  onChooseContext,
  onMatchPlayer,
  socialPending = null,
}: {
  /** Stores active. */
  active: RaceHubTab;
  /** Stores on play. */
  onPlay: () => void;
  /** Stores on activity. */
  onActivity: () => void;
  /** Stores on tournaments. */
  onTournaments?: () => void;
  /** Stores on choose context. */
  onChooseContext?: () => void;
  /** Stores on match player. */
  onMatchPlayer?: () => void;
  /** Stores social pending. */
  socialPending?: "context" | "match" | null;
}) {
  /** Provides tabs behavior. */
  const tabs = [
    {id: "play" as const, label: tr("RaceTo10.HUB_PLAY"), onSelect: onPlay},
    {id: "activity" as const, label: tr("RaceTo10.HUB_ACTIVITY"), onSelect: onActivity},
    ...(onTournaments
      ? [{id: "tournaments" as const, label: tr("RaceTo10.HUB_TOURNAMENTS"), onSelect: onTournaments}]
      : []),
  ];
  /** Provides tab refs behavior. */
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  /** Handles tab key. */
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    /** Provides next index behavior. */
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    tabs[nextIndex]!.onSelect();
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <nav className="race-hub-tabs" aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}>
      <div role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={tab.onSelect}
            onKeyDown={(event) => handleTabKey(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {onChooseContext || onMatchPlayer ? (
        <div className="race-hub-social-actions" aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}>
          {onMatchPlayer ? (
            <button
              type="button"
              onClick={onMatchPlayer}
              disabled={socialPending !== null}
              aria-busy={socialPending === "match"}
            >
              {tr("RaceTo10.MATCH_PLAYER")}
            </button>
          ) : null}
          {onChooseContext ? (
            <button
              type="button"
              onClick={onChooseContext}
              disabled={socialPending !== null}
              aria-busy={socialPending === "context"}
            >
              {tr("RaceTo10.CHOOSE_CONTEXT")}
            </button>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
