import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {View} from "react-native";
import type {TooltipId, TooltipRequest, TargetRect, TooltipSequenceRequest} from "../components/tooltips/types";
import TooltipOverlay from "../components/tooltips/TooltipOverlay";
import {hasSeenTooltip, markTooltipSeen} from "../components/tooltips/tooltipStorage";
import {DEV_SHOW_TIPS} from "../constants/tooltips";
import {logger} from "../utils/logger";

interface TooltipContextValue {
  activeTooltipId: TooltipId | null;
  showTooltip: (request: TooltipRequest) => Promise<void>;
  showTooltipOnce: (request: TooltipRequest) => Promise<boolean>;
  showTooltipSequence: (requests: TooltipSequenceRequest[]) => Promise<boolean>;
  cancelTooltipSequence: () => void;
  dismissTooltip: (id?: TooltipId) => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

const TARGET_MEASURE_RETRY_COUNT = 6;

const waitForNextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const isValidTargetRect = (x: number, y: number, width: number, height: number): boolean =>
  [x, y, width, height].every((value) => Number.isFinite(value)) && x >= 0 && y >= 0 && width > 0 && height > 0;

const measureTargetOnce = (request: TooltipRequest): Promise<TargetRect | null> => {
  const target = request.targetRef?.current;
  if (!target || typeof target.measureInWindow !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    target.measureInWindow((x, y, width, height) => {
      logger.debug("[TooltipContext] measured target", {
        id: request.id,
        x,
        y,
        width,
        height,
      });

      if (isValidTargetRect(x, y, width, height)) {
        resolve({x, y, width, height});
        return;
      }

      resolve(null);
    });
  });
};

const measureTarget = async (request: TooltipRequest): Promise<TargetRect | null> => {
  for (let attempt = 0; attempt <= TARGET_MEASURE_RETRY_COUNT; attempt += 1) {
    const target = request.targetRef?.current;
    if (!target || typeof target.measureInWindow !== "function") {
      logger.debug("[TooltipContext] target missing or not measurable", {
        id: request.id,
        attempt,
        hasTarget: Boolean(target),
        hasMeasureInWindow: typeof target?.measureInWindow === "function",
      });
    } else {
      const measuredTarget = await measureTargetOnce(request);
      if (measuredTarget) {
        return measuredTarget;
      }
    }

    if (attempt < TARGET_MEASURE_RETRY_COUNT) {
      await waitForNextFrame();
    }
  }

  logger.warn("[TooltipContext] target measurement unavailable after retries", {
    id: request.id,
    retryCount: TARGET_MEASURE_RETRY_COUNT,
  });
  return null;
};

export const TooltipProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [activeRequest, setActiveRequest] = useState<TooltipRequest | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const sequenceQueueRef = useRef<TooltipSequenceRequest[]>([]);

  useEffect(() => {
    if (DEV_SHOW_TIPS) {
      logger.info("[TooltipContext] DEV_SHOW_TIPS enabled; tooltip seen state will not suppress tips.");
    }
  }, []);

  const activateTooltip = useCallback(async (request: TooltipRequest): Promise<void> => {
    try {
      await request.onBeforeShow?.();
      await waitForNextFrame();
      logger.debug("[TooltipContext] showTooltip requested", {
        id: request.id,
        hasTargetRef: Boolean(request.targetRef?.current),
        userId: request.userId ?? null,
        persist: request.persist ?? false,
      });
      const measuredTarget = await measureTarget(request);
      logger.debug("[TooltipContext] activating tooltip", {
        id: request.id,
        measuredTarget,
      });
      setTargetRect(measuredTarget);
      setActiveRequest(request);
      setIsTooltipVisible(true);
    } catch (err) {
      logger.warn("showTooltip failed", err);
    }
  }, []);

  const showTooltip = useCallback(
    async (request: TooltipRequest): Promise<void> => {
      sequenceQueueRef.current = [];
      await activateTooltip(request);
    },
    [activateTooltip],
  );

  const showTooltipSequence = useCallback(
    async (requests: TooltipSequenceRequest[]): Promise<boolean> => {
      const [firstRequest, ...remainingRequests] = requests;
      if (!firstRequest) {
        sequenceQueueRef.current = [];
        return false;
      }

      sequenceQueueRef.current = remainingRequests;
      await activateTooltip(firstRequest);
      return true;
    },
    [activateTooltip],
  );

  const cancelTooltipSequence = useCallback(() => {
    sequenceQueueRef.current = [];
    setIsTooltipVisible(false);
  }, []);

  const dismissTooltip = useCallback(
    (id?: TooltipId) => {
      logger.debug("[TooltipContext] dismissTooltip requested", {
        requestedId: id ?? null,
        activeTooltipId: activeRequest?.id ?? null,
      });
      if (id && activeRequest?.id !== id) {
        logger.debug("[TooltipContext] dismiss ignored due to id mismatch", {
          requestedId: id,
          activeTooltipId: activeRequest?.id ?? null,
        });
        return;
      }

      if (activeRequest && !activeRequest.persist) {
        void Promise.resolve(markTooltipSeen(activeRequest.id, activeRequest.userId)).catch((err) => {
          logger.warn("markTooltipSeen failed", err);
        });
      }

      setIsTooltipVisible(false);
    },
    [activeRequest],
  );

  const showTooltipOnce = useCallback(
    async (request: TooltipRequest): Promise<boolean> => {
      try {
        const seen = DEV_SHOW_TIPS ? false : await hasSeenTooltip(request.id, request.userId);
        logger.debug("[TooltipContext] showTooltipOnce check", {
          id: request.id,
          seen,
          devShowTips: DEV_SHOW_TIPS,
          userId: request.userId ?? null,
        });
        if (seen) {
          return false;
        }

        await showTooltip(request);

        return true;
      } catch (err) {
        logger.warn("showTooltipOnce failed", err);
        return false;
      }
    },
    [showTooltip],
  );

  const contextValue = useMemo(
    () => ({
      activeTooltipId: isTooltipVisible ? (activeRequest?.id ?? null) : null,
      showTooltip,
      showTooltipOnce,
      showTooltipSequence,
      cancelTooltipSequence,
      dismissTooltip,
    }),
    [
      activeRequest?.id,
      cancelTooltipSequence,
      dismissTooltip,
      isTooltipVisible,
      showTooltip,
      showTooltipOnce,
      showTooltipSequence,
    ],
  );

  return (
    <TooltipContext.Provider value={contextValue}>
      <View style={{flex: 1}}>
        {children}
        {activeRequest ? (
          <TooltipOverlay
            visible={isTooltipVisible}
            targetRect={targetRect}
            highlightElement={activeRequest.highlightElement}
            cutoutTarget={activeRequest.id === "submitAnswer"}
            content={activeRequest.content}
            preferredPlacement={activeRequest.preferredPlacement}
            useNativeModal={activeRequest.id !== "submitAnswer"}
            showBackdrop={activeRequest.id !== "submitAnswer"}
            onDismiss={() => dismissTooltip(activeRequest.id)}
            onExited={() => {
              logger.debug("[TooltipContext] tooltip exited", {
                id: activeRequest.id,
              });
              const nextRequest = sequenceQueueRef.current.shift();
              setActiveRequest(null);
              setTargetRect(null);
              if (nextRequest) {
                void activateTooltip(nextRequest);
              }
            }}
          />
        ) : null}
      </View>
    </TooltipContext.Provider>
  );
};

export const useTooltip = (): TooltipContextValue => {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error("useTooltip must be used within a TooltipProvider");
  }

  return context;
};
