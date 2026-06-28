import React, {useEffect, useRef, useState} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import ChestClosedSvg from "../../../assets/images/chest-closed.svg";
import ChestOpenSvg from "../../../assets/images/chest-open.svg";
import CoinSvg from "../../../assets/images/coin.svg";
import {TYPOGRAPHY} from "../../styles";
import {useRewardAnimation} from "../../contexts/RewardAnimationContext";

export interface RewardChestProps {
  rewardAmount: number;
  testID?: string;
  onOpened?: () => void;
}

export interface RewardChestPreset {
  width: number;
  height: number;
  baseHeight: number;
  lidHeight: number;
  coinSize: number;
  particleCount: number;
  showAmount: boolean;
  staggerMs: number;
  flightDurationMs: number;
}

export interface RewardChestViewProps extends RewardChestProps {
  preset: RewardChestPreset;
  variant: "modal" | "achievement";
}

export interface RewardChestHandle {
  play: () => Promise<void>;
}

interface CoinParticle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  spreadX: number;
  lift: number;
}

export const REWARD_CHEST_COIN_COUNT = 5;
const OPEN_CHEST_LEAD_IN_MS = 80;

const measureView = async (
  view: View | null,
): Promise<{x: number; y: number; width: number; height: number} | null> => {
  if (!view || typeof view.measureInWindow !== "function") {
    return null;
  }

  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => resolve({x, y, width, height}));
  });
};

const splitRewardAmount = (amount: number, coinCount: number): number[] => {
  if (!Number.isFinite(amount) || amount <= 0 || coinCount <= 0) {
    return Array.from({length: Math.max(0, coinCount)}, () => 0);
  }

  if (!Number.isInteger(amount)) {
    return Array.from({length: coinCount}, () => amount / coinCount);
  }

  const baseCoinValue = Math.floor(amount / coinCount);
  const remainder = amount - baseCoinValue * coinCount;
  return Array.from({length: coinCount}, (_, index) => baseCoinValue + (index < remainder ? 1 : 0));
};

