/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useEffect, useState } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../../styles";
import { SolarSystemPreloader } from "../../services/SolarSystemPreloader";
import ThreeDSolarSystem from "./ThreeDSolarSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Increased star count for better visibility
const OPTIMIZED_STAR_COUNT = 120;
const COMET_COUNT = 6;

interface Star {
  id: number;
  initialX: number;
  initialY: number;
  size: number;
  opacity: number;
  color: string;
  animationDuration: number;
  animationDelay: number;
  movementSpeed: number;
  movementDirection: number;
  movementRadius: number;
}

interface Comet {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed: number;
  size: number;
  color: string;
  animationDuration: number;
  animationDelay: number;
  tailLength: number;
}

// Animated Star Component
const AnimatedStar: React.FC<{ star: Star }> = ({ star }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(star.opacity);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Gentle floating movement
    const moveX =
      star.movementRadius * Math.cos((star.movementDirection * Math.PI) / 180);
    const moveY =
      star.movementRadius * Math.sin((star.movementDirection * Math.PI) / 180);

    // Start movement animations with delay
    setTimeout(() => {
      translateX.value = withRepeat(
        withSequence(
          withTiming(moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(moveY * 0.5, {
            duration: star.animationDuration * 1.2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveY * 0.5, {
            duration: star.animationDuration * 1.2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      // Twinkling effect
      opacity.value = withRepeat(
        withSequence(
          withTiming(star.opacity * 0.3, {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );

      // Gentle scale pulsing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, {
            duration: 3000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.8, {
            duration: 3000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    }, star.animationDelay);
  }, [star, translateX, translateY, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        {
          position: "absolute",
          left: star.initialX,
          top: star.initialY,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
          // Enhanced glow effect
          shadowColor: star.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: star.size * 2,
          elevation: 8,
        },
        animatedStyle,
      ]}
    />
  );
};

// Animated Comet Component
const AnimatedComet: React.FC<{ comet: Comet }> = ({ comet }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Comet movement from start to end position
    const deltaX = comet.endX - comet.startX;
    const deltaY = comet.endY - comet.startY;

    setTimeout(() => {
      // Fade in and move
      opacity.value = withTiming(0.9, { duration: 500 });

      translateX.value = withTiming(deltaX, {
        duration: comet.speed,
        easing: Easing.out(Easing.quad),
      });

      translateY.value = withTiming(deltaY, {
        duration: comet.speed,
        easing: Easing.out(Easing.quad),
      });

      // Fade out near the end
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 1000 });
      }, comet.speed - 1000);
    }, comet.animationDelay);

    // Reset animation after completion
    setTimeout(() => {
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;

      // Restart the animation
      setTimeout(() => {
        opacity.value = withTiming(0.9, { duration: 500 });
        translateX.value = withTiming(deltaX, {
          duration: comet.speed,
          easing: Easing.out(Easing.quad),
        });
        translateY.value = withTiming(deltaY, {
          duration: comet.speed,
          easing: Easing.out(Easing.quad),
        });
      }, 1000);
    }, comet.animationDelay + comet.speed + 2000);
  }, [comet, translateX, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });

  const tailAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value * 0.4,
    };
  });

  return (
    <React.Fragment>
      {/* Comet tail */}
      <Animated.View
        style={[
          styles.cometTail,
          {
            left: comet.startX,
            top: comet.startY,
            width: comet.tailLength,
            height: comet.size * 0.5,
            backgroundColor: comet.color,
            shadowColor: comet.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: comet.size * 3,
            transform: [
              {
                rotate: `${
                  (Math.atan2(
                    comet.endY - comet.startY,
                    comet.endX - comet.startX
                  ) *
                    180) /
                  Math.PI
                }deg`,
              },
            ],
          },
          tailAnimatedStyle,
        ]}
      />
      {/* Comet head */}
      <Animated.View
        style={[
          styles.comet,
          {
            left: comet.startX,
            top: comet.startY,
            width: comet.size,
            height: comet.size,
            backgroundColor: comet.color,
            shadowColor: comet.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1.0,
            shadowRadius: comet.size * 4,
            elevation: 10,
          },
          animatedStyle,
        ]}
      />
    </React.Fragment>
  );
};

const styles = StyleSheet.create({
  comet: {
    borderRadius: 50,
    position: "absolute",
  },
  cometContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2,
  },
  cometTail: {
    borderRadius: 50,
    position: "absolute",
  },
  container: {
    backgroundColor: COLORS.black,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },

  star: {
    backgroundColor: COLORS.white,
    elevation: 5,
    position: "absolute",
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  starsContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
});

