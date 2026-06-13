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
  measureCoinTarget: () => Promise<RewardTargetLayout | null>;
}

const RewardAnimationContext = createContext<RewardAnimationContextValue>({
  registerCoinTarget: () => {},
  measureCoinTarget: async () => null,
});

export const RewardAnimationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const coinTargetRef = useRef<View | null>(null);

  const registerCoinTarget = useCallback((target: View | null) => {
    coinTargetRef.current = target;
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

  const value = useMemo(
    () => ({registerCoinTarget, measureCoinTarget}),
    [measureCoinTarget, registerCoinTarget],
  );

  return <RewardAnimationContext.Provider value={value}>{children}</RewardAnimationContext.Provider>;
};

export const useRewardAnimation = (): RewardAnimationContextValue => useContext(RewardAnimationContext);
