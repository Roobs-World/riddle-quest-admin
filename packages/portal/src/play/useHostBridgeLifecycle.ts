import {useEffect, useRef} from "react";
import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import {GAME_TO_HOST_EVENT} from "./localBridge";
import {createRequestId} from "./requestIds";

/** Routes one untrusted local bridge value after schema validation. */
type HostMessageRouter = (value: unknown) => Promise<GameToHostMessage>;

/** Inputs required by the shared hosted-document lifecycle. */
type HostBridgeLifecycleOptions = Readonly<{
  /** Latest state-aware game-to-host router. */
  router: HostMessageRouter;
  /** Sends a host message through the active local bridge adapter. */
  postToGame: (message: HostToGameMessage) => void;
  /** Updates the player-facing host notice. */
  setNotice: (notice: string | null) => void;
}>;

/** Owns stable local bridge routing and document visibility delivery for hosted targets. */
export function useHostBridgeLifecycle({router, postToGame, setNotice}: HostBridgeLifecycleOptions): void {
  /** Latest router, allowing one stable DOM subscription across host state changes. */
  const routerRef = useRef(router);
  /** Latest message sender used by the stable visibility subscription. */
  const postToGameRef = useRef(postToGame);
  /** Latest notice updater used by asynchronous routing failures. */
  const setNoticeRef = useRef(setNotice);
  routerRef.current = router;
  postToGameRef.current = postToGame;
  setNoticeRef.current = setNotice;

  useEffect(() => {
    /** Routes one local game message through the latest state-aware router. */
    const handleLocalMessage = (event: Event) => {
      void routerRef.current((event as CustomEvent<unknown>).detail).catch((error) => {
        captureBrowserException(error, {component: "play_host", operation: "route_local_message"});
        setNoticeRef.current(getHostErrorMessage(error));
      });
    };
    /** Projects browser visibility into the target-neutral game lifecycle. */
    const handleVisibilityChange = () => {
      postToGameRef.current({
        type: document.visibilityState === "hidden" ? "host:pause" : "host:resume",
        requestId: createRequestId("visibility"),
        payload: {},
      });
    };
    window.addEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
