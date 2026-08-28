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
        /** Provides natural height behavior. */
        const naturalHeight = content.scrollHeight;
        /** Provides scale behavior. */
        const scale = availableHeight > 0 && naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
        /** Provides next scale behavior. */
        const nextScale = Math.min(1, scale);
        /** Provides next width behavior. */
        const nextWidth = `${100 / nextScale}%`;
        /** Provides next transform behavior. */
        const nextTransform = `scale(${nextScale}) translateX(-50%)`;

        if (content.style.width !== nextWidth) content.style.width = nextWidth;
        if (content.style.transform !== nextTransform) content.style.transform = nextTransform;
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
    };
  }, []);

  return {shellRef, contentRef};
}
