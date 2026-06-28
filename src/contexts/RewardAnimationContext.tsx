import React, {createContext, useCallback, useContext, useMemo, useRef} from "react";
import type {View} from "react-native";

export interface RewardTargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RewardAnimationContextValue {
  registerCoinTarget: (target: View | null) => void;
  registerCoinCounterAnimator: (animator: ((coinValue: number) => void) | null) => void;
  measureCoinTarget: () => Promise<RewardTargetLayout | null>;
  notifyCoinCounterHit: (coinValue: number) => void;
}

const RewardAnimationContext = createContext<RewardAnimationContextValue>({
  registerCoinTarget: () => {},
  registerCoinCounterAnimator: () => {},
  measureCoinTarget: async () => null,
  notifyCoinCounterHit: () => {},
});

export const RewardAnimationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const coinTargetRef = useRef<View | null>(null);
  const coinCounterAnimatorRef = useRef<((coinValue: number) => void) | null>(null);

  const registerCoinTarget = useCallback((target: View | null) => {
    coinTargetRef.current = target;
  }, []);

  const registerCoinCounterAnimator = useCallback((animator: ((coinValue: number) => void) | null) => {
    coinCounterAnimatorRef.current = animator;
  }, []);

  const measureCoinTarget = useCallback(async (): Promise<RewardTargetLayout | null> => {
    const target = coinTargetRef.current;
    if (!target || typeof target.measureInWindow !== "function") {
      return null;
    }

    return new Promise((resolve) => {
      target.measureInWindow((x, y, width, height) => {
        resolve({x, y, width, height});
      });
    });
  }, []);

  const notifyCoinCounterHit = useCallback((coinValue: number) => {
    coinCounterAnimatorRef.current?.(coinValue);
  }, []);

  const value = useMemo(
    () => ({registerCoinTarget, registerCoinCounterAnimator, measureCoinTarget, notifyCoinCounterHit}),
    [measureCoinTarget, notifyCoinCounterHit, registerCoinCounterAnimator, registerCoinTarget],
  );

  return <RewardAnimationContext.Provider value={value}>{children}</RewardAnimationContext.Provider>;
};

export const useRewardAnimation = (): RewardAnimationContextValue => useContext(RewardAnimationContext);
