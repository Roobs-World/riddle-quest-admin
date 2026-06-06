import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {View} from "react-native";
import type {TooltipId, TooltipRequest, TargetRect} from "../components/tooltips/types";
import TooltipOverlay from "../components/tooltips/TooltipOverlay";
import {hasSeenTooltip, markTooltipSeen} from "../components/tooltips/tooltipStorage";
import {DEV_SHOW_TIPS} from "../constants/tooltips";
import {logger} from "../utils/logger";

interface TooltipContextValue {
  activeTooltipId: TooltipId | null;
  showTooltip: (request: TooltipRequest) => Promise<void>;
  showTooltipOnce: (request: TooltipRequest) => Promise<boolean>;
  dismissTooltip: (id?: TooltipId) => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

const measureTarget = (request: TooltipRequest): Promise<TargetRect | null> => {
  const target = request.targetRef?.current;
  if (!target || typeof target.measureInWindow !== "function") {
    logger.debug("[TooltipContext] target missing or not measurable", {
      id: request.id,
      hasTarget: Boolean(target),
      hasMeasureInWindow: typeof target?.measureInWindow === "function",
    });
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

      if ([x, y, width, height].every((value) => Number.isFinite(value))) {
        resolve({x, y, width, height});
        return;
      }

      logger.warn("[TooltipContext] invalid target measurement", {
        id: request.id,
        x,
        y,
        width,
        height,
      });
      resolve(null);
    });
  });
};

export const TooltipProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [activeRequest, setActiveRequest] = useState<TooltipRequest | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (DEV_SHOW_TIPS) {
      logger.info("[TooltipContext] DEV_SHOW_TIPS enabled; tooltip seen state will not suppress tips.");
    }
  }, []);

  const showTooltip = useCallback(async (request: TooltipRequest): Promise<void> => {
    try {
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
      dismissTooltip,
    }),
    [activeRequest?.id, dismissTooltip, isTooltipVisible, showTooltip, showTooltipOnce],
  );

  return (
    <TooltipContext.Provider value={contextValue}>
      <View style={{flex: 1}}>
        {children}
        {activeRequest ? (
          <TooltipOverlay
            visible={isTooltipVisible}
            targetRect={targetRect}
            content={activeRequest.content}
            onDismiss={() => dismissTooltip(activeRequest.id)}
            onExited={() => {
              logger.debug("[TooltipContext] tooltip exited", {
                id: activeRequest.id,
              });
              setActiveRequest(null);
              setTargetRect(null);
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
