import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {View} from "react-native";
import type {
  TooltipId,
  TooltipRequest,
  TargetRect,
  TooltipSequenceOptions,
  TooltipSequenceRequest,
} from "../components/tooltips/types";
import TooltipOverlay from "../components/tooltips/TooltipOverlay";
import {
  hasSeenTooltip,
  hasSeenTooltipSequence,
  markTooltipSeen,
  markTooltipSequenceSeen,
} from "../components/tooltips/tooltipStorage";
import {DEV_SHOW_TIPS} from "../constants/tooltips";
import {logger} from "../utils/logger";

interface TooltipContextValue {
  activeTooltipId: TooltipId | null;
  activeTooltipSequenceId: string | null;
  isTooltipSequenceActive: boolean;
  showTooltip: (request: TooltipRequest) => Promise<void>;
  showTooltipOnce: (request: TooltipRequest) => Promise<boolean>;
  showTooltipSequence: (requests: TooltipSequenceRequest[], options?: TooltipSequenceOptions) => Promise<boolean>;
  cancelTooltipSequence: () => void;
  dismissTooltip: (id?: TooltipId) => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

const TARGET_MEASURE_RETRY_COUNT = 6;

const usesOriginalTargetSpotlight = (id: TooltipId): boolean =>
  id === "gameCoins" ||
  id === "gameHint" ||
  id === "gameSkip" ||
  id === "profileProgression" ||
  id === "profileCoins";

const shouldCheckIndividualTooltipSeenState = (options?: TooltipSequenceOptions): boolean => !options?.sequenceId;

const waitForNextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const isValidTargetRect = (x: number, y: number, width: number, height: number): boolean =>
  [x, y, width, height].every((value) => Number.isFinite(value)) && x >= 0 && y >= 0 && width > 0 && height > 0;

const applyTargetOffset = (targetRect: TargetRect | null, request: TooltipRequest): TargetRect | null => {
  const targetOffsetY =
    typeof request.targetOffsetY === "number" && Number.isFinite(request.targetOffsetY) ? request.targetOffsetY : 0;
  if (!targetRect || targetOffsetY === 0) {
    return targetRect;
  }

  return {
    ...targetRect,
    y: Math.max(0, targetRect.y + targetOffsetY),
  };
};

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
  const [activeTooltipSequenceId, setActiveTooltipSequenceId] = useState<string | null>(null);
  const [isTooltipSequenceActive, setIsTooltipSequenceActive] = useState(false);
  const sequenceQueueRef = useRef<TooltipSequenceRequest[]>([]);
  const activeRequestRef = useRef<TooltipRequest | null>(null);
  const isTooltipVisibleRef = useRef(false);
  const isSequenceRunningRef = useRef(false);
  const activeSequenceRef = useRef<TooltipSequenceOptions | null>(null);

  useEffect(() => {
    if (DEV_SHOW_TIPS) {
      logger.info("[TooltipContext] DEV_SHOW_TIPS enabled; one-off tooltip seen state will not suppress tips.");
    }
  }, []);

