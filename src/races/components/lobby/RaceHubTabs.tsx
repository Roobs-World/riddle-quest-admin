import {useRef, type KeyboardEvent} from "react";
import {tr} from "../../../localization/browser/i18n";

/** Describes race hub tab. */
export type RaceHubTab = "play" | "activity";

/** Accessible, capability-aware navigation for the shared social hub. */
export function RaceHubTabs({
  active,
  onPlay,
  onActivity,
  onMatchPlayer,
  matchPending = false,
}: {
  /** Stores active. */
  active: RaceHubTab;
  /** Stores on play. */
  onPlay: () => void;
  /** Stores on activity. */
  onActivity: () => void;
  /** Starts the target-owned recorded opponent search. */
  onMatchPlayer?: () => void;
  /** Disables discovery while its owned operation is pending. */
  matchPending?: boolean;
}) {
  /** Provides tabs behavior. */
  const tabs = [
    {id: "play" as const, label: tr("RaceTo10.HUB_PLAY"), onSelect: onPlay},
    {id: "activity" as const, label: tr("RaceTo10.HUB_ACTIVITY"), onSelect: onActivity},
  ];
  const selected = active;
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
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={tab.onSelect}
            onKeyDown={(event) => handleTabKey(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {onMatchPlayer && <button className="race-match-player" type="button" onClick={onMatchPlayer} disabled={matchPending} aria-busy={matchPending}>
        {tr("RaceTo10.MATCH_PLAYER")}
      </button>}
    </nav>
  );
}
