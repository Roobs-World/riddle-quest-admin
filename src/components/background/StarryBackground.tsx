/* eslint-disable react/prop-types */
import React, {useEffect, useMemo, useState} from "react";
import {View, StyleSheet} from "react-native";
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, {Defs, LinearGradient, Stop, Rect, Circle} from "react-native-svg";
import {COLORS} from "../../styles";
import {dimensions} from "../../utils/responsive";
import SolarSystem3D from "./SolarSystem3D";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";

const {screenWidth: SCREEN_WIDTH, screenHeight: SCREEN_HEIGHT} = dimensions;

const STAR_COUNT = 80;
const SHOOTING_STAR_COUNT = 4;
export const __STAR_COUNT_FOR_TESTS = STAR_COUNT;
export const __SHOOTING_STAR_COUNT_FOR_TESTS = SHOOTING_STAR_COUNT;

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
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  repeatInterval: number;
}

export const __generateStarsForTests = (
  screenWidth: number,
  screenHeight: number,
  count: number = STAR_COUNT,
): Star[] => {
  const generatedStars: Star[] = [];
  const starColors = ["#FFFFFF", "#FFFFFF", "#FFD700", "#FFF8DC", "#FFFFE0", "#E8F4FF", "#FFE135"];

  for (let i = 0; i < count; i++) {
    generatedStars.push({
      id: i,
      initialX: Math.random() * screenWidth,
      initialY: Math.random() * screenHeight,
      size: Math.random() * 2.5 + 1.5,
      opacity: Math.random() * 0.25 + 0.75,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      animationDuration: Math.random() * 15000 + 20000,
      animationDelay: Math.random() * 10000,
    });
  }

  return generatedStars;
};

export const __generateShootingStarsForTests = (
  screenWidth: number,
  screenHeight: number,
  count: number = SHOOTING_STAR_COUNT,
): ShootingStarConfig[] => {
  const configs: ShootingStarConfig[] = [];
  for (let i = 0; i < count; i++) {
    const angle = 120 + Math.random() * 40;
    configs.push({
      id: i,
      startX: Math.random() * screenWidth * 0.7,
      startY: Math.random() * screenHeight * 0.35,
      length: 18 + Math.random() * 16,
      angle,
      distance: 160 + Math.random() * 120,
      duration: 2800 + Math.random() * 1800,
      delay: i * 3000 + Math.random() * 1500,
      repeatInterval: 5000 + Math.random() * 9000,
    });
  }
  return configs;
};

const AnimatedStar: React.FC<{star: Star}> = React.memo(({star}) => {
  const opacity = useSharedValue(star.opacity);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isQASurfaceRuntimeActive()) {
      opacity.value = star.opacity;
      scale.value = 1;
      return;
    }

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
          }),
        ),
        -1,
        true,
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
          }),
        ),
        -1,
        true,
      );
    }, star.animationDelay);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [star, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
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
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.9,
      shadowRadius: star.size * 3,
      elevation: 6,
    }),
    [star],
  );

  return <Animated.View testID={`star-${star.id}`} style={[styles.star, staticStyle, animatedStyle]} />;
});

AnimatedStar.displayName = "AnimatedStar";

const ShootingStar: React.FC<{config: ShootingStarConfig}> = React.memo(({config}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const angleRad = (config.angle * Math.PI) / 180;
  const dx = Math.cos(angleRad) * config.distance;
  const dy = Math.sin(angleRad) * config.distance;

  useEffect(() => {
    if (isQASurfaceRuntimeActive()) {
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;
      return;
    }

    const {duration, repeatInterval} = config;

    const timeoutId = setTimeout(() => {
      translateX.value = withRepeat(
        withSequence(
          withTiming(dx, {duration, easing: Easing.linear}),
          withTiming(0, {duration: 1}),
          withTiming(0, {duration: repeatInterval}),
        ),
        -1,
        false,
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(dy, {duration, easing: Easing.linear}),
          withTiming(0, {duration: 1}),
          withTiming(0, {duration: repeatInterval}),
        ),
        -1,
        false,
      );

      opacity.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration * 0.1,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0.85, {duration: duration * 0.6, easing: Easing.linear}),
          withTiming(0, {
            duration: duration * 0.3,
            easing: Easing.in(Easing.quad),
          }),
          withTiming(0, {duration: repeatInterval + 1}),
        ),
        -1,
        false,
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
    transform: [{translateX: translateX.value}, {translateY: translateY.value}, {rotate: `${config.angle}deg`}],
    opacity: opacity.value,
  }));

  const svgWidth = config.length + 4;
  const svgHeight = 5;
  const cy = svgHeight / 2;

  return (
    <Animated.View
      testID={`shooting-star-${config.id}`}
      style={[
        {
          position: "absolute" as const,
          left: config.startX,
          top: config.startY - cy,
        },
        animatedStyle,
      ]}
    >
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <LinearGradient id={`sg${config.id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="white" stopOpacity={0} />
            <Stop offset="0.5" stopColor="white" stopOpacity={0.05} />
            <Stop offset="0.82" stopColor="white" stopOpacity={0.5} />
            <Stop offset="1" stopColor="white" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={cy - 0.5} width={config.length} height={1} rx={0.5} fill={`url(#sg${config.id})`} />
        <Circle cx={config.length + 1.5} cy={cy} r={1.5} fill="white" fillOpacity={1} />
      </Svg>
    </Animated.View>
  );
});

ShootingStar.displayName = "ShootingStar";

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
    opacity: 0.78,
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
    shadowOffset: {width: 0, height: 0},
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

const StarryBackground: React.FC = () => {
  const [stars] = useState<Star[]>(() => __generateStarsForTests(SCREEN_WIDTH, SCREEN_HEIGHT));

  const [shootingStars] = useState<ShootingStarConfig[]>(() =>
    __generateShootingStarsForTests(SCREEN_WIDTH, SCREEN_HEIGHT),
  );

  const starComponents = useMemo(() => stars.map((star) => <AnimatedStar key={star.id} star={star} />), [stars]);

  const shootingStarComponents = useMemo(
    () => shootingStars.map((config) => <ShootingStar key={config.id} config={config} />),
    [shootingStars],
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
