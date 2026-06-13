import React, {useRef, useState} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Pressable,
  Text,
  View,
} from "react-native";
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

interface CoinParticle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  spreadX: number;
  lift: number;
}

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

const RewardChestView: React.FC<RewardChestViewProps> = ({
  rewardAmount,
  preset,
  variant,
  testID,
  onOpened,
}) => {
  const {measureCoinTarget} = useRewardAnimation();
  const sourceRef = useRef<View>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [openProgress] = useState(() => new Animated.Value(0));
  const [chestScale] = useState(() => new Animated.Value(1));
  const [particles] = useState<CoinParticle[]>(() =>
    Array.from({length: preset.particleCount}, (_, index) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.45),
      spreadX: ((index % 2 === 0 ? 1 : -1) * (index + 1) * preset.width) / (preset.particleCount * 2.2),
      lift: 24 + ((index * 17) % 28),
    })),
  );

  const amountLabel = `${rewardAmount >= 0 ? "+" : ""}${rewardAmount}`;
  const lidRotation = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-24deg"],
  });
  const glowOpacity = openProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.12, 0.82, 0.32],
  });

  const handlePress = async (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    if (isOpened || rewardAmount <= 0) {
      return;
    }

    setIsOpened(true);
    const [source, measuredTarget] = await Promise.all([measureView(sourceRef.current), measureCoinTarget()]);
    const screenWidth = Dimensions.get("window").width;
    const target = measuredTarget ?? {x: screenWidth - 36, y: 24, width: 24, height: 24};
    const sourceCenter = source
      ? {x: source.x + source.width / 2, y: source.y + source.height / 2}
      : {x: screenWidth / 2, y: 360};
    const targetX = target.x + target.width / 2 - sourceCenter.x;
    const targetY = target.y + target.height / 2 - sourceCenter.y;

    Animated.parallel([
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
      ]),
      Animated.timing(openProgress, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    const particleAnimations = particles.map((particle) => {
      particle.x.setValue(0);
      particle.y.setValue(0);
      particle.opacity.setValue(0);
      particle.scale.setValue(0.45);

      return Animated.parallel([
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
          Animated.delay(Math.max(100, preset.flightDurationMs - 140)),
          Animated.timing(particle.opacity, {
            toValue: 0,
            duration: 240,
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
      ]);
    });

    Animated.stagger(preset.staggerMs, particleAnimations).start(({finished}) => {
      if (finished) {
        onOpened?.();
      }
    });
  };

  const chestWidth = preset.width * 0.78;
  const borderWidth = Math.max(2, preset.width * 0.025);

  return (
    <Pressable
      ref={sourceRef}
      onPress={(event) => {
        void handlePress(event);
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
          width: chestWidth,
          height: preset.baseHeight + preset.lidHeight,
          marginTop: preset.height * 0.12,
          alignItems: "center",
          justifyContent: "flex-end",
          transform: [{scale: chestScale}],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            height: preset.baseHeight,
            borderRadius: Math.max(6, preset.width * 0.08),
            borderWidth,
            borderColor: "#713810",
            backgroundColor: "#B95D1D",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: "8%",
              right: "8%",
              top: "18%",
              bottom: "16%",
              borderRadius: Math.max(4, preset.width * 0.04),
              backgroundColor: "#D87824",
              borderWidth: 1,
              borderColor: "#8A4314",
            }}
          />
          <View
            style={{
              position: "absolute",
              zIndex: 3,
              top: -1,
              left: "41%",
              width: "18%",
              height: "48%",
              borderBottomLeftRadius: 5,
              borderBottomRightRadius: 5,
              backgroundColor: "#FFD253",
              borderWidth: 1,
              borderColor: "#9D6512",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: Math.max(2, preset.width * 0.025),
                height: Math.max(5, preset.height * 0.07),
                borderRadius: 3,
                backgroundColor: "#6E4214",
              }}
            />
          </View>
        </View>

        <Animated.View
          style={{
            position: "absolute",
            zIndex: 4,
            top: 0,
            width: "104%",
            height: preset.lidHeight,
            borderTopLeftRadius: preset.width * 0.18,
            borderTopRightRadius: preset.width * 0.18,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            borderWidth,
            borderColor: "#713810",
            backgroundColor: "#C86A20",
            overflow: "hidden",
            transform: [
              {
                translateY: openProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -preset.lidHeight * 0.65],
                }),
              },
              {rotate: lidRotation},
            ],
          }}
        >
          <View
            style={{
              position: "absolute",
              left: "42%",
              width: "16%",
              height: "100%",
              backgroundColor: "#FFD253",
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: "#9D6512",
            }}
          />
        </Animated.View>
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
};

export default RewardChestView;
