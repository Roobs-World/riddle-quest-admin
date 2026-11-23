import {useLayoutEffect, useState, type RefObject} from "react";
import {tr} from "../i18n";
import {getTooltipPanelStyle, type TooltipId} from "./guidanceConfig";

/** Translated content displayed inside one tooltip. */
export type TooltipContent = {
  /** Stores title. */
  title: string;
  /** Stores body. */
  body: string;
};

/** Props required to position and render a guided tooltip. */
export type TooltipOverlayProps = {
  /** Stores the active dialog element for focus containment. */
  cardRef: RefObject<HTMLElement | null>;
  /** Stores active tooltip. */
  activeTooltip: TooltipId;
  /** Stores content. */
  content: TooltipContent;
  /** Stores sequence index. */
  sequenceIndex: number;
  /** Stores sequence length. */
  sequenceLength: number;
  /** Stores target rect. */
  targetRect: DOMRect | null;
  /** Stores on advance. */
  onAdvance: () => void;
};

/** Renders a tooltip with an optional spotlight around its target control. */
export function TooltipOverlay({
  cardRef,
  activeTooltip,
  content,
  sequenceIndex,
  sequenceLength,
  targetRect,
  onAdvance,
}: TooltipOverlayProps) {
  /** Measured card size keeps translated text and its action inside the viewport. */
  const [panelSize, setPanelSize] = useState({height: 0, viewportHeight: window.innerHeight});
  /** Only anchored placement depends on measured panel dimensions. */
  const needsPanelMeasurement = targetRect !== null;
  useLayoutEffect(() => {
    if (!needsPanelMeasurement) return;
    /** Tooltip element whose dimensions determine placement. */
    const card = cardRef.current;
    if (!card) return;
    /** Refreshes panel and viewport dimensions after layout changes. */
    const measure = () => {
      /** Rendered tooltip height, including translated content. */
      // Natural height, so a card capped to the available room is not re-measured as smaller.
      const height = Math.max(card.getBoundingClientRect().height, card.scrollHeight + card.offsetHeight - card.clientHeight);
      /** Current available viewport height. */
      const viewportHeight = window.innerHeight;
      setPanelSize(previous => previous.height === height && previous.viewportHeight === viewportHeight
        ? previous : {height, viewportHeight});
    };
    measure();
    /** Tracks tooltip size changes as its content wraps. */
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeTooltip, cardRef, content, needsPanelMeasurement]);
  /** Provides panel style behavior. */
  const panelStyle = getTooltipPanelStyle(activeTooltip, targetRect, panelSize.viewportHeight, panelSize.height);
  /** Provides title id behavior. */
  const titleId = `guidance-tooltip-${activeTooltip}-title`;
  /** Provides body id behavior. */
  const bodyId = `guidance-tooltip-${activeTooltip}-body`;

  return (
    <div className="tooltip-backdrop" role="presentation" data-tooltip-id={activeTooltip}>
      {targetRect ? (
        <div
          className="tooltip-spotlight"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      ) : null}
      <section
        ref={cardRef}
        className="tooltip-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={panelStyle}
        data-analytics-screen="tooltip"
      >
        <small>
          {sequenceIndex + 1}/{sequenceLength}
        </small>
        <h2 id={titleId}>{content.title}</h2>
        <p id={bodyId}>{content.body}</p>
        <button className="play-primary compact" onClick={onAdvance}>
          {tr("Tooltips.GOT_IT_BUTTON")}
        </button>
      </section>
    </div>
  );
}
