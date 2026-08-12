import type {RefObject} from "react";
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
  const panelStyle = getTooltipPanelStyle(activeTooltip, targetRect, window.innerHeight);
  const titleId = `guidance-tooltip-${activeTooltip}-title`;
  const bodyId = `guidance-tooltip-${activeTooltip}-body`;

  return (
    <div className="tooltip-backdrop" role="presentation">
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
        <small>{sequenceIndex + 1}/{sequenceLength}</small>
        <h3 id={titleId}>{content.title}</h3>
        <p id={bodyId}>{content.body}</p>
        <button className="play-primary compact" onClick={onAdvance}>
          {tr("Tooltips.GOT_IT_BUTTON")}
        </button>
      </section>
    </div>
  );
}
