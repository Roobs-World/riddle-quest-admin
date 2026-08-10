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
  activeTooltip,
  content,
  sequenceIndex,
  sequenceLength,
  targetRect,
  onAdvance,
}: TooltipOverlayProps) {
  const panelStyle = getTooltipPanelStyle(activeTooltip, targetRect, window.innerHeight);

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
        className="tooltip-card"
        role="dialog"
        aria-modal="true"
        style={panelStyle}
        data-analytics-screen="tooltip"
      >
        <small>{sequenceIndex + 1}/{sequenceLength}</small>
        <h3>{content.title}</h3>
        <p>{content.body}</p>
        <button className="play-primary compact" onClick={onAdvance}>
          {tr("Tooltips.GOT_IT_BUTTON")}
        </button>
      </section>
    </div>
  );
}