  const activateTooltip = useCallback(async (request: TooltipRequest): Promise<boolean> => {
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
      const adjustedTarget = applyTargetOffset(measuredTarget, request);
      logger.debug("[TooltipContext] activating tooltip", {
        id: request.id,
        measuredTarget,
        adjustedTarget,
      });
      setTargetRect(adjustedTarget);
      activeRequestRef.current = request;
      isTooltipVisibleRef.current = true;
      setActiveRequest(request);
      setIsTooltipVisible(true);
      return true;
    } catch (err) {
      logger.warn("showTooltip failed", err);
      return false;
    }
  }, []);

  const showTooltip = useCallback(
    async (request: TooltipRequest): Promise<void> => {
      isSequenceRunningRef.current = false;
      activeSequenceRef.current = null;
      sequenceQueueRef.current = [];
      setActiveTooltipSequenceId(null);
      setIsTooltipSequenceActive(false);
      await activateTooltip(request);
    },
    [activateTooltip],
  );

  const showTooltipSequence = useCallback(
    async (requests: TooltipSequenceRequest[], options?: TooltipSequenceOptions): Promise<boolean> => {
      if (
        isSequenceRunningRef.current ||
        isTooltipVisibleRef.current ||
        activeRequestRef.current ||
        sequenceQueueRef.current.length > 0
      ) {
        logger.debug("[TooltipContext] showTooltipSequence ignored because another tooltip flow is active", {
          activeTooltipId: activeRequestRef.current?.id ?? null,
          queuedCount: sequenceQueueRef.current.length,
          isSequenceRunning: isSequenceRunningRef.current,
          isTooltipVisible: isTooltipVisibleRef.current,
        });
        return false;
      }

      isSequenceRunningRef.current = true;
      try {
        if (options?.sequenceId) {
          const seenSequence = await hasSeenTooltipSequence(options.sequenceId, options.userId);
          logger.debug("[TooltipContext] showTooltipSequence sequence check", {
            sequenceId: options.sequenceId,
            seen: seenSequence,
            userId: options.userId ?? null,
          });
          if (seenSequence) {
            sequenceQueueRef.current = [];
            isSequenceRunningRef.current = false;
            activeSequenceRef.current = null;
            setActiveTooltipSequenceId(null);
            setIsTooltipSequenceActive(false);
            return false;
          }
        }

        const unseenRequests = shouldCheckIndividualTooltipSeenState(options)
          ? []
          : requests;
        if (shouldCheckIndividualTooltipSeenState(options)) {
          for (const request of requests) {
            const seen = await hasSeenTooltip(request.id, request.userId);
            logger.debug("[TooltipContext] showTooltipSequence check", {
              id: request.id,
              seen,
              devShowTips: DEV_SHOW_TIPS,
              userId: request.userId ?? null,
            });
            if (!seen) {
              unseenRequests.push(request);
            }
          }
        }

        const [firstRequest, ...remainingRequests] = unseenRequests;
        if (!firstRequest) {
          sequenceQueueRef.current = [];
          isSequenceRunningRef.current = false;
          activeSequenceRef.current = null;
          setActiveTooltipSequenceId(null);
          setIsTooltipSequenceActive(false);
          return false;
        }

        sequenceQueueRef.current = remainingRequests;
        activeSequenceRef.current = options?.sequenceId ? options : null;
        setActiveTooltipSequenceId(options?.sequenceId ?? null);
        setIsTooltipSequenceActive(true);
        const activated = await activateTooltip(firstRequest);
        if (!activated) {
          sequenceQueueRef.current = [];
          isSequenceRunningRef.current = false;
          activeSequenceRef.current = null;
          setActiveTooltipSequenceId(null);
          setIsTooltipSequenceActive(false);
        }
        return activated;
      } catch (err) {
        sequenceQueueRef.current = [];
        isSequenceRunningRef.current = false;
        activeSequenceRef.current = null;
        setActiveTooltipSequenceId(null);
        setIsTooltipSequenceActive(false);
        logger.warn("showTooltipSequence failed", err);
        return false;
      }
    },
    [activateTooltip],
  );

  const cancelTooltipSequence = useCallback(() => {
    sequenceQueueRef.current = [];
    isSequenceRunningRef.current = false;
    activeSequenceRef.current = null;
    activeRequestRef.current = null;
    isTooltipVisibleRef.current = false;
    setActiveTooltipSequenceId(null);
    setIsTooltipSequenceActive(false);
    setActiveRequest(null);
    setTargetRect(null);
    setIsTooltipVisible(false);
  }, []);

  const completeActiveTooltip = useCallback(
    (completedRequestId?: TooltipId) => {
      const currentRequest = activeRequestRef.current;
      if (completedRequestId && currentRequest && currentRequest.id !== completedRequestId) {
        logger.debug("[TooltipContext] ignoring stale tooltip exit", {
          completedRequestId,
          activeTooltipId: currentRequest.id,
        });
        return;
      }

      const nextRequest = sequenceQueueRef.current.shift();
      activeRequestRef.current = null;
      isTooltipVisibleRef.current = false;
      setActiveRequest(null);
      setTargetRect(null);
      setIsTooltipVisible(false);

      if (nextRequest) {
        void activateTooltip(nextRequest).then((activated) => {
          if (!activated) {
            sequenceQueueRef.current = [];
            isSequenceRunningRef.current = false;
            activeSequenceRef.current = null;
            setActiveTooltipSequenceId(null);
            setIsTooltipSequenceActive(false);
          }
        });
        return;
      }

      if (activeSequenceRef.current?.sequenceId) {
        const {sequenceId, userId} = activeSequenceRef.current;
        void Promise.resolve(markTooltipSequenceSeen(sequenceId, userId)).catch((err) => {
          logger.warn("markTooltipSequenceSeen failed", err);
        });
      }
      activeSequenceRef.current = null;
      isSequenceRunningRef.current = false;
      setActiveTooltipSequenceId(null);
      setIsTooltipSequenceActive(false);
    },
    [activateTooltip],
  );

  const dismissTooltip = useCallback(
    (id?: TooltipId) => {
      logger.debug("[TooltipContext] dismissTooltip requested", {
        requestedId: id ?? null,
        activeTooltipId: activeRequest?.id ?? null,
      });
      const currentActiveRequest = activeRequestRef.current ?? activeRequest;
      if (id && currentActiveRequest?.id !== id) {
        logger.debug("[TooltipContext] dismiss ignored due to id mismatch", {
          requestedId: id,
          activeTooltipId: currentActiveRequest?.id ?? null,
        });
        return;
      }

      if (currentActiveRequest && !currentActiveRequest.persist) {
        void Promise.resolve(markTooltipSeen(currentActiveRequest.id, currentActiveRequest.userId)).catch((err) => {
          logger.warn("markTooltipSeen failed", err);
        });
      }

      if (!(currentActiveRequest?.useNativeModal ?? currentActiveRequest?.id !== "submitAnswer")) {
        completeActiveTooltip(currentActiveRequest?.id);
        return;
      }

      isTooltipVisibleRef.current = false;
      setIsTooltipVisible(false);
    },
    [activeRequest, completeActiveTooltip],
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
      activeTooltipSequenceId,
      isTooltipSequenceActive,
      showTooltip,
      showTooltipOnce,
      showTooltipSequence,
      cancelTooltipSequence,
      dismissTooltip,
    }),
    [
      activeRequest?.id,
      activeTooltipSequenceId,
      cancelTooltipSequence,
      dismissTooltip,
      isTooltipSequenceActive,
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
            cutoutTarget={usesOriginalTargetSpotlight(activeRequest.id)}
            content={activeRequest.content}
            preferredPlacement={activeRequest.preferredPlacement}
            useNativeModal={activeRequest.useNativeModal ?? true}
            showBackdrop={activeRequest.showBackdrop ?? true}
            onDismiss={() => dismissTooltip(activeRequest.id)}
            onExited={() => {
              logger.debug("[TooltipContext] tooltip exited", {
                id: activeRequest.id,
              });
              completeActiveTooltip(activeRequest.id);
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
