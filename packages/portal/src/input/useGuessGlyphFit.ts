import {useLayoutEffect, useRef} from "react";

/** Fits complete graphemes inside their existing hit targets without changing answer text. */
export function useGuessGlyphFit(contentKey: string) {
  /** One board owns resize and font notifications for all its cells. */
  const boardRef = useRef<HTMLDivElement>(null);
  /** The mounted board exposes a synchronous fit before changed text is painted. */
  const fitRef = useRef<((invalidate?: boolean) => void) | null>(null);

  useLayoutEffect(() => {
    /** The same board persists across drafts, confirmed guesses and revealed hints. */
    const board = boardRef.current;
    if (!board) return;
    /** A queued notification never outlives this mounted board. */
    let active = true;
    /** Coalesces resize and font completion notifications into one frame. */
    let frame: number | null = null;
    /** Settled text avoids repeating geometry work for unchanged history and hint cells. */
    let fittedText = new WeakMap<HTMLElement, string>();
    /** Local board geometry and column count invalidate cached cell budgets. */
    let sizeKey = "";
    /** Measures unscaled text in batches, retaining original font sizes for fitting cells. */
    const fit = (invalidate = false) => {
      if (!active) return;
      /** Board sizing is independent of the glyph transforms. */
      const nextSizeKey = `${board.clientWidth}:${board.clientHeight}:${board.style.getPropertyValue("--answer-length")}`;
      if (invalidate || sizeKey !== nextSizeKey) {
        fittedText = new WeakMap();
        sizeKey = nextSizeKey;
      }
      /** Only new or changed filled cells require text geometry. */
      const glyphs = Array.from(board.querySelectorAll<HTMLElement>(".cell-glyph"))
        .filter(glyph => glyph.textContent && fittedText.get(glyph) !== glyph.textContent);
      if (!glyphs.length) return;
      for (const glyph of glyphs) glyph.style.transform = "";
      /** One range supplies the complete rendered text bounds, including font fallback. */
      const range = document.createRange();
      /** All measurements precede the final transform writes. */
      const scales = glyphs.map(glyph => {
        /** The button remains the selectable and accessible target. */
        const cell = glyph.parentElement;
        if (!cell) return 1;
        /** Parent viewport scaling cancels between button and glyph bounds. */
        const bounds = cell.getBoundingClientRect();
        if (!bounds.width || !bounds.height || !cell.offsetWidth || !cell.offsetHeight) return 1;
        range.selectNodeContents(glyph);
        /** Range bounds include the full text line rather than a clipped wrapper. */
        const text = range.getBoundingClientRect();
        /** Two layout pixels leave breathing room within the existing cell border. */
        const width = Math.max(0, cell.clientWidth - 4) * bounds.width / cell.offsetWidth;
        /** The vertical budget uses the same local-to-viewport conversion. */
        const height = Math.max(0, cell.clientHeight - 4) * bounds.height / cell.offsetHeight;
        return Math.min(1, text.width ? width / text.width : 1, text.height ? height / text.height : 1);
      });
      glyphs.forEach((glyph, index) => {
        /** The corresponding measured scale never enlarges a glyph. */
        const scale = scales[index] ?? 1;
        if (scale < 1) glyph.style.transform = `scale(${scale})`;
        fittedText.set(glyph, glyph.textContent ?? "");
      });
    };
    /** Notification bursts schedule at most one geometry pass. */
    const schedule = () => {
      if (!active || frame !== null) return;
      frame = requestAnimationFrame(() => {frame = null; fit(true);});
    };
    fitRef.current = fit;
    /** Observe the board once, rather than installing an observer for every glyph. */
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(board);
    window.addEventListener("resize", schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      active = false;
      fitRef.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {fitRef.current?.();}, [contentKey]);
  return boardRef;
}
