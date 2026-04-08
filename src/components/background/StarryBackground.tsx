/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";
import { COLORS } from "../../styles";
import { dimensions } from "../../utils/responsive";
import SolarSystem3D from "./SolarSystem3D";

const { screenWidth: SCREEN_WIDTH, screenHeight: SCREEN_HEIGHT } = dimensions;

const STAR_COUNT = 80;
const SHOOTING_STAR_COUNT = 4;

// ─── Star types ──────────────────────────────────────────────────────────────

interface Star {
  id: number;
  initialX: number;
  initialY: number;
  size: number;
  opacity: number;
  color: string;
  animationDuration: number;
  animationDelay: number;
}

interface ShootingStarConfig {
  id: number;
  startX: number;
  startY: number;
  length: number;
  /** Travel direction in degrees (0 = right, 90 = down) */
  angle: number;
  /** Total travel distance in pixels */
  distance: number;
  /** Duration of one shot in ms */
  duration: number;
  /** Initial delay before first shot in ms */
  delay: number;
  /** Wait time between shots in ms */
  repeatInterval: number;
}

// ─── AnimatedStar ─────────────────────────────────────────────────────────────

const AnimatedStar: React.FC<{ star: Star }> = React.memo(({ star }) => {
  const opacity = useSharedValue(star.opacity);
  const scale = useSharedValue(1);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(star.opacity * 0.35, {
            duration: 4000 + Math.random() * 4000,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 4000 + Math.random() * 4000,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );

      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, {
            duration: 6000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.9, {
            duration: 6000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    }, star.animationDelay);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [star, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const staticStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: star.initialX,
      top: star.initialY,
      width: star.size,
      height: star.size,
      borderRadius: star.size / 2,
      backgroundColor: star.color,
      shadowColor: star.color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: star.size * 3,
      elevation: 6,
    }),
    [star]
  );

  return <Animated.View style={[styles.star, staticStyle, animatedStyle]} />;
});

AnimatedStar.displayName = "AnimatedStar";

// ─── ShootingStar ─────────────────────────────────────────────────────────────

const ShootingStar: React.FC<{ config: ShootingStarConfig }> = React.memo(
  ({ config }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    const angleRad = (config.angle * Math.PI) / 180;
    const dx = Math.cos(angleRad) * config.distance;
    const dy = Math.sin(angleRad) * config.distance;

    useEffect(() => {
      const { duration, repeatInterval } = config;

      const timeoutId = setTimeout(() => {
        translateX.value = withRepeat(
          withSequence(
            withTiming(dx, { duration, easing: Easing.linear }),
            withTiming(0, { duration: 1 }),
            withTiming(0, { duration: repeatInterval })
          ),
          -1,
          false
        );

        translateY.value = withRepeat(
          withSequence(
            withTiming(dy, { duration, easing: Easing.linear }),
            withTiming(0, { duration: 1 }),
            withTiming(0, { duration: repeatInterval })
          ),
          -1,
          false
        );

        // Fade in fast, hold, fade out
        opacity.value = withRepeat(
          withSequence(
            withTiming(1, {
              duration: duration * 0.1,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(0.85, { duration: duration * 0.6, easing: Easing.linear }),
            withTiming(0, {
              duration: duration * 0.3,
              easing: Easing.in(Easing.quad),
            }),
            withTiming(0, { duration: repeatInterval + 1 })
          ),
          -1,
          false
        );
      }, config.delay);

      return () => {
        clearTimeout(timeoutId);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(opacity);
      };
    }, [config, translateX, translateY, opacity, dx, dy]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${config.angle}deg` },
      ],
      opacity: opacity.value,
    }));

    // SVG dimensions: trail length + 4px for the head dot overflow
    const svgWidth = config.length + 4;
    const svgHeight = 5;
    const cy = svgHeight / 2;

    return (
      <Animated.View
        style={[{ position: "absolute" as const, left: config.startX, top: config.startY - cy },
          animatedStyle,
        ]}
      >
        <Svg width={svgWidth} height={svgHeight}>
          <Defs>
            {/* Gradient: fully transparent tail (left) → opaque head (right) */}
            <LinearGradient id={`sg${config.id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0"    stopColor="white" stopOpacity={0} />
              <Stop offset="0.5"  stopColor="white" stopOpacity={0.05} />
              <Stop offset="0.82" stopColor="white" stopOpacity={0.5} />
              <Stop offset="1"    stopColor="white" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {/* Thin gradient trail — 1px tall */}
          <Rect
            x={0}
            y={cy - 0.5}
            width={config.length}
            height={1}
            rx={0.5}
            fill={`url(#sg${config.id})`}
          />
          {/* Bright head dot */}
          <Circle cx={config.length + 1.5} cy={cy} r={1.5} fill="white" fillOpacity={1} />
        </Svg>
      </Animated.View>
    );
  }
);

ShootingStar.displayName = "ShootingStar";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.black,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
  solarSystemContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  star: {
    backgroundColor: COLORS.white,
    elevation: 6,
    position: "absolute",
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
  },
  starsContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
});

// ─── StarryBackground ─────────────────────────────────────────────────────────

const StarryBackground: React.FC = () => {
  const [stars] = useState<Star[]>(() => {
    const generatedStars: Star[] = [];
    const starColors = [
      "#FFFFFF", // Pure white
      "#FFFFFF", // Pure white (weighted)
      "#FFD700", // Gold
      "#FFF8DC", // Cornsilk
      "#FFFFE0", // Light yellow
      "#E8F4FF", // Ice blue-white
      "#FFE135", // Bright yellow
    ];

    for (let i = 0; i < STAR_COUNT; i++) {
      generatedStars.push({
        id: i,
        initialX: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 2.5 + 1.5, // 1.5–4px
        opacity: Math.random() * 0.25 + 0.75, // 0.75–1.0
        color: starColors[Math.floor(Math.random() * starColors.length)],
        animationDuration: Math.random() * 15000 + 20000,
        animationDelay: Math.random() * 10000,
      });
    }

    return generatedStars;
  });

  const [shootingStars] = useState<ShootingStarConfig[]>(() => {
    const configs: ShootingStarConfig[] = [];
    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      // Angles 120–160 degrees: shooting downward to the right
      const angle = 120 + Math.random() * 40;
      configs.push({
        id: i,
        startX: Math.random() * SCREEN_WIDTH * 0.7,
        startY: Math.random() * SCREEN_HEIGHT * 0.35,
        length: 18 + Math.random() * 16, // 18–34px — short, realistic tail
        angle,
        distance: 160 + Math.random() * 120, // 160–280px
        duration: 2800 + Math.random() * 1800, // 2.8–4.6s — slow, realistic drift
        delay: i * 3000 + Math.random() * 1500, // staggered starts
        repeatInterval: 5000 + Math.random() * 9000, // 5–14s between shots
      });
    }
    return configs;
  });

  const starComponents = useMemo(
    () => stars.map((star) => <AnimatedStar key={star.id} star={star} />),
    [stars]
  );

  const shootingStarComponents = useMemo(
    () =>
      shootingStars.map((config) => (
        <ShootingStar key={config.id} config={config} />
      )),
    [shootingStars]
  );

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {starComponents}
        {shootingStarComponents}
      </View>

      <View style={styles.solarSystemContainer}>
        <SolarSystem3D />
      </View>
    </View>
  );
};

export default React.memo(StarryBackground);