const RewardChestView = React.forwardRef<RewardChestHandle, RewardChestViewProps>(
  ({rewardAmount, preset, variant, testID, onOpened}, ref) => {
  const {measureCoinTarget, notifyCoinCounterHit} = useRewardAnimation();
  const sourceRef = useRef<View>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [openProgress] = useState(() => new Animated.Value(0));
  const [chestScale] = useState(() => new Animated.Value(1));
  const [chestWobble] = useState(() => new Animated.Value(0));
  const isOpenedRef = useRef(false);
  const animationPromiseRef = useRef<Promise<void> | null>(null);
  const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [particles] = useState<CoinParticle[]>(() =>
    Array.from({length: REWARD_CHEST_COIN_COUNT}, (_, index) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.45),
      spreadX: ((index % 2 === 0 ? 1 : -1) * (index + 1) * preset.width) / (REWARD_CHEST_COIN_COUNT * 2.2),
      lift: 24 + ((index * 17) % 28),
    })),
  );

  const amountLabel = `${rewardAmount >= 0 ? "+" : ""}${rewardAmount}`;
  const glowOpacity = openProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.12, 0.82, 0.32],
  });
  const wobbleRotation = chestWobble.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-4deg", "0deg", "4deg"],
  });
  const wobbleTranslateX = chestWobble.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-3, 0, 3],
  });

  const clearAnimationTimeouts = () => {
    animationTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    animationTimeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAnimationTimeouts();
    };
  }, []);

  useEffect(() => {
    chestWobble.stopAnimation();
    chestWobble.setValue(0);

    if (rewardAmount <= 0 || isOpened || process.env.NODE_ENV === "test") {
      return undefined;
    }

    const wobbleAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(chestWobble, {
          toValue: 1,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chestWobble, {
          toValue: -1,
          duration: 120,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chestWobble, {
          toValue: 0,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    wobbleAnimation.start();

    return () => {
      wobbleAnimation.stop();
      chestWobble.stopAnimation();
      chestWobble.setValue(0);
    };
  }, [chestWobble, isOpened, rewardAmount]);

  const playRewardAnimation = (event?: GestureResponderEvent): Promise<void> => {
    event?.stopPropagation?.();
    if (animationPromiseRef.current) {
      return animationPromiseRef.current;
    }

    if (isOpenedRef.current || rewardAmount <= 0) {
      return Promise.resolve();
    }

    isOpenedRef.current = true;
    setIsOpened(true);
    openProgress.stopAnimation();
    openProgress.setValue(1);
    clearAnimationTimeouts();

    const animationPromise = (async () => {
      const [source, measuredTarget] = await Promise.all([measureView(sourceRef.current), measureCoinTarget()]);
      const screenWidth = Dimensions.get("window").width;
      const target = measuredTarget ?? {x: screenWidth - 36, y: 24, width: 24, height: 24};
      const sourceCenter = source
        ? {x: source.x + source.width / 2, y: source.y + source.height / 2}
        : {x: screenWidth / 2, y: 360};
      const targetX = target.x + target.width / 2 - sourceCenter.x;
      const targetY = target.y + target.height / 2 - sourceCenter.y;
      const coinValues = splitRewardAmount(rewardAmount, REWARD_CHEST_COIN_COUNT);
      const particleFlightMs = 180 + preset.flightDurationMs;
      const totalFlightMs =
        OPEN_CHEST_LEAD_IN_MS + (REWARD_CHEST_COIN_COUNT - 1) * preset.staggerMs + particleFlightMs + 180;

      particles.forEach((particle) => {
        particle.x.setValue(0);
        particle.y.setValue(0);
        particle.opacity.setValue(0);
        particle.scale.setValue(0.45);
      });

      if (process.env.NODE_ENV === "test") {
        coinValues.forEach((coinValue) => notifyCoinCounterHit(coinValue));
        onOpened?.();
        return;
      }

      Animated.sequence([
        Animated.timing(chestScale, {
          toValue: 0.92,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(chestScale, {
          toValue: 1.08,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.spring(chestScale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();

      particles.forEach((particle, index) => {
        const startTimeoutId = setTimeout(() => {
          Animated.parallel([
            Animated.sequence([
              Animated.timing(particle.x, {
                toValue: particle.spreadX,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(particle.x, {
                toValue: targetX,
                duration: preset.flightDurationMs,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(particle.y, {
                toValue: -particle.lift,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(particle.y, {
                toValue: targetY,
                duration: preset.flightDurationMs,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(particle.opacity, {
                toValue: 1,
                duration: 80,
                useNativeDriver: true,
              }),
              Animated.delay(Math.max(0, particleFlightMs - 80)),
              Animated.timing(particle.opacity, {
                toValue: 0,
                duration: 120,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.spring(particle.scale, {
                toValue: 1,
                friction: 5,
                tension: 130,
                useNativeDriver: true,
              }),
              Animated.timing(particle.scale, {
                toValue: 0.62,
                duration: preset.flightDurationMs,
                useNativeDriver: true,
              }),
            ]),
          ]).start();

          const landTimeoutId = setTimeout(() => {
            notifyCoinCounterHit(coinValues[index]);
          }, particleFlightMs);
          animationTimeoutsRef.current.push(landTimeoutId);
        }, OPEN_CHEST_LEAD_IN_MS + index * preset.staggerMs);

        animationTimeoutsRef.current.push(startTimeoutId);
      });

      await new Promise<void>((resolve) => {
        const doneTimeoutId = setTimeout(resolve, totalFlightMs);
        animationTimeoutsRef.current.push(doneTimeoutId);
      });

      clearAnimationTimeouts();
      onOpened?.();
    })();

    animationPromiseRef.current = animationPromise;
    void animationPromise.finally(() => {
      animationPromiseRef.current = null;
    });

    return animationPromise;
  };

  React.useImperativeHandle(ref, () => ({play: playRewardAnimation}));

  const chestSize = preset.width * 0.9;

  return (
    <Pressable
      ref={sourceRef}
      onPress={(event) => {
        void playRewardAnimation(event);
      }}
      disabled={isOpened || rewardAmount <= 0}
      accessibilityRole="button"
      accessibilityState={{disabled: isOpened || rewardAmount <= 0}}
      accessibilityLabel={amountLabel}
      testID={testID ?? `reward-chest-${variant}`}
      style={({pressed}) => ({
        width: preset.width,
        height: preset.height,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: pressed && !isOpened ? 0.88 : 1,
      })}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: preset.height * 0.08,
          width: preset.width * 0.78,
          height: preset.width * 0.78,
          borderRadius: preset.width,
          backgroundColor: "#FFD85A",
          opacity: glowOpacity,
          transform: [{scale: chestScale}],
        }}
      />

      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            zIndex: 20,
            top: preset.height * 0.35,
            left: preset.width / 2 - preset.coinSize / 2,
            opacity: particle.opacity,
            transform: [{translateX: particle.x}, {translateY: particle.y}, {scale: particle.scale}],
          }}
        >
          <CoinSvg width={preset.coinSize} height={preset.coinSize} />
        </Animated.View>
      ))}

      <Animated.View
        style={{
          width: chestSize,
          height: chestSize,
          marginTop: preset.height * 0.04,
          alignItems: "center",
          justifyContent: "center",
          transform: [{translateX: wobbleTranslateX}, {rotate: wobbleRotation}, {scale: chestScale}],
        }}
      >
        {isOpened ? (
          <ChestOpenSvg width={chestSize} height={chestSize} />
        ) : (
          <ChestClosedSvg width={chestSize} height={chestSize} />
        )}
      </Animated.View>

      {preset.showAmount ? (
        <Text
          style={{
            marginTop: 3,
            color: "#FB9A2B",
            fontFamily: TYPOGRAPHY.fontSecondaryBold,
            fontSize: TYPOGRAPHY.fontSize["2xl"],
          }}
          testID={`${testID ?? `reward-chest-${variant}`}-amount`}
        >
          {amountLabel}
        </Text>
      ) : null}
    </Pressable>
  );
});

RewardChestView.displayName = "RewardChestView";

export default RewardChestView;
