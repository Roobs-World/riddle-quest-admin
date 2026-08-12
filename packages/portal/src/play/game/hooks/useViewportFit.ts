import {useEffect, useRef} from "react";
import {runWhenLayoutReady} from "../layoutReady";

/** Keeps scaled controls above a practical mobile touch-target floor. */
const MIN_VIEWPORT_SCALE = 0.92;

/** Provides viewport fit. */
export function useViewportFit() {
  const shellRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return;

    let animationFrame = 0;
    const fitContent = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const availableHeight = shell.clientHeight;
        const naturalHeight = content.scrollHeight;
        const scale = availableHeight > 0 && naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
        const nextScale = Math.max(MIN_VIEWPORT_SCALE, Math.min(1, scale));
        const nextWidth = `${100 / nextScale}%`;
        const nextTransform = `scale(${nextScale}) translateX(-50%)`;

        if (content.style.width !== nextWidth) content.style.width = nextWidth;
        if (content.style.transform !== nextTransform) content.style.transform = nextTransform;
        shell.style.overflowY = scale < MIN_VIEWPORT_SCALE ? "auto" : "hidden";
        content.dataset.viewportScale = nextScale.toFixed(4);
      });
    };

    let observer: ResizeObserver | null = null;
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
