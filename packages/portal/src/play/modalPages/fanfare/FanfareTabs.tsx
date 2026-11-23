import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from "react";
import type {GameSessionState} from "@riddle-quest/hosted/play/gameSession";
import {isPlayerReducedMotionEnabled, subscribeToPlayerReducedMotion} from "../../playerPreferences";
import {FanfareTabContent} from "./FanfareModalContent";
import {createRewardFanfareSteps, createVictoryFanfareSteps, getActiveCoinAward, type FanfareStep} from "./fanfareSequence";
import "../../../styles.fanfare-tabs.css";

/** Readable time after a tab has reached the front of the queue. */
export const FANFARE_TAB_HOLD_MS = 1000;

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
  /** Confirmed milestone queue, optionally supplied by the win dialog. */
  const steps = suppliedSteps ?? (state.modal === "victory"
    ? createVictoryFanfareSteps(state.lastRewards) : createRewardFanfareSteps(state.auxiliaryFanfare));
  /** Current position in the automatic milestone queue. */
  const [index, setIndex] = useState(0);
  /** Entry, readable hold, and exit state for the front tab. */
  const [phase, setPhase] = useState<"entering" | "holding" | "ready" | "leaving" | "complete">("entering");
  /** Delays tab animation until the underlying completion has painted. */
  const [surfacePainted, setSurfacePainted] = useState(false);
  /** Background tabs retain unread milestones. */
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  /** Completion callback fires once for this presentation. */
  const completed = useRef(false);
  /** Browser animation completion owns entry, promotion and removal. */
  const tabs = useRef<HTMLDivElement>(null);
  /** Player preference removes sliding motion. */
  const reducedMotion = useSyncExternalStore(subscribeToPlayerReducedMotion, isPlayerReducedMotionEnabled, () => false);
  /** Milestone currently at the front of the queue. */
  const active = steps[index];
  /** A provisional win waits for its authoritative acknowledgement. */
  const canComplete = state.modal !== "victory" || state.completionAcknowledged;
  /** Current completion callback and queue length for scheduled transitions. */
  const latest = useRef({onComplete, count: steps.length});
  useLayoutEffect(() => {latest.current = {onComplete, count: steps.length};});

  useEffect(() => {
    /** Prevents a frame callback from updating an unmounted presentation. */
    let retired = false;
    /** Second paint callback handle retained for cancellation during cleanup. */
    let secondFrame = 0;
    /** First paint callback schedules the frame that reveals the tabs. */
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (!retired) setSurfacePainted(true);
      });
    });
    return () => {
      retired = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    /** Keeps the presentation suspended while its document is hidden. */
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!surfacePainted || paused || hidden || completed.current) return;
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
      if (phase === "entering") setPhase("holding");
      else if (phase === "holding") setPhase("ready");
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
      /** Readable hold or reduced-motion transition cancelled when this phase retires. */
      const timer = window.setTimeout(advance, phase === "holding" ? FANFARE_TAB_HOLD_MS : 0);
      return () => {retired = true; window.clearTimeout(timer);};
    }
    /** Both the outgoing tab and its successor must reach their final frames. */
    const animations = Array.from(tabs.current?.children ?? []).flatMap(tab => tab.getAnimations());
    void Promise.all(animations.map(animation => animation.finished)).then(advance, () => undefined);
    return () => {retired = true;};
  }, [active?.kind, index, steps.length, phase, paused, hidden, canComplete, reducedMotion, surfacePainted]);

  if (!surfacePainted || phase === "complete") return id ? <div id={id} hidden /> : null;
  return (
    <div id={id} ref={tabs} className="fanfare-tabs" data-phase={phase} data-reduced-motion={reducedMotion} data-paused={paused || hidden}>
      {steps.slice(index, index + 2).map((step, offset) => {
        /** Confirmed award associated with this rendered milestone. */
        const award = getActiveCoinAward(state, step, step);
        return <div key={step.kind === "achievement" ? `achievement-${step.achievementId}` : step.kind}
          className={`fanfare-tab ${offset === 0 ? "current" : "waiting"}`}
          data-kind={step.kind} role={offset === 0 ? "status" : undefined}
          aria-hidden={offset > 0 ? true : undefined} aria-atomic="true">
          <FanfareTabContent step={step} level={state.lastRewards?.newLevel}
            award={award} collecting={offset === 0 && phase !== "entering" && canComplete}
            onBalancePreview={onBalancePreview} />
        </div>;
      })}
    </div>
  );
}
