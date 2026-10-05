import {useEffect, useRef} from "react";
import {runWhenLayoutReady} from "../layoutReady";

/** Provides viewport fit. */
export function useViewportFit() {
  /** Provides shell ref behavior. */
  const shellRef = useRef<HTMLElement | null>(null);
  /** Provides content ref behavior. */
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /** Provides shell behavior. */
    const shell = shellRef.current;
    /** Provides content behavior. */
    const content = contentRef.current;
    if (!shell || !content) return;

    /** Provides animation frame behavior. */
    let animationFrame = 0;
    /** Provides fit content behavior. */
    const fitContent = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        /** Provides available height behavior. */
        const availableHeight = shell.clientHeight;
        if (availableHeight <= 0) return;
        // Measure intrinsic content, without the previous fitted minimum height.
        // Width changes wrapping and circular-cell height, so solve the final
        // layout within this frame instead of feeding each fit into the next.
        content.style.minHeight = "0";
        /** Measures the height produced by one candidate width and scale. */
        const scaledHeight = (scale: number) => {
          content.style.width = `${100 / scale}%`;
          content.style.setProperty("--solo-viewport-scale", String(scale));
          return content.scrollHeight * scale;
        };
        /** Largest scale whose final layout fits the available height. */
        let nextScale = 1;
        if (scaledHeight(1) > availableHeight) {
          /** Lower fitting scale bound. */
          let lower = 0;
          /** Upper overflowing scale bound. */
          let upper = 1;
          for (let iteration = 0; iteration < 12; iteration += 1) {
            /** Candidate scale for the current intrinsic layout. */
            const candidate = (lower + upper) / 2;
            if (scaledHeight(candidate) <= availableHeight) lower = candidate;
            else upper = candidate;
          }
          nextScale = Math.max(lower, 1 / 4096);
        }
        /** Provides next width behavior. */
        const nextWidth = `${100 / nextScale}%`;
        /** Provides next transform behavior. */
        const nextTransform = `scale(${nextScale}) translateX(-50%)`;

        if (content.style.width !== nextWidth) content.style.width = nextWidth;
        if (content.style.transform !== nextTransform) content.style.transform = nextTransform;
        content.style.setProperty("--solo-viewport-scale", String(nextScale));
        // Let the grid distribute spare space inside the fitted viewport.
        content.style.minHeight = `${availableHeight / nextScale}px`;
        shell.style.overflowY = "hidden";
        content.dataset.viewportScale = nextScale.toFixed(4);
      });
    };

    /** Provides observer behavior. */
    let observer: ResizeObserver | null = null;
    /** Stops waiting for layout. */
    const stopWaitingForLayout = runWhenLayoutReady(() => {
      fitContent();
      window.addEventListener("resize", fitContent);
      observer = new ResizeObserver(fitContent);
      observer.observe(shell);
      observer.observe(content);
    });
    return () => {
      stopWaitingForLayout();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", fitContent);
      observer?.disconnect();
      shell.style.overflowY = "";
      content.style.removeProperty("--solo-viewport-scale");
    };
  }, []);

  return {shellRef, contentRef};
}
