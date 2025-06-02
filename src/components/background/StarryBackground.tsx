import React, { useMemo } from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  withDelay,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Star {
  id: number;
  initialX: number;
  initialY: number;
  size: number;
  opacity: number;
  animationDuration: number;
  animationDelay: number;
  movementSpeed: number;
  movementDirection: number;
  movementRadius: number;
}

interface AnimatedStarProps {
  star: Star;
}

const StarryBackground: React.FC = () => {
  // Generate stars with random properties (memoized to prevent regeneration)
  const stars = useMemo(() => {
    const starCount = 150; // Number of stars
    const generatedStars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      generatedStars.push({
        id: i,
        initialX: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 3 + 1, // Star size between 1-4
        opacity: Math.random() * 0.7 + 0.3, // Opacity between 0.3-1
        animationDuration: Math.random() * 3000 + 2000, // Twinkle duration 2-5s
        animationDelay: Math.random() * 3000, // Random start delay
        movementSpeed: Math.random() * 30 + 20, // Movement speed (slower for stability)
        movementDirection: Math.random() * 360, // Random direction in degrees
        movementRadius: Math.random() * 20 + 10, // Movement radius 10-30 pixels
      });
    }

    return generatedStars;
  }, []); // Empty dependency array ensures stars are only generated once

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#0a0a2e", // Deep night blue
        overflow: "hidden",
      }}
    >
      {/* Gradient overlay for depth */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          opacity: 0.5,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            backgroundColor: "#000033",
            opacity: 0.3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "50%",
            backgroundColor: "#000000",
            opacity: 0.2,
          }}
        />
      </View>

      {/* Render all stars */}
      {stars.map((star) => (
        <AnimatedStar key={star.id} star={star} />
      ))}
    </View>
  );
};

// Individual animated star component
/* eslint-disable react/prop-types */
const AnimatedStar: React.FC<AnimatedStarProps> = React.memo(({ star }) => {
  // Twinkle animation
  const twinkle = useSharedValue(0);

  // Movement animation (using circular motion for smooth continuous movement)
  const movement = useSharedValue(0);

  // Start animations
  React.useEffect(() => {
    // Twinkle animation
    twinkle.value = withDelay(
      star.animationDelay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: star.animationDuration / 2,
            easing: Easing.ease,
          }),
          withTiming(0, {
            duration: star.animationDuration / 2,
            easing: Easing.ease,
          })
        ),
        -1, // Repeat forever
        false // Don't reverse
      )
    );

    // Circular movement animation
    movement.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: star.movementSpeed * 1000,
        easing: Easing.linear,
      }),
      -1, // Repeat forever
      false // Don't reverse
    );
  }, [star.animationDelay, star.animationDuration, star.movementSpeed]);

  // Animated style for twinkle and movement
  const animatedStyle = useAnimatedStyle(() => {
    // Use circular motion for smooth, continuous movement
    const angle = movement.value + (star.movementDirection * Math.PI) / 180;
    const moveX = Math.cos(angle) * star.movementRadius;
    const moveY = Math.sin(angle) * star.movementRadius;

    // Twinkle effect on opacity and size
    const opacity = interpolate(
      twinkle.value,
      [0, 1],
      [star.opacity * 0.3, star.opacity]
    );

    const scale = interpolate(twinkle.value, [0, 1], [0.8, 1.2]);

    return {
      opacity,
      transform: [
        { translateX: star.initialX + moveX },
        { translateY: star.initialY + moveY },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: "#ffffff",
          shadowColor: "#ffffff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: star.size,
          elevation: 5,
        },
        animatedStyle,
      ]}
    />
  );
});
/* eslint-enable react/prop-types */

AnimatedStar.displayName = "AnimatedStar";

export default StarryBackground;
