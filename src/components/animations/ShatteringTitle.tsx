import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text, Dimensions } from "react-native";
import Matter from "matter-js";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";

const LETTER_SIZE = 40;
const MAX_POOL_SIZE = 20; // Reduced to a reasonable number for individual shared values
const FIXED_DELTA = 16.67; // ~60 FPS
const OFF_SCREEN_THRESHOLD = 200; // How far off-screen before recycling
const LETTER_TEXT_COLOR = "#333"; // Letter text color constant

interface ShatteringTitleProps {
  title: string;
  startAnimation: boolean;
  onAnimationComplete?: () => void; // Optional callback for when letters settle or fly off
}

interface LetterState {
  id: string; // Unique ID for the pooled object
  text: string; // Current character it represents
  body: Matter.Body;
  x: Animated.SharedValue<number>;
  y: Animated.SharedValue<number>;
  angle: Animated.SharedValue<number>;
  isActive: boolean; // Is this letter currently part of the visible title/animation
}

const ShatteringTitle: React.FC<ShatteringTitleProps> = ({
  title,
  startAnimation,
  onAnimationComplete,
}) => {
  const sceneRef = useRef<View>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const letterPoolRef = useRef<LetterState[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const activeLettersForCompletionRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false); // To trigger updates after pool is ready

  // Create individual shared values at the top level (limited to 20 for practicality)
  const sharedValues = [
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
    },
  ];

  // Initialize Matter.js engine and letter pool once
  useEffect(() => {
    engineRef.current = Matter.Engine.create({ enableSleeping: true });
    const world = engineRef.current.world;
    world.gravity.y = 0.5;

    const { width, height } = Dimensions.get("window");
    const ground = Matter.Bodies.rectangle(
      width / 2,
      height + LETTER_SIZE,
      width * 2,
      LETTER_SIZE * 2,
      { isStatic: true, label: "ground" }
    );
    const ceiling = Matter.Bodies.rectangle(
      width / 2,
      -LETTER_SIZE * 3,
      width * 2,
      LETTER_SIZE * 2,
      { isStatic: true, label: "ceiling" }
    ); // Raised ceiling
    const leftWall = Matter.Bodies.rectangle(
      -LETTER_SIZE,
      height / 2,
      LETTER_SIZE * 2,
      height * 2,
      { isStatic: true, label: "leftWall" }
    );
    const rightWall = Matter.Bodies.rectangle(
      width + LETTER_SIZE,
      height / 2,
      LETTER_SIZE * 2,
      height * 2,
      { isStatic: true, label: "rightWall" }
    );
    Matter.World.add(world, [ground, ceiling, leftWall, rightWall]);

    const pool: LetterState[] = [];
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
      const body = Matter.Bodies.rectangle(
        -1000,
        -1000,
        LETTER_SIZE,
        LETTER_SIZE,
        {
          restitution: 0.6,
          friction: 0.05,
          label: `letter-${i}`,
          density: 0.1,
          isStatic: true,
          isSleeping: true,
        }
      );
      Matter.World.add(world, body);
      pool.push({
        id: `pooled-letter-${i}`,
        text: "",
        body,
        ...sharedValues[i], // Use pre-created shared values
        isActive: false,
      });
    }
    letterPoolRef.current = pool;
    setIsMounted(true); // Signal that the pool is ready

    // Animation loop
    const updateMatter = () => {
      if (!engineRef.current || !engineRef.current.world) {
        animationFrameIdRef.current = requestAnimationFrame(updateMatter);
        return;
      }

      Matter.Engine.update(engineRef.current, FIXED_DELTA);

      let currentlyActiveInLoop = 0;
      let offScreenCountThisFrame = 0;

      letterPoolRef.current.forEach((letter) => {
        if (letter.isActive) {
          currentlyActiveInLoop++;
          letter.x.value = letter.body.position.x - LETTER_SIZE / 2;
          letter.y.value = letter.body.position.y - LETTER_SIZE / 2;
          letter.angle.value = letter.body.angle;

          if (
            letter.body.position.y > height + OFF_SCREEN_THRESHOLD ||
            letter.body.position.y < -OFF_SCREEN_THRESHOLD ||
            letter.body.position.x < -OFF_SCREEN_THRESHOLD ||
            letter.body.position.x > width + OFF_SCREEN_THRESHOLD
          ) {
            offScreenCountThisFrame++;
            letter.isActive = false; // Deactivate and return to pool
            Matter.Body.setStatic(letter.body, true);
            Matter.Body.setPosition(letter.body, { x: -1000, y: -1000 }); // Move far off
            Matter.Body.setVelocity(letter.body, { x: 0, y: 0 });
            Matter.Body.setAngle(letter.body, 0);
            Matter.Body.setAngularVelocity(letter.body, 0);
            Matter.Sleeping.set(letter.body, true);
            // Reset shared values for cleanliness, though opacity handles visibility
            letter.x.value = -1000;
            letter.y.value = -1000;
            letter.angle.value = 0;
          }
        }
      });

      if (
        startAnimation &&
        activeLettersForCompletionRef.current > 0 &&
        currentlyActiveInLoop === 0 &&
        offScreenCountThisFrame > 0
      ) {
        if (onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
        activeLettersForCompletionRef.current = 0; // Reset for next animation
      }
      animationFrameIdRef.current = requestAnimationFrame(updateMatter);
    };
    animationFrameIdRef.current = requestAnimationFrame(updateMatter);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
      }
      engineRef.current = null;
      letterPoolRef.current = [];
    };
  }, [startAnimation, onAnimationComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to activate/deactivate letters based on title prop
  useEffect(() => {
    if (!isMounted || !engineRef.current) return; // Wait for pool and engine

    const { width, height } = Dimensions.get("window");
    const newChars = title.split("");
    activeLettersForCompletionRef.current = 0;

    // Deactivate all letters first to handle title changes correctly
    letterPoolRef.current.forEach((letter) => {
      if (letter.isActive) {
        letter.isActive = false;
        Matter.Body.setStatic(letter.body, true);
        Matter.Body.setPosition(letter.body, { x: -1000, y: -1000 });
      }
    });

    let activatedCount = 0;
    for (let i = 0; i < newChars.length; i++) {
      if (i >= MAX_POOL_SIZE) break; // Respect pool size

      const letterState = letterPoolRef.current[i]; // Get next available from pool (simplistic, assumes order)
      if (letterState) {
        letterState.isActive = true;
        letterState.text = newChars[i];

        const initialX =
          width / 2 -
          (newChars.length * LETTER_SIZE) / 2 +
          i * LETTER_SIZE +
          LETTER_SIZE / 2;
        const initialY = height / 3;

        Matter.Body.setStatic(letterState.body, true); // Keep static until animation starts
        Matter.Body.setPosition(letterState.body, { x: initialX, y: initialY });
        Matter.Body.setVelocity(letterState.body, { x: 0, y: 0 });
        Matter.Body.setAngle(letterState.body, 0);
        Matter.Body.setAngularVelocity(letterState.body, 0);
        Matter.Sleeping.set(letterState.body, false);

        letterState.x.value = initialX - LETTER_SIZE / 2;
        letterState.y.value = initialY - LETTER_SIZE / 2;
        letterState.angle.value = 0;
        activatedCount++;
      }
    }
    activeLettersForCompletionRef.current = activatedCount;
    // Force a re-render if needed by updating a dummy state, or rely on direct manipulation updates.
    // For this example, reanimated updates should handle views directly.
  }, [title, isMounted]); // React to title changes after pool is ready

  // Effect to apply forces when startAnimation becomes true
  useEffect(() => {
    if (
      startAnimation &&
      engineRef.current &&
      letterPoolRef.current.length > 0 &&
      isMounted
    ) {
      console.log("Shattering animation triggered for", title);

      let hasActiveLettersToAnimate = false;
      letterPoolRef.current.forEach((letterState) => {
        if (letterState.isActive) {
          hasActiveLettersToAnimate = true;
          Matter.Body.setStatic(letterState.body, false);
          Matter.Sleeping.set(letterState.body, false);
          Matter.Body.setAngle(
            letterState.body,
            (Math.random() - 0.5) * Math.PI * 0.5
          );
          Matter.Body.setAngularVelocity(
            letterState.body,
            (Math.random() - 0.5) * 0.15
          );
          Matter.Body.setVelocity(letterState.body, {
            x: (Math.random() - 0.5) * 2,
            y: -5 - Math.random() * 5,
          }); // Initial upward boost

          const forceMagnitudeY =
            (-0.015 - Math.random() * 0.01) * letterState.body.mass; // Adjusted upward force
          const forceMagnitudeX =
            (Math.random() - 0.5) * 0.005 * letterState.body.mass;
          Matter.Body.applyForce(letterState.body, letterState.body.position, {
            x: forceMagnitudeX,
            y: forceMagnitudeY,
          });
        }
      });
      if (!hasActiveLettersToAnimate) activeLettersForCompletionRef.current = 0;
    }
  }, [startAnimation, isMounted, title]); // Rerun if startAnimation or title changes when mounted

  if (!isMounted) return null; // Don't render until pool is initialized

  return (
    <View ref={sceneRef} style={styles.container} pointerEvents="none">
      {letterPoolRef.current.map((letter) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const animatedStyle = useAnimatedStyle(() => {
          return {
            opacity: letter.isActive ? 1 : 0, // Render only active letters
            transform: [
              { translateX: letter.x.value },
              { translateY: letter.y.value },
              { rotate: `${letter.angle.value}rad` },
            ],
          };
        });
        return (
          <Animated.View
            key={letter.id}
            style={[styles.letterView, animatedStyle]}
          >
            <Text style={styles.letterText}>{letter.text}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Fill parent and allow clicks to pass through
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: 'rgba(200, 200, 200, 0.1)', // For debugging view bounds
  },
  letterText: {
    color: LETTER_TEXT_COLOR,
    fontSize: LETTER_SIZE * 0.8, // Adjust to fit well within the view
    fontWeight: "bold",
  },
  letterView: {
    alignItems: "center",
    height: LETTER_SIZE,
    justifyContent: "center",
    position: "absolute", // Important for positioning with transform
    width: LETTER_SIZE,
  },
});

export default ShatteringTitle;
