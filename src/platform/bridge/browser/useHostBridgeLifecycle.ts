import {useEffect, useLayoutEffect, useRef} from "react";
import type {GameToHostMessage, HostToGameMessage} from "../messages";
import {captureBrowserException} from "../../../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import {GAME_TO_HOST_EVENT} from "./localBridge";
import {createRequestId} from "../../../gameplay/session/requestIds";
import type {LifecycleCapability} from "../../contracts/capabilities";
import {BridgeParserLoadError} from "./bridgeRouter";

/** Routes one untrusted local bridge value after schema validation. */
type HostMessageRouter = (value: unknown, isCurrent?: () => boolean) => Promise<GameToHostMessage>;

/** Inputs required by the shared hosted-document lifecycle. */
type HostBridgeLifecycleOptions = Readonly<{
  /** Latest state-aware game-to-host router. */
  router: HostMessageRouter;
  /** Sends a host message through the active local bridge adapter. */
  postToGame: (message: HostToGameMessage) => void;
  /** Updates the player-facing host notice. */
  setNotice: (notice: string | null) => void;
  /** Captured authentication visit; retired accounts cannot route or receive errors. */
  ownsMessage: () => boolean;
  /** Shows document-reload recovery when the browser cannot load shared validation code. */
  onUnavailable?: () => void;
  /** Optional target SDK lifecycle, including pauses while the document remains visible. */
  lifecycle?: LifecycleCapability;
}>;

/** Owns stable local bridge routing and document visibility delivery for hosted targets. */
export function useHostBridgeLifecycle({router, postToGame, setNotice, ownsMessage, onUnavailable, lifecycle}: HostBridgeLifecycleOptions): void {
  /** Latest router, allowing one stable DOM subscription across host state changes. */
  const routerRef = useRef(router);
  /** Latest message sender used by the stable visibility subscription. */
  const postToGameRef = useRef(postToGame);
  /** Latest notice updater used by asynchronous routing failures. */
  const setNoticeRef = useRef(setNotice);
  /** The current account guard changes independently of the stable subscriptions. */
  const ownsMessageRef = useRef(ownsMessage);
  /** Recovery presentation follows current host state without replacing DOM subscriptions. */
  const onUnavailableRef = useRef(onUnavailable);
  // Unfinished renders must not redirect commands or signals for the visible host.
  useLayoutEffect(() => {
    routerRef.current = router;
    postToGameRef.current = postToGame;
    setNoticeRef.current = setNotice;
    ownsMessageRef.current = ownsMessage;
    onUnavailableRef.current = onUnavailable;
  }, [router, postToGame, setNotice, ownsMessage, onUnavailable]);

  /** Each committed lifecycle owns one subscription group before passive cleanup runs. */
  const subscriptionOwner = useRef<object | null>(null);
  useLayoutEffect(() => {
    /** A new token also prevents retired StrictMode callbacks from becoming current again. */
    const owner = {};
    subscriptionOwner.current = owner;
    return () => {if (subscriptionOwner.current === owner) subscriptionOwner.current = null;};
  }, [lifecycle]);

  useEffect(() => {
    /** SDK callbacks and pending rejections cannot outlive this subscription group. */
    let active = true;
    /** This effect retains only the lifecycle that actually committed its subscriptions. */
    const owner = subscriptionOwner.current;
    /** Removed or replaced hosts stop delivery before React detaches passive listeners. */
    const isActive = () => active && owner !== null && subscriptionOwner.current === owner;
    /** A failed shared import can reject several queued messages; show recovery once. */
    let unavailableReported = false;
    /** Routes one local game message through the latest state-aware router. */
    const handleLocalMessage = (event: Event) => {
      /** Account notifications invalidate this visit before React commits replacement state. */
      const owned = ownsMessageRef.current;
      if (!isActive() || unavailableReported || !owned()) return;
      /** Current errors may use a newer notice sink only while their original account still owns them. */
      const reportError = (error: unknown) => {
        if (!isActive() || unavailableReported || !owned()) return;
        if (error instanceof BridgeParserLoadError && onUnavailableRef.current) {
          captureBrowserException(error, {component: "play_host", operation: "load_bridge_validation"});
          if (!isActive() || !owned()) return;
          unavailableReported = true;
          try {
            onUnavailableRef.current();
            return;
          } catch (recoveryError) {
            unavailableReported = false;
            captureBrowserException(recoveryError, {component: "play_host", operation: "bridge_recovery_delivery"});
          }
        } else {
          captureBrowserException(error, {component: "play_host", operation: "route_local_message"});
        }
        if (!isActive() || !owned()) return;
        try {
          setNoticeRef.current(getHostErrorMessage(error));
        } catch (noticeError) {
          captureBrowserException(noticeError, {component: "play_host", operation: "route_notice_delivery"});
        }
      };
      try {
        void Promise.resolve(routerRef.current((event as CustomEvent<unknown>).detail, () => isActive() && owned())).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };
    /** Provider lifecycle delivery remains synchronous and cannot throw through an SDK callback. */
    const deliverLifecycle = (type: "host:pause" | "host:resume", requestPrefix: string) => {
      if (!isActive()) return;
      try {
        postToGameRef.current({type, requestId: createRequestId(requestPrefix), payload: {}});
      } catch (error) {
        captureBrowserException(error, {component: "play_host", operation: requestPrefix});
      }
    };
    /** Projects browser visibility into the target-neutral game lifecycle. */
    const handleVisibilityChange = () => {
      deliverLifecycle(document.visibilityState === "hidden" ? "host:pause" : "host:resume", "visibility");
    };
    window.addEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    /** Keeps independent optional SDK signals usable when another registration or cleanup fails. */
    const subscribeLifecycle = (operation: string, subscribe: (callback: () => void) => (() => void) | undefined, callback: () => void) => {
      /** Some SDKs retain the callback even when their registration subsequently throws. */
      let subscribed = true;
      try {
        /** Wraps each signal with its own registration lifetime as well as the effect lifetime. */
        const unsubscribe = subscribe(() => {if (isActive() && subscribed) callback();});
        return () => {
          subscribed = false;
          try {
            unsubscribe?.();
          } catch (error) {
            captureBrowserException(error, {component: "play_host", operation: `unsubscribe_${operation}`});
          }
        };
      } catch (error) {
        subscribed = false;
        captureBrowserException(error, {component: "play_host", operation: `subscribe_${operation}`});
        return undefined;
      }
    };
    /** Detaches provider pause notifications when the host unmounts. */
    const unsubscribePause = lifecycle ? subscribeLifecycle("platform-pause", (callback) => lifecycle.onPause(callback), () => {
      deliverLifecycle("host:pause", "platform-pause");
    }) : undefined;
    /** Detaches provider resume notifications when the host unmounts. */
    const unsubscribeResume = lifecycle?.onResume ? subscribeLifecycle("platform-resume", (callback) => lifecycle.onResume?.(callback), () => {
      if (document.visibilityState !== "hidden") {
        deliverLifecycle("host:resume", "platform-resume");
      }
    }) : undefined;
    return () => {
      active = false;
      window.removeEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribePause?.();
      unsubscribeResume?.();
    };
  }, [lifecycle]);
}
