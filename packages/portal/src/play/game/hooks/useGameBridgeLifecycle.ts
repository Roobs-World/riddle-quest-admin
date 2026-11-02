import {useEffect, useLayoutEffect, useRef} from "react";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import {createRequestId} from "../../requestIds";
import {HOST_TO_GAME_EVENT} from "../../localBridge";
import {tr} from "../../i18n";
import {runWhenLayoutReady} from "../layoutReady";
import {captureBrowserException} from "../../../observability/browserErrorReporter";

/** Describes message router. */
type MessageRouter = (message: unknown, isCurrent?: () => boolean) => Promise<unknown>;

/** Provides report bridge error behavior. */
function reportBridgeError(error: unknown, requestPrefix: string, postToHost: (message: GameToHostMessage) => void, ownsReply: () => boolean) {
  if (!ownsReply()) return;
  captureBrowserException(error, {component: "game_bridge", operation: requestPrefix});
  if (!ownsReply()) return;
  try {
    postToHost({
      type: "game:error",
      requestId: createRequestId(requestPrefix),
      payload: {message: error instanceof Error ? error.message : tr("WebPortal.BRIDGE_ERROR")},
    });
  } catch (deliveryError) {
    // A failed error reply must not recursively try the same host transport.
    captureBrowserException(deliveryError, {component: "game_bridge", operation: "error_reply"});
  }
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
  /** Readiness callbacks follow committed initialization, including suspended renders. */
  const initializedRef = useRef(initialized);
  useLayoutEffect(() => {initializedRef.current = initialized;}, [initialized]);

  /** A committed readiness subscription owns its pending timer callbacks. */
  const readyOwnerRef = useRef<object | null>(null);
  useLayoutEffect(() => {
    /** A fresh token prevents StrictMode replay from reviving a retired sender. */
    const owner = {};
    readyOwnerRef.current = owner;
    return () => {if (readyOwnerRef.current === owner) readyOwnerRef.current = null;};
  }, [initialized, sendReady]);

  /** Resize observation follows its own committed sender independently of readiness. */
  const resizeOwnerRef = useRef<object | null>(null);
  useLayoutEffect(() => {
    /** Each committed viewport sender receives a distinct callback scope. */
    const owner = {};
    resizeOwnerRef.current = owner;
    return () => {if (resizeOwnerRef.current === owner) resizeOwnerRef.current = null;};
  }, [postToHost]);

  useEffect(() => {
    if (initialized) return;
    /** The passive timer setup captures the exact committed readiness sender. */
    const owner = readyOwnerRef.current;
    /** Retired callbacks cannot emit through a replacement readiness sender. */
    let active = true;
    /** A committed initialization also suppresses callbacks queued before effect cleanup. */
    const reportReady = () => {if (active && owner !== null && readyOwnerRef.current === owner && !initializedRef.current) sendReady();};
    /** Lost initialization restarts the handshake immediately rather than waiting for an old interval. */
    const readyTimer = window.setTimeout(reportReady, 0);
    /** Retry cadence exists only while the host has not acknowledged initialization. */
    const readyInterval = window.setInterval(reportReady, 750);
    return () => {active = false; window.clearTimeout(readyTimer); window.clearInterval(readyInterval);};
  }, [initialized, sendReady]);

  useEffect(() => {
    /** Deferred layout and observer callbacks belong to this committed sender. */
    const owner = resizeOwnerRef.current;
    /** Resize callbacks remain independent of handshake status and callback replacement. */
    let active = true;
    /** Only changed viewport dimensions need another bridge message and request identity. */
    let lastWidth = -1, lastHeight = -1;
    /** Reports each actual viewport size once to its owning host. */
    const reportSize = () => {
      if (!active || owner === null || resizeOwnerRef.current !== owner) return;
      /** The same rounded geometry is shared by native resize and body observation. */
      const width = Math.ceil(document.documentElement.clientWidth), height = Math.ceil(document.documentElement.clientHeight);
      if (width === lastWidth && height === lastHeight) return;
      postToHost({
        type: "game:resize",
        requestId: createRequestId("resize"),
        payload: {
          width,
          height,
        },
      });
      lastWidth = width; lastHeight = height;
    };
    /** Provides observer behavior. */
    let observer: ResizeObserver | null = null;
    /** Stops waiting for layout. */
    const stopWaitingForLayout = runWhenLayoutReady(() => {
      reportSize();
      // Host delivery can synchronously remove or replace this reporter before setup resumes.
      if (!active || owner === null || resizeOwnerRef.current !== owner) return;
      window.addEventListener("resize", reportSize);
      observer = new ResizeObserver(reportSize);
      observer.observe(document.body);
    });
    return () => {
      active = false;
      stopWaitingForLayout();
      window.removeEventListener("resize", reportSize);
      observer?.disconnect();
    };
  }, [postToHost]);
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
  // Install before synchronous completion replies and retire before parent layout callbacks.
  useLayoutEffect(() => {
    /** Pending rejections belong only to the listener that dispatched their messages. */
    let active = true;
    /** Rechecks ownership after optional telemetry, which can synchronously close the game. */
    const ownsReply = () => active;
    /** Preserves immediate routing while observing synchronous throws and asynchronous rejection. */
    const routeMessage = (message: unknown, requestPrefix: string) => {
      if (!active) return;
      try {
        void Promise.resolve(router(message, ownsReply)).catch((error) => reportBridgeError(error, requestPrefix, postToHost, ownsReply));
      } catch (error) {
        reportBridgeError(error, requestPrefix, postToHost, ownsReply);
      }
    };
    /** Handles message. */
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      routeMessage(event.data, "parse-error");
    };
    /** Handles local message. */
    const handleLocalMessage = (event: Event) => {
      routeMessage((event as CustomEvent<unknown>).detail, "local-parse-error");
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    return () => {
      active = false;
      window.removeEventListener("message", handleMessage);
      window.removeEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    };
  }, [postToHost, router]);
}
