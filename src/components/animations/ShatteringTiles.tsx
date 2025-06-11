/* eslint-disable react/prop-types */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { View, Text, Dimensions, Platform, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useSharedValue,
} from "react-native-reanimated";
import Matter from "matter-js";
import { styles as globalStyles, COLORS } from "../../styles"; // Renamed styles to globalStyles

const TILE_SIZE = 56; // 14 * 4 (w-14 from GuessGrid)
const MAX_POOL_SIZE = 21; // Max tiles we might need (3 rows × 7 columns = 21)
const FIXED_DELTA = 16.67; // ~60 FPS
const OFF_SCREEN_THRESHOLD = 200;
const FADE_DURATION = 2000; // 2 seconds fade out

export interface TileData {
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

// Helper to get text color - assuming this was part of the original component's logic
const getTextColorHelper = (textColorName: string) => {
  const colorKey = textColorName as keyof typeof COLORS;
  return COLORS[colorKey] || COLORS.black;
};

// New component for individual tile rendering
interface ShatteringTileItemProps {
  tileState: TileState;
  index: number; // If testID needs index
  // Pass any other necessary props like globalStyles, getComputedStyleHelper
}

const ShatteringTileItem: React.FC<ShatteringTileItemProps> = React.memo(
  ({ tileState, index }) => {
    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: tileState.x.value },
          { translateY: tileState.y.value },
          { rotate: `${tileState.angle.value}rad` },
        ],
        opacity: tileState.opacity.value,
      };
    });

    const computedBgColor = tileState.data
      .backgroundColor as keyof typeof COLORS;
    const computedBorderColor = tileState.data
      .borderColor as keyof typeof COLORS;
    const backgroundColor = COLORS[computedBgColor] || COLORS.gray300;
    const borderColor = COLORS[computedBorderColor] || COLORS.gray500;

    return (
      <Animated.View
        key={tileState.id}
        testID={`shattering-tile-${index}`}
        style={[
          globalStyles.shatteringTile,
          internalStyles.absoluteFill,
          { backgroundColor, borderColor },
          animatedStyle,
        ]}
      >
        {tileState.isActive && tileState.data.letter && (
          <Text
            style={[
              globalStyles.shatteringTileText,
              { color: getTextColorHelper(tileState.data.textColor) },
            ]}
          >
            {tileState.data.letter}
          </Text>
        )}
      </Animated.View>
    );
  }
);
ShatteringTileItem.displayName = "ShatteringTileItem"; // Add display name

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
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");

  // Create animated shared values for each tile based on the tiles prop
  const sharedValues = useMemo(() => {
    const { useSharedValue } = require("react-native-reanimated");
    // console.log('[ShatteringTiles.tsx] useMemo for sharedValues. tiles:', tiles);
    return tiles.map((tile) => {
      return {
        x: useSharedValue(tile.x - TILE_SIZE / 2),
        y: useSharedValue(tile.y - TILE_SIZE / 2),
        angle: useSharedValue(0),
        opacity: useSharedValue(0),
        tileId: tile.letter,
        backgroundColor: tile.backgroundColor,
        borderColor: tile.borderColor,
        textColor: tile.textColor,
        letter: tile.letter,
        isAnimating: false,
        tileData: tile,
      };
    });
  }, [tiles]);

  // Effect for mount/unmount and engine cleanup
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false); // Clear bodies, not constraints or composites
        Matter.Engine.clear(engineRef.current);
        engineRef.current = null;
      }
    };
  }, []);

  // Initialize Matter.js engine and tile pool
  useEffect(() => {
    if (
      !isMounted ||
      !windowWidth ||
      !windowHeight ||
      !sharedValues ||
      sharedValues.length === 0
    ) {
      console.log(
        `[ShatteringTiles.tsx ENGINE_INIT_EFFECT_V5_EARLY_EXIT] ` +
          `isMounted: ${isMounted}, windowWidth: ${windowWidth}, windowHeight: ${windowHeight}, ` +
          `sharedValues.length: ${sharedValues ? sharedValues.length : "N/A"}`
      );
      return;
    }

    // Initialize engine ONLY if it hasn't been initialized yet
    if (!engineRef.current) {
      console.log(
        "[ShatteringTiles.tsx ENGINE_INIT_EFFECT_V5] Conditions met. Initializing engine and tile pool."
      );
      // Use the actual Matter.Engine.create; the mock is handled by jest.doMock in the test file.
      engineRef.current = Matter.Engine.create({ enableSleeping: true });

      const world = engineRef.current.world;
      if (world && world.gravity) {
        world.gravity.y = 0.8;
      }

      // Create boundaries
      const ground = Matter.Bodies.rectangle(
        windowWidth / 2,
        windowHeight + TILE_SIZE * 2,
        windowWidth * 2,
        TILE_SIZE * 4,
        { isStatic: true, label: "ground" }
      );
      const ceiling = Matter.Bodies.rectangle(
        windowWidth / 2,
        -TILE_SIZE * 2,
        windowWidth * 2,
        TILE_SIZE * 4,
        { isStatic: true, label: "ceiling" }
      );
      const leftWall = Matter.Bodies.rectangle(
        -TILE_SIZE * 2,
        windowHeight / 2,
        TILE_SIZE * 4,
        windowHeight * 2,
        { isStatic: true, label: "leftWall" }
      );
      const rightWall = Matter.Bodies.rectangle(
        windowWidth + TILE_SIZE * 2,
        windowHeight / 2,
        TILE_SIZE * 4,
        windowHeight * 2,
        { isStatic: true, label: "rightWall" }
      );

      if (world) {
        Matter.World.add(world, [ground, ceiling, leftWall, rightWall]);
      }

      const pool: TileState[] = [];
      for (let i = 0; i < MAX_POOL_SIZE; i++) {
        const body = Matter.Bodies.rectangle(
          -1000,
          -1000,
          TILE_SIZE,
          TILE_SIZE,
          {
            restitution: 0.4,
            friction: 0.1,
            label: `tile-${i}`,
            density: 0.2,
            isStatic: true,
            isSleeping: true,
          }
        );
        Matter.World.add(world, body);
        if (sharedValues[i]) {
          console.log(`[ShatteringTiles.tsx POOL_CREATE] Index i: ${i}`);
          console.log(
            `[ShatteringTiles.tsx POOL_CREATE] sharedValues[${i}].opacity type: ${typeof sharedValues[
              i
            ].opacity}`
          );
          console.log(
            `[ShatteringTiles.tsx POOL_CREATE] sharedValues[${i}].opacity value: ${JSON.stringify(
              sharedValues[i].opacity
            )}`
          );
          if (typeof sharedValues[i].opacity === "undefined") {
            console.error(
              `[ShatteringTiles.tsx POOL_CREATE CRITICAL] sharedValues[${i}].opacity IS UNDEFINED! sharedValues[${i}] value: ${JSON.stringify(
                sharedValues[i]
              )}`
            );
          }
          if (
            sharedValues[i].opacity &&
            typeof sharedValues[i].opacity.value === "undefined"
          ) {
            console.error(
              `[ShatteringTiles.tsx POOL_CREATE CRITICAL] sharedValues[${i}].opacity.value IS UNDEFINED! sharedValues[${i}].opacity: ${JSON.stringify(
                sharedValues[i].opacity
              )}`
            );
          }
          // Comment out V7 throw in the pool creation loop
          /*
          if (i === 0) {
            const svType = typeof sharedValues[i];
            const svOpacityType = sharedValues[i] ? typeof sharedValues[i].opacity : 'sharedValues[i] is undefined';
            const svOpacityValueExists = sharedValues[i] && sharedValues[i].opacity ? 
                                           typeof sharedValues[i].opacity.value !== 'undefined' : 
                                           'sharedValues[i] or its opacity is undefined';
            throw new Error(
              `[POOL_CREATE V7 THROW i=${i}] ` +
              `sharedValues[i] type: ${svType}, ` +
              `sharedValues[i].opacity type: ${svOpacityType}, ` +
              `sharedValues[i].opacity.value exists: ${svOpacityValueExists}`
            );
          }
          */
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
            x: sharedValues[i].x,
            y: sharedValues[i].y,
            angle: sharedValues[i].angle,
            opacity: sharedValues[i].opacity,
            isActive: false,
          });
        }
      }
      tilePoolRef.current = pool;
    }
  }, [isMounted, windowWidth, windowHeight, sharedValues]);

  // Animation loop
  const updateMatter = useCallback(() => {
    if (!engineRef.current || !engineRef.current.world || !isMounted) {
      if (isMounted)
        animationFrameIdRef.current = requestAnimationFrame(updateMatter);
      return;
    }

    Matter.Engine.update(engineRef.current, FIXED_DELTA);

    let currentlyActiveInLoop = 0;
    let offScreenThisFrameCount = 0;

    tilePoolRef.current.forEach((tileState) => {
      if (tileState.isActive) {
        currentlyActiveInLoop++;
        tileState.x.value = tileState.body.position.x - TILE_SIZE / 2;
        tileState.y.value = tileState.body.position.y - TILE_SIZE / 2;
        tileState.angle.value = tileState.body.angle;

        if (
          tileState.body.position.y > windowHeight + OFF_SCREEN_THRESHOLD ||
          tileState.body.position.y < -OFF_SCREEN_THRESHOLD ||
          tileState.body.position.x < -OFF_SCREEN_THRESHOLD ||
          tileState.body.position.x > windowWidth + OFF_SCREEN_THRESHOLD
        ) {
          offScreenThisFrameCount++;
          tileState.isActive = false;
          Matter.Body.setStatic(tileState.body, true);
          Matter.Sleeping.set(tileState.body, true); // Ensure it goes to sleep
          // Fade out and then move off-screen via shared value if needed for visual cleanup
          tileState.opacity.value = withTiming(
            0,
            { duration: FADE_DURATION / 2 },
            (finished) => {
              if (finished) {
                runOnJS(Matter.Body.setPosition)(tileState.body, {
                  x: -1000,
                  y: -1000,
                });
                runOnJS(Matter.Body.setVelocity)(tileState.body, {
                  x: 0,
                  y: 0,
                });
                runOnJS(Matter.Body.setAngle)(tileState.body, 0);
                runOnJS(Matter.Body.setAngularVelocity)(tileState.body, 0);
              }
            }
          );
        }
      }
    });

    if (
      startAnimation && // only if animation was started
      activeTilesForCompletionRef.current > 0 &&
      currentlyActiveInLoop === 0 && // No tiles are active in the loop
      offScreenThisFrameCount > 0 // At least one tile went off-screen this frame to trigger completion
    ) {
      if (onAnimationComplete) {
        runOnJS(onAnimationComplete)();
      }
      activeTilesForCompletionRef.current = 0; // Reset for potential re-animations
    }
    if (isMounted) {
      animationFrameIdRef.current = requestAnimationFrame(updateMatter);
    }
  }, [
    isMounted,
    startAnimation,
    onAnimationComplete,
    windowWidth,
    windowHeight,
  ]); // Dependencies for useCallback

  // Start/Stop animation loop
  useEffect(() => {
    if (isMounted) {
      animationFrameIdRef.current = requestAnimationFrame(updateMatter);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isMounted, updateMatter]);

  // Effect to activate tiles based on props
  useEffect(() => {
    if (
      !isMounted ||
      !startAnimation ||
      !engineRef.current ||
      tilePoolRef.current.length === 0
    ) {
      return;
    }

    activeTilesForCompletionRef.current = 0;

    tiles.forEach((tileData, index) => {
      if (index < tilePoolRef.current.length) {
        const tileState = tilePoolRef.current[index];
        if (!tileState.isActive) {
          // Activate only if not already active
          tileState.data = tileData;
          tileState.isActive = true;
          activeTilesForCompletionRef.current++;

          Matter.Body.setStatic(tileState.body, false);
          Matter.Sleeping.set(tileState.body, false);
          Matter.Body.setPosition(tileState.body, {
            x: tileData.x,
            y: tileData.y,
          });

          const forceMagnitude = Platform.OS === "ios" ? 0.06 : 0.6;
          const angle = Math.random() * Math.PI * 2;
          const force = {
            x: Math.cos(angle) * forceMagnitude * tileState.body.mass,
            y: (Math.sin(angle) - 0.5) * forceMagnitude * tileState.body.mass,
          };
          Matter.Body.applyForce(
            tileState.body,
            tileState.body.position,
            force
          );
          Matter.Body.setAngularVelocity(
            tileState.body,
            (Math.random() - 0.5) * 0.2
          );

          // ---- V6 DIAGNOSTIC THROW (Now Commented Out) ----
          /*
          const tsType = typeof tileState;
          const opType = tileState ? typeof tileState.opacity : 'tileState is undefined';
          const opValueExists = tileState && tileState.opacity ? typeof tileState.opacity.value !== 'undefined' : 'tileState or opacity is undefined';
          throw new Error(
            `[ANIM_EFFECT V6] About to set opacity. ` +
            `tileState type: ${tsType}, tileState.opacity type: ${opType}, ` +
            `tileState.opacity.value exists: ${opValueExists}`
          );
          */
          // ---- END V6 DIAGNOSTIC THROW ----

          tileState.opacity.value = withTiming(1, { duration: 100 });
          tileState.x.value = tileData.x - TILE_SIZE / 2;
          tileState.y.value = tileData.y - TILE_SIZE / 2;
          tileState.angle.value = 0;
        }
      }
    });
  }, [isMounted, startAnimation, tiles]); // Rerun when tiles or startAnimation changes

  return (
    <View
      ref={sceneRef}
      style={globalStyles.fill}
      testID="shattering-tiles-container"
    >
      {tilePoolRef.current.map((tileState, index) => (
        <ShatteringTileItem
          key={tileState.id}
          tileState={tileState}
          index={index}
        />
      ))}
    </View>
  );
};

// New StyleSheet for inline styles
const internalStyles = StyleSheet.create({
  absoluteFill: {
    left: 0,
    position: "absolute",
    top: 0,
  },
});

export default ShatteringTiles;
