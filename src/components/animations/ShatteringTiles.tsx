import React, { useEffect, useRef, useState } from "react";
import { View, Text, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Matter from "matter-js";
import { styles, COLORS } from "../../styles";

const TILE_SIZE = 56; // 14 * 4 (w-14 from GuessGrid)
const MAX_POOL_SIZE = 21; // Max tiles we might need (3 rows × 7 columns = 21)
const FIXED_DELTA = 16.67; // ~60 FPS
const OFF_SCREEN_THRESHOLD = 200;
const FADE_DURATION = 2000; // 2 seconds fade out

interface TileData {
  letter: string | null;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  x: number; // Absolute position
  y: number; // Absolute position
}

interface ShatteringTilesProps {
  tiles: TileData[];
  startAnimation: boolean;
  onAnimationComplete?: () => void;
}

interface TileState {
  id: string;
  data: TileData;
  body: Matter.Body;
  x: Animated.SharedValue<number>;
  y: Animated.SharedValue<number>;
  angle: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
  isActive: boolean;
}

const ShatteringTiles: React.FC<ShatteringTilesProps> = ({
  tiles,
  startAnimation,
  onAnimationComplete,
}) => {
  const sceneRef = useRef<View>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const tilePoolRef = useRef<TileState[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const activeTilesForCompletionRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  // Create individual shared values for the pool (pre-create all 21)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sharedValues = [
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
    {
      x: useSharedValue(-1000),
      y: useSharedValue(-1000),
      angle: useSharedValue(0),
      opacity: useSharedValue(0),
    },
  ];

  // Initialize Matter.js engine and tile pool
  useEffect(() => {
    if (!isMounted) return;

    console.log("Initializing Matter.js engine and tile pool");

    engineRef.current = Matter.Engine.create({ enableSleeping: true });
    const world = engineRef.current.world;
    world.gravity.y = 0.8; // Slightly stronger gravity than letters

    const { width, height } = Dimensions.get("window");

    // Create boundaries
    const ground = Matter.Bodies.rectangle(
      width / 2,
      height + TILE_SIZE,
      width * 2,
      TILE_SIZE * 2,
      { isStatic: true, label: "ground" }
    );
    const ceiling = Matter.Bodies.rectangle(
      width / 2,
      -TILE_SIZE * 3,
      width * 2,
      TILE_SIZE * 2,
      { isStatic: true, label: "ceiling" }
    );
    const leftWall = Matter.Bodies.rectangle(
      -TILE_SIZE,
      height / 2,
      TILE_SIZE * 2,
      height * 2,
      { isStatic: true, label: "leftWall" }
    );
    const rightWall = Matter.Bodies.rectangle(
      width + TILE_SIZE,
      height / 2,
      TILE_SIZE * 2,
      height * 2,
      { isStatic: true, label: "rightWall" }
    );
    Matter.World.add(world, [ground, ceiling, leftWall, rightWall]);

    // Create tile pool
    const pool: TileState[] = [];
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
      const body = Matter.Bodies.rectangle(-1000, -1000, TILE_SIZE, TILE_SIZE, {
        restitution: 0.4,
        friction: 0.1,
        label: `tile-${i}`,
        density: 0.2,
        isStatic: true,
        isSleeping: true,
      });
      Matter.World.add(world, body);
      pool.push({
        id: `pooled-tile-${i}`,
        data: {
          letter: null,
          backgroundColor: "transparent",
          borderColor: "gray-400",
          textColor: "gray-800",
          x: 0,
          y: 0,
        },
        body,
        ...sharedValues[i],
        isActive: false,
      });
    }
    tilePoolRef.current = pool;
    setIsMounted(true);

    // Animation loop
    const updateMatter = () => {
      if (!engineRef.current || !engineRef.current.world) {
        animationFrameIdRef.current = requestAnimationFrame(updateMatter);
        return;
      }

      Matter.Engine.update(engineRef.current, FIXED_DELTA);

      let currentlyActiveInLoop = 0;
      let offScreenCountThisFrame = 0;

      tilePoolRef.current.forEach((tile) => {
        if (tile.isActive) {
          currentlyActiveInLoop++;
          tile.x.value = tile.body.position.x - TILE_SIZE / 2;
          tile.y.value = tile.body.position.y - TILE_SIZE / 2;
          tile.angle.value = tile.body.angle;

          // Check if tile is off-screen
          if (
            tile.body.position.y > height + OFF_SCREEN_THRESHOLD ||
            tile.body.position.y < -OFF_SCREEN_THRESHOLD ||
            tile.body.position.x < -OFF_SCREEN_THRESHOLD ||
            tile.body.position.x > width + OFF_SCREEN_THRESHOLD
          ) {
            offScreenCountThisFrame++;
            tile.isActive = false;
            Matter.Body.setStatic(tile.body, true);
            Matter.Body.setPosition(tile.body, { x: -1000, y: -1000 });
            Matter.Body.setVelocity(tile.body, { x: 0, y: 0 });
            Matter.Body.setAngle(tile.body, 0);
            Matter.Body.setAngularVelocity(tile.body, 0);
            Matter.Sleeping.set(tile.body, true);

            // Reset shared values
            tile.x.value = -1000;
            tile.y.value = -1000;
            tile.angle.value = 0;
            tile.opacity.value = 0;
          }
        }
      });

      // Check for animation completion
      if (
        startAnimation &&
        activeTilesForCompletionRef.current > 0 &&
        currentlyActiveInLoop === 0 &&
        offScreenCountThisFrame > 0
      ) {
        if (onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
        activeTilesForCompletionRef.current = 0;
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
      tilePoolRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, startAnimation, onAnimationComplete]);

  // Effect to set up tiles based on tiles prop
  useEffect(() => {
    if (!isMounted || !engineRef.current || tiles.length === 0) return;

    // Deactivate all tiles first
    tilePoolRef.current.forEach((tile) => {
      if (tile.isActive) {
        tile.isActive = false;
        Matter.Body.setStatic(tile.body, true);
        Matter.Body.setPosition(tile.body, { x: -1000, y: -1000 });
      }
    });

    let activatedCount = 0;
    for (let i = 0; i < tiles.length && i < MAX_POOL_SIZE; i++) {
      const tileData = tiles[i];
      const tileState = tilePoolRef.current[i];

      if (tileState && tileData.letter) {
        // Only animate tiles with letters
        tileState.isActive = true;
        tileState.data = tileData;

        // Position tile at its original location
        Matter.Body.setStatic(tileState.body, true);
        Matter.Body.setPosition(tileState.body, {
          x: tileData.x + TILE_SIZE / 2,
          y: tileData.y + TILE_SIZE / 2,
        });
        Matter.Body.setVelocity(tileState.body, { x: 0, y: 0 });
        Matter.Body.setAngle(tileState.body, 0);
        Matter.Body.setAngularVelocity(tileState.body, 0);
        Matter.Sleeping.set(tileState.body, false);

        tileState.x.value = tileData.x;
        tileState.y.value = tileData.y;
        tileState.angle.value = 0;
        tileState.opacity.value = 1;
        activatedCount++;
      }
    }
    activeTilesForCompletionRef.current = activatedCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, isMounted]);

  // Effect to start shattering animation
  useEffect(() => {
    if (
      startAnimation &&
      engineRef.current &&
      tilePoolRef.current.length > 0 &&
      isMounted
    ) {
      console.log(
        "Tiles shattering animation triggered for",
        tiles.length,
        "tiles"
      );

      let hasActiveTilesToAnimate = false;
      tilePoolRef.current.forEach((tileState) => {
        if (tileState.isActive) {
          hasActiveTilesToAnimate = true;

          // Make tile dynamic and apply physics
          Matter.Body.setStatic(tileState.body, false);
          Matter.Sleeping.set(tileState.body, false);

          // Add random rotation
          Matter.Body.setAngle(
            tileState.body,
            (Math.random() - 0.5) * Math.PI * 0.4
          );
          Matter.Body.setAngularVelocity(
            tileState.body,
            (Math.random() - 0.5) * 0.2
          );

          // Initial upward velocity with random spread
          Matter.Body.setVelocity(tileState.body, {
            x: (Math.random() - 0.5) * 8, // Horizontal spread
            y: -8 - Math.random() * 6, // Strong upward boost
          });

          // Apply additional force for explosion effect
          const forceMagnitudeY =
            (-0.02 - Math.random() * 0.015) * tileState.body.mass;
          const forceMagnitudeX =
            (Math.random() - 0.5) * 0.01 * tileState.body.mass;
          Matter.Body.applyForce(tileState.body, tileState.body.position, {
            x: forceMagnitudeX,
            y: forceMagnitudeY,
          });

          // Start fade out animation
          tileState.opacity.value = withTiming(0, {
            duration: FADE_DURATION,
          });
        }
      });

      if (!hasActiveTilesToAnimate) {
        activeTilesForCompletionRef.current = 0;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAnimation, isMounted, tilePoolRef, engineRef, onAnimationComplete]);

  if (!isMounted) return null;

  // Helper function to get background color class
  const getBackgroundStyle = (backgroundColor: string) => {
    switch (backgroundColor) {
      case "bg-green-500":
        return { backgroundColor: COLORS.tileCorrect };
      case "bg-primary-orange":
        return { backgroundColor: COLORS.tilePartial };
      case "bg-red-500":
        return { backgroundColor: COLORS.tileIncorrect };
      default:
        return { backgroundColor: "transparent" };
    }
  };

  // Helper function to get border color
  const getBorderStyle = (borderColor: string) => {
    switch (borderColor) {
      case "gray-400":
        return { borderColor: COLORS.gray400 };
      default:
        return { borderColor: "transparent" };
    }
  };

  // Helper function to get text color
  const getTextColor = (textColor: string) => {
    switch (textColor) {
      case "text-white":
        return COLORS.white;
      case "text-gray-800":
        return COLORS.gray800;
      default:
        return COLORS.gray800;
    }
  };

  return (
    <View
      ref={sceneRef}
      style={styles.shatteringTilesContainer}
      pointerEvents="none"
    >
      {tilePoolRef.current.map((tile) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const animatedStyle = useAnimatedStyle(() => {
          return {
            opacity: tile.opacity.value,
            transform: [
              { translateX: tile.x.value },
              { translateY: tile.y.value },
              { rotate: `${tile.angle.value}rad` },
            ],
          };
        });

        if (!tile.isActive) return null;

        const backgroundStyle = getBackgroundStyle(tile.data.backgroundColor);
        const borderStyle = getBorderStyle(tile.data.borderColor);
        const textColor = getTextColor(tile.data.textColor);

        return (
          <Animated.View
            key={tile.id}
            style={[
              styles.tileView,
              backgroundStyle,
              borderStyle,
              animatedStyle,
            ]}
          >
            <Text style={[styles.tileText, { color: textColor }]}>
              {tile.data.letter?.toUpperCase()}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

export default ShatteringTiles;
