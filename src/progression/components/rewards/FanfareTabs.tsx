import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from "react";
import type {GameSessionState} from "../../../gameplay/session/gameSession";
import {isPlayerReducedMotionEnabled, subscribeToPlayerReducedMotion} from "../../../settings/browser/playerPreferences";
import {FanfareTabContent} from "./FanfareModalContent";
import {createRewardFanfareSteps, createVictoryFanfareSteps, getActiveCoinAward, type FanfareStep} from "../../browser/fanfareSequence";
import {AchievementFanfareSeen} from "../../browser/achievementFanfareSeen";
import "../../styles/fanfare-tabs.css";

/** Readable time after a tab has reached the front of the queue. */
export const FANFARE_TAB_HOLD_MS = 1000;

/** Achievement details remain readable for two additional seconds. */
export const ACHIEVEMENT_TAB_HOLD_MS = FANFARE_TAB_HOLD_MS + 2000;

/** Presents one completion or granted reward without a dialog or extra taps. */
export function FanfareTabs({state, paused, onComplete, onBalancePreview, steps: suppliedSteps, id}: {
  /** Optional accessible identifier referenced by the associated completion dialog. */
  id?: string;
  /** Optional milestones shown alongside a persistent win dialog. */ steps?: readonly FanfareStep[];
  /** Session receipts supply all milestones and coin amounts. */ state: GameSessionState;
  /** Host suspension must not dismiss an unseen reward. */ paused: boolean;
  /** Releases this presentation once its queue has drained. */ onComplete: () => void;
  /** Changes only the decorative counter, never the stored balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Every receipt keeps its account owner and queue across unrelated profile refreshes. */
  const [seenAchievements] = useState(() => new AchievementFanfareSeen(state.user));
  /** A confirmed receipt's queue cannot restart or shrink when its visible tab is marked seen. */
  const [steps] = useState(() => (suppliedSteps ?? (state.modal === "victory"
    ? createVictoryFanfareSteps(state.lastRewards) : createRewardFanfareSteps(state.auxiliaryFanfare)))
    .filter(step => step.kind !== "achievement" || !seenAchievements.hasSeen(step.achievementId)));
  /** Current position in the automatic milestone queue. */
  const [index, setIndex] = useState(0);
  /** The front tab starts visible and holds before its exit. */
  const [phase, setPhase] = useState<"holding" | "ready" | "leaving" | "complete">("holding");
  /** Background tabs retain unread milestones. */
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  /** Completion callback fires once for this presentation. */
  const completed = useRef(false);
  /** The current presentation retains its own consumed tab until its animation finishes. */
  const claimedIndex = useRef<number | null>(null);
  /** Browser animation completion owns promotion and removal. */
  const tabs = useRef<HTMLDivElement>(null);
  /** Player preference removes sliding motion. */
  const reducedMotion = useSyncExternalStore(subscribeToPlayerReducedMotion, isPlayerReducedMotionEnabled, () => false);
  /** Milestone currently at the front of the queue. */
  const active = steps[index];
  /** A provisional win waits for its authoritative acknowledgement. */
  const canComplete = state.modal !== "victory" || state.completionAcknowledged;
  /** A front award starts on its first visible commit and survives later suspension. */
  const [collectingIndex, setCollectingIndex] = useState<number | null>(null);
  /** Current completion callback and queue length for scheduled transitions. */
  const latest = useRef({onComplete, count: steps.length});
  useLayoutEffect(() => {latest.current = {onComplete, count: steps.length};});

  useLayoutEffect(() => {
    if (!paused && !hidden && canComplete) setCollectingIndex(index);
  }, [index, paused, hidden, canComplete]);

  useLayoutEffect(() => {
    if (paused || hidden || active?.kind !== "achievement" || claimedIndex.current === index) return;
    if (seenAchievements.claim(active.achievementId)) claimedIndex.current = index;
    else {
      // Another receipt may have presented this achievement while it waited in the queue.
      setIndex(index + 1);
      setPhase("holding");
    }
  }, [active, index, paused, hidden, seenAchievements]);

  useEffect(() => {
    /** Keeps the presentation suspended while its document is hidden. */
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || hidden || completed.current) return;
    if (!active) {
      if (canComplete) {
        completed.current = true;
        setPhase("complete");
        latest.current.onComplete();
      }
      return;
    }
    if (phase === "ready") {
      if (index + 1 < steps.length || canComplete) setPhase("leaving");
      return;
    }
    if (phase === "holding" && !canComplete) return;
    /** Only the committed phase may advance after its motion finishes. */
    let retired = false;
    /** Moves only the current presentation phase after its hold or animation settles. */
    const advance = () => {
      if (retired) return;
      if (phase === "holding") setPhase("ready");
      else if (index + 1 < latest.current.count) {
        setIndex(index + 1);
        setPhase("holding");
      } else {
        completed.current = true;
        setPhase("complete");
        latest.current.onComplete();
      }
    };
    if (phase === "holding" || reducedMotion) {
      const holdMs = active.kind === "achievement" ? ACHIEVEMENT_TAB_HOLD_MS : FANFARE_TAB_HOLD_MS;
      /** Readable hold or reduced-motion transition cancelled when this phase retires. */
      const timer = window.setTimeout(advance, phase === "holding" ? holdMs : 0);
      return () => {retired = true; window.clearTimeout(timer);};
    }
    /** Both the outgoing tab and its successor must reach their final frames. */
    const animations = Array.from(tabs.current?.children ?? []).flatMap(tab => tab.getAnimations());
    void Promise.all(animations.map(animation => animation.finished)).then(advance, () => undefined);
    return () => {retired = true;};
  }, [active?.kind, index, steps.length, phase, paused, hidden, canComplete, reducedMotion]);

  if (phase === "complete") return id ? <div id={id} hidden /> : null;
  return (
    <div id={id} ref={tabs} className="fanfare-tabs" data-phase={phase} data-reduced-motion={reducedMotion} data-paused={paused || hidden}>
      {steps.slice(index).filter((step, offset) => offset === 0 || step.kind !== "achievement" ||
        !seenAchievements.hasSeen(step.achievementId)).slice(0, 2).map((step, offset) => {
        /** Confirmed award associated with this rendered milestone. */
        const award = getActiveCoinAward(state, step, step);
        return <div key={step.kind === "achievement" ? `achievement-${step.achievementId}` : step.kind}
          className={`fanfare-tab ${offset === 0 ? "current" : "waiting"}`}
          data-kind={step.kind} role={offset === 0 ? "status" : undefined}
          aria-hidden={offset > 0 ? true : undefined} aria-atomic="true">
          <FanfareTabContent step={step} level={state.lastRewards?.newLevel}
            award={award} collecting={offset === 0 && collectingIndex === index && canComplete}
            onBalancePreview={onBalancePreview} />
        </div>;
      })}
    </div>
  );
}
