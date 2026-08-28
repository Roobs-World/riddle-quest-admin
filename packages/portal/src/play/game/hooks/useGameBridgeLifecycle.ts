import {useEffect, useRef} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {createRequestId} from "../../requestIds";
import {HOST_TO_GAME_EVENT} from "../../localBridge";
import {tr} from "../../i18n";
import {runWhenLayoutReady} from "../layoutReady";
import {captureBrowserException} from "../../../observability/browserErrorReporter";

/** Describes message router. */
type MessageRouter = (message: unknown) => Promise<unknown>;

/** Provides report bridge error behavior. */
function reportBridgeError(error: unknown, requestPrefix: string, postToHost: (message: GameToHostMessage) => void) {
  captureBrowserException(error, {component: "game_bridge", operation: requestPrefix});
  postToHost({
    type: "game:error",
    requestId: createRequestId(requestPrefix),
    payload: {message: error instanceof Error ? error.message : tr("WebPortal.BRIDGE_ERROR")},
  });
}

/** Provides game ready reporter. */
export function useGameReadyReporter({
  initialized,
  sendReady,
  postToHost,
}: {
  /** Stores initialized. */
  initialized: boolean;
  /** Stores send ready. */
  sendReady: () => void;
  /** Stores post to host. */
  postToHost: (message: GameToHostMessage) => void;
}) {
  /** Provides initialized ref behavior. */
  const initializedRef = useRef(initialized);
  initializedRef.current = initialized;

  useEffect(() => {
    /** Reads y timer. */
    const readyTimer = window.setTimeout(sendReady, 0);
    /** Reads y interval. */
    const readyInterval = window.setInterval(() => {
      if (!initializedRef.current) sendReady();
    }, 750);
    /** Provides report size behavior. */
    const reportSize = () => {
      postToHost({
        type: "game:resize",
        requestId: createRequestId("resize"),
        payload: {
          width: Math.ceil(document.documentElement.clientWidth),
          height: Math.ceil(document.documentElement.clientHeight),
        },
      });
    };
    /** Provides observer behavior. */
    let observer: ResizeObserver | null = null;
    /** Stops waiting for layout. */
    const stopWaitingForLayout = runWhenLayoutReady(() => {
      reportSize();
      window.addEventListener("resize", reportSize);
      observer = new ResizeObserver(reportSize);
      observer.observe(document.body);
    });
    return () => {
      stopWaitingForLayout();
      window.clearTimeout(readyTimer);
      window.clearInterval(readyInterval);
      window.removeEventListener("resize", reportSize);
      observer?.disconnect();
    };
  }, [postToHost, sendReady]);
}

/** Provides game message listener. */
export function useGameMessageListener({
  router,
  postToHost,
}: {
  /** Stores router. */
  router: MessageRouter;
  /** Stores post to host. */
  postToHost: (message: GameToHostMessage) => void;
}) {
  useEffect(() => {
    /** Handles message. */
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      void router(event.data).catch((error) => reportBridgeError(error, "parse-error", postToHost));
    };
    /** Handles local message. */
    const handleLocalMessage = (event: Event) => {
      void router((event as CustomEvent<unknown>).detail).catch((error) =>
        reportBridgeError(error, "local-parse-error", postToHost),
      );
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    };
  }, [postToHost, router]);
}