const StarryBackground: React.FC = () => {
  // Performance tracking
  const starRefs = useRef<Set<number>>(new Set());

  // Solar system ready state - check if it's preloaded during app initialization
  const [systemReady, setSystemReady] = useState(false);

  // Check if solar system is ready on mount
  useEffect(() => {
    const checkSystemReady = () => {
      if (SolarSystemPreloader.isSystemPreloaded()) {
        setSystemReady(true);
        console.log("StarryBackground: Solar system is ready");
      } else {
        console.log(
          "StarryBackground: Solar system not ready yet, will check again..."
        );
        // Check again after a short delay
        setTimeout(checkSystemReady, 100);
      }
    };

    checkSystemReady();
  }, []);

  // Generate enhanced star pool with better visibility
  const stars = useMemo(() => {
    const generatedStars: Star[] = [];
    const starColors = [
      COLORS.white,
      COLORS.primaryOrangeLight,
      COLORS.gray100,
      COLORS.gray200,
      "#FFD700", // Gold
      "#87CEEB", // Sky blue
      "#FFB6C1", // Light pink
    ];

    for (let i = 0; i < OPTIMIZED_STAR_COUNT; i++) {
      generatedStars.push({
        id: i,
        initialX: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        // Increased star size for better visibility
        size: Math.random() * 4 + 2, // 2-6px instead of 1-3px
        // Increased opacity for better visibility
        opacity: Math.random() * 0.4 + 0.6, // 0.6-1.0 instead of 0.4-1.0
        color: starColors[Math.floor(Math.random() * starColors.length)],
        animationDuration: Math.random() * 3000 + 3000,
        animationDelay: Math.random() * 3000,
        movementSpeed: Math.random() * 30 + 20,
        movementDirection: Math.random() * 360,
        movementRadius: Math.random() * 20 + 10,
      });
      starRefs.current.add(i);
    }

    return generatedStars;
  }, []);

  // Generate comet effects
  const comets = useMemo(() => {
    const generatedComets: Comet[] = [];
    const cometColors = [
      "#00BFFF", // Deep sky blue
      "#FFD700", // Gold
      "#FF69B4", // Hot pink
      "#00FA9A", // Medium spring green
      "#FF6347", // Tomato
      "#DA70D6", // Orchid
    ];

    for (let i = 0; i < COMET_COUNT; i++) {
      // Random direction: top-to-bottom, left-to-right, or diagonal
      const direction = Math.random();
      let startX, startY, endX, endY;

      if (direction < 0.33) {
        // Top to bottom diagonal
        startX = Math.random() * SCREEN_WIDTH * 0.3;
        startY = -50;
        endX = startX + SCREEN_WIDTH * 0.7;
        endY = SCREEN_HEIGHT + 50;
      } else if (direction < 0.66) {
        // Left to right diagonal
        startX = -50;
        startY = Math.random() * SCREEN_HEIGHT * 0.5;
        endX = SCREEN_WIDTH + 50;
        endY = startY + SCREEN_HEIGHT * 0.4;
      } else {
        // Right to left diagonal
        startX = SCREEN_WIDTH + 50;
        startY = Math.random() * SCREEN_HEIGHT * 0.3;
        endX = -50;
        endY = startY + SCREEN_HEIGHT * 0.6;
      }

      generatedComets.push({
        id: i,
        startX,
        startY,
        endX,
        endY,
        speed: Math.random() * 2000 + 3000, // 3-5 seconds
        size: Math.random() * 3 + 2, // 2-5px
        color: cometColors[Math.floor(Math.random() * cometColors.length)],
        animationDuration: Math.random() * 5000 + 5000, // 5-10 seconds
        animationDelay: Math.random() * 10000, // 0-10 seconds delay
        tailLength: Math.random() * 40 + 20, // 20-60px tail
      });
    }

    return generatedComets;
  }, []);

  return (
    <View style={styles.container}>
      {/* Only render 3D content when solar system is ready */}
      {systemReady && (
        <>
          {/* Three.js 3D Solar System - Background Layer (uses preloaded system) */}
          <ThreeDSolarSystem />

          {/* Enhanced animated stars with movement */}
          <View style={styles.starsContainer}>
            {stars.map((star) => (
              <AnimatedStar key={star.id} star={star} />
            ))}
          </View>

          {/* Animated comets with tails */}
          <View style={styles.cometContainer}>
            {comets.map((comet) => (
              <AnimatedComet key={comet.id} comet={comet} />
            ))}
          </View>
        </>
      )}
    </View>
  );
};

export default StarryBackground;
