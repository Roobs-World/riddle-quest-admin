import React, { useMemo, useCallback } from "react";
import {
  View,
  Dimensions,
  StyleSheet,
  ImageSourcePropType,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle,
  Ellipse,
  LinearGradient,
} from "react-native-svg";
import { COLORS } from "../../styles";
import {
  PLANET_TEXTURES,
  MOON_TEXTURES,
  RING_TEXTURES,
  SUN_TEXTURES,
} from "../../constants/planetTextures";

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

interface Planet {
  id: number;
  name: string;
  centerX: number;
  centerY: number;
  orbitRadius: number;
  size: number;
  color: string;
  orbitSpeed: number;
  initialAngle: number;
  hasMoons: boolean;
  moonCount?: number;
  gradientId: string;
  textureColors: string[];
  rotationSpeed?: number;
  hasRings?: boolean;
  // 3D Texture support
  textureImage?: ImageSourcePropType; // Planet texture asset
  moonTextures?: ImageSourcePropType[]; // Moon texture assets
  ringTexture?: ImageSourcePropType; // Ring texture asset
  use3DTextures?: boolean; // Enable/disable 3D textures
}

interface Comet {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay: number;
  tailLength: number;
}

interface AnimatedStarProps {
  star: Star;
}

interface AnimatedPlanetProps {
  planet: Planet;
}

interface AnimatedCometProps {
  comet: Comet;
}

const styles = StyleSheet.create({
  animatedAsteroidContainer: {
    position: "absolute",
  },
  animatedCometContainer: {
    position: "absolute",
  },
  animatedMoonContainer: {
    position: "absolute",
  },
  animatedPlanetContainer: {
    position: "absolute",
  },
  animatedSaturnRingsSvg: {
    position: "absolute",
  },
  animatedSunContainer: {
    position: "absolute",
  },
  bottomGradient: {
    backgroundColor: COLORS.starryBackgroundBottom,
    bottom: 0,
    height: "50%",
    left: 0,
    opacity: 0.2,
    position: "absolute",
    right: 0,
  },
  container: {
    backgroundColor: COLORS.starryBackgroundMain,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  gradientOverlay: {
    backgroundColor: COLORS.transparent,
    bottom: 0,
    left: 0,
    opacity: 0.3,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2,
  },
  star: {
    backgroundColor: COLORS.starColor,
    elevation: 5,
    position: "absolute",
    shadowColor: COLORS.starColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  starsContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
  svgAbsolute: {
    position: "absolute",
  },
  svgContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  topGradient: {
    backgroundColor: COLORS.starryBackgroundTop,
    height: "50%",
    left: 0,
    opacity: 0.2,
    position: "absolute",
    right: 0,
    top: 0,
  },
});

const SolarSystemBackground: React.FC = () => {
  // Generate star pool with object pooling (only 20 stars for optimal performance)
  const stars = useMemo(() => {
    const STAR_POOL_SIZE = 20; // Optimal pool size for performance
    const generatedStars: Star[] = [];

    for (let i = 0; i < STAR_POOL_SIZE; i++) {
      generatedStars.push({
        id: i,
        initialX: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 3 + 1, // Star size between 1-4
        opacity: Math.random() * 0.7 + 0.3, // Opacity between 0.3-1
        animationDuration: Math.random() * 4000 + 2000, // Twinkle duration 2-6s
        animationDelay: Math.random() * 5000, // Random start delay
        movementSpeed: Math.random() * 40 + 25, // Movement speed
        movementDirection: Math.random() * 360, // Random direction in degrees
        movementRadius: Math.random() * 25 + 15, // Movement radius 15-40 pixels
      });
    }

    return generatedStars;
  }, []);

  // Generate planets with realistic textured appearances and rotation
  const planets = useMemo(() => {
    const sunX = SCREEN_WIDTH * 0.85; // Position sun towards the right
    const sunY = SCREEN_HEIGHT * 0.3; // Position sun in upper area

    const planetData: Planet[] = [
      // Mercury - rocky, cratered surface (using 3D texture)
      {
        id: 1,
        name: "Mercury",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 60,
        size: 16, // Increased size to show texture detail
        color: "#8C7853",
        orbitSpeed: 15, // Fast orbit
        rotationSpeed: 8, // Slow rotation
        initialAngle: 0,
        hasMoons: false,
        gradientId: "mercuryGradient",
        textureColors: ["#8C7853", "#6B5B42", "#A89068", "#7A6B4F"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.mercury,
      },
      // Venus - thick atmosphere, yellowish (using 3D texture with rings)
      {
        id: 2,
        name: "Venus",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 85,
        size: 20, // Increased size to show texture detail
        color: "#FFC649",
        orbitSpeed: 25,
        rotationSpeed: 12, // Slow rotation (Venus rotates slowly)
        initialAngle: Math.PI / 3,
        hasMoons: false,
        hasRings: true,
        gradientId: "venusGradient",
        textureColors: ["#FFC649", "#FFD700", "#F4A460", "#DAA520"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.venus,
        ringTexture: RING_TEXTURES.ring_a,
      },
      // Earth - blue oceans, green/brown land (using 3D texture with moon)
      {
        id: 3,
        name: "Earth",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 120,
        size: 24, // Increased size to show texture detail
        color: "#6B93D6",
        orbitSpeed: 40,
        rotationSpeed: 6, // 24-hour rotation
        initialAngle: Math.PI,
        hasMoons: true,
        moonCount: 1,
        gradientId: "earthGradient",
        textureColors: ["#6B93D6", "#4682B4", "#228B22", "#8B4513"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.earth,
        moonTextures: [MOON_TEXTURES.moon_a_h],
      },
      // Mars - red surface with polar caps (using 3D texture with 2 moons)
      {
        id: 4,
        name: "Mars",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 160,
        size: 18, // Increased size to show texture detail
        color: "#CD5C5C",
        orbitSpeed: 60,
        rotationSpeed: 6.5, // Similar to Earth
        initialAngle: Math.PI * 1.5,
        hasMoons: true,
        moonCount: 2,
        gradientId: "marsGradient",
        textureColors: ["#CD5C5C", "#A0522D", "#D2691E", "#B22222"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.mars,
        moonTextures: [MOON_TEXTURES.moon_d_f, MOON_TEXTURES.moon_d_g],
      },
      // Jupiter - gas giant with bands (using 3D texture with rings and 2 moons)
      {
        id: 5,
        name: "Jupiter",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 220,
        size: 36, // Largest planet - increased size to show texture detail
        color: "#D8CA9D",
        orbitSpeed: 120,
        rotationSpeed: 4, // Fast rotation (10-hour day)
        initialAngle: Math.PI / 6,
        hasMoons: true,
        moonCount: 2, // Updated to match available moon textures
        hasRings: true,
        gradientId: "jupiterGradient",
        textureColors: ["#D8CA9D", "#DEB887", "#F4A460", "#CD853F"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.jupiter,
        moonTextures: [MOON_TEXTURES.moon_k_c, MOON_TEXTURES.moon_k_d],
        ringTexture: RING_TEXTURES.ring_b, // Large ring system
      },
      // Saturn - ringed gas giant (using Venus planet texture with prominent rings)
      {
        id: 6,
        name: "Saturn",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 280,
        size: 28, // Increased size for ring detail
        color: "#FAD5A5",
        orbitSpeed: 180,
        rotationSpeed: 4.5, // Fast rotation like Jupiter
        initialAngle: Math.PI / 2,
        hasMoons: true,
        moonCount: 3,
        hasRings: true,
        gradientId: "saturnGradient",
        textureColors: ["#FAD5A5", "#E6C791", "#D4AF7A", "#C19A6B"],
        // 3D texture integration
        use3DTextures: true,
        textureImage: PLANET_TEXTURES.venus, // Venus texture for Saturn
        ringTexture: RING_TEXTURES.ring_a, // Prominent ring system
        moonTextures: [], // Keep as SVG for now
      },
    ];

    return planetData;
  }, []);

  // Generate enhanced asteroids with variety
  const asteroids = useMemo(() => {
    const asteroidCount = 20; // Increased count
    const sunX = SCREEN_WIDTH * 0.85;
    const sunY = SCREEN_HEIGHT * 0.3;
    const generatedAsteroids: Planet[] = [];

    for (let i = 0; i < asteroidCount; i++) {
      const asteroidType = Math.floor(Math.random() * 3); // Three types of asteroids
      const baseColors = [
        ["#8B7355", "#696969", "#A0522D"], // Rocky
        ["#696969", "#808080", "#5F5F5F"], // Metallic
        ["#8B4513", "#A0522D", "#CD853F"], // Clay-rich
      ];

      generatedAsteroids.push({
        id: i + 100,
        name: `Asteroid${i}`,
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 190 + Math.random() * 40, // Between Mars and Jupiter, wider spread
        size: Math.random() * 4 + 2, // Varied sizes 2-6
        color: baseColors[asteroidType][0],
        orbitSpeed: 90 + Math.random() * 30,
        rotationSpeed: 2 + Math.random() * 8, // Varied rotation speeds
        initialAngle: (Math.PI * 2 * i) / asteroidCount,
        hasMoons: false,
        gradientId: `asteroidGradient${i}`,
        textureColors: baseColors[asteroidType],
      });
    }

    return generatedAsteroids;
  }, []);

  // Generate comets for occasional streaking effects
  const comets = useMemo(() => {
    const cometCount = 3;
    const generatedComets: Comet[] = [];

    for (let i = 0; i < cometCount; i++) {
      const startSide = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let startX, startY, endX, endY;

      switch (startSide) {
        case 0: // From top
          startX = Math.random() * SCREEN_WIDTH;
          startY = -50;
          endX = Math.random() * SCREEN_WIDTH;
          endY = SCREEN_HEIGHT + 50;
          break;
        case 1: // From right
          startX = SCREEN_WIDTH + 50;
          startY = Math.random() * SCREEN_HEIGHT;
          endX = -50;
          endY = Math.random() * SCREEN_HEIGHT;
          break;
        case 2: // From bottom
          startX = Math.random() * SCREEN_WIDTH;
          startY = SCREEN_HEIGHT + 50;
          endX = Math.random() * SCREEN_WIDTH;
          endY = -50;
          break;
        default: // From left
          startX = -50;
          startY = Math.random() * SCREEN_HEIGHT;
          endX = SCREEN_WIDTH + 50;
          endY = Math.random() * SCREEN_HEIGHT;
          break;
      }

      generatedComets.push({
        id: i,
        startX,
        startY,
        endX,
        endY,
        duration: 8000 + Math.random() * 4000, // 8-12 seconds
        delay: Math.random() * 30000 + 10000, // Start after 10-40 seconds
        tailLength: 30 + Math.random() * 20, // Tail length 30-50
      });
    }

    return generatedComets;
  }, []);

  return (
    <View style={styles.container}>
      {/* 2D Background stars */}
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <AnimatedStar key={star.id} star={star} />
        ))}
      </View>

      {/* SVG-based textured planets and celestial bodies */}
      <View style={styles.svgContainer}>
        <Svg
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          style={styles.svgAbsolute}
        >
          <Defs>
            {/* Planet gradients for realistic textures */}
            {planets.map((planet) => (
              <RadialGradient
                key={planet.gradientId}
                id={planet.gradientId}
                cx="35%"
                cy="35%"
                r="65%"
                fx="25%"
                fy="25%"
              >
                <Stop
                  offset="0%"
                  stopColor={planet.textureColors[0]}
                  stopOpacity="1"
                />
                <Stop
                  offset="30%"
                  stopColor={planet.textureColors[1]}
                  stopOpacity="0.95"
                />
                <Stop
                  offset="60%"
                  stopColor={planet.textureColors[2]}
                  stopOpacity="0.85"
                />
                <Stop
                  offset="100%"
                  stopColor={planet.textureColors[3]}
                  stopOpacity="0.6"
                />
              </RadialGradient>
            ))}

            {/* Enhanced Sun gradient with solar flares */}
            <RadialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFACD" stopOpacity="1" />
              <Stop offset="30%" stopColor="#FFFF99" stopOpacity="0.95" />
              <Stop offset="60%" stopColor="#FDB813" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FF8C00" stopOpacity="0.7" />
            </RadialGradient>

            {/* Saturn rings gradient */}
            <LinearGradient
              id="saturnRingsGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop
                offset="0%"
                stopColor="rgba(200, 200, 200, 0)"
                stopOpacity="0"
              />
              <Stop
                offset="20%"
                stopColor="rgba(220, 220, 220, 0.6)"
                stopOpacity="0.6"
              />
              <Stop
                offset="40%"
                stopColor="rgba(180, 180, 180, 0.4)"
                stopOpacity="0.4"
              />
              <Stop
                offset="60%"
                stopColor="rgba(200, 200, 200, 0.7)"
                stopOpacity="0.7"
              />
              <Stop
                offset="80%"
                stopColor="rgba(160, 160, 160, 0.5)"
                stopOpacity="0.5"
              />
              <Stop
                offset="100%"
                stopColor="rgba(200, 200, 200, 0)"
                stopOpacity="0"
              />
            </LinearGradient>

            {/* Comet gradient for tail effect */}
            <LinearGradient
              id="cometGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop offset="0%" stopColor="#87CEEB" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#B0E0E6" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#F0F8FF" stopOpacity="0.1" />
            </LinearGradient>

            {/* Enhanced asteroid gradients */}
            {asteroids.map((asteroid) => (
              <RadialGradient
                key={asteroid.gradientId}
                id={asteroid.gradientId}
                cx="40%"
                cy="40%"
                r="60%"
              >
                <Stop
                  offset="0%"
                  stopColor={asteroid.textureColors[0]}
                  stopOpacity="1"
                />
                <Stop
                  offset="50%"
                  stopColor={asteroid.textureColors[1]}
                  stopOpacity="0.8"
                />
                <Stop
                  offset="100%"
                  stopColor={asteroid.textureColors[2]}
                  stopOpacity="0.6"
                />
              </RadialGradient>
            ))}
          </Defs>

          {/* Render enhanced Sun */}
          <AnimatedSun />

          {/* Render comets */}
          {comets.map((comet) => (
            <AnimatedComet key={comet.id} comet={comet} />
          ))}

          {/* Render enhanced asteroids */}
          {asteroids.map((asteroid) => (
            <AnimatedAsteroid key={asteroid.id} asteroid={asteroid} />
          ))}

          {/* Render rotating planets */}
          {planets.map((planet) => (
            <AnimatedPlanet key={planet.id} planet={planet} />
          ))}
        </Svg>
      </View>

      {/* Gradient overlay for atmosphere effect */}
      <View style={styles.gradientOverlay}>
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />
      </View>
    </View>
  );
};

// Object-pooled animated star component with recycling
/* eslint-disable react/prop-types */
const AnimatedStar: React.FC<AnimatedStarProps> = React.memo(({ star }) => {
  // Twinkle animation
  const twinkle = useSharedValue(0);
  // Movement animation (using circular motion for smooth continuous movement)
  const movement = useSharedValue(0);
  // Star lifecycle animation for pooling
  const lifecycle = useSharedValue(0);

  // Generate new random properties for star recycling
  const generateNewStarProperties = useCallback((): Star => {
    return {
      id: star.id, // Keep the same ID for pooling
      initialX: Math.random() * SCREEN_WIDTH,
      initialY: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.7 + 0.3,
      animationDuration: Math.random() * 4000 + 2000,
      animationDelay: Math.random() * 2000, // New random delay for recycled star
      movementSpeed: Math.random() * 40 + 25,
      movementDirection: Math.random() * 360,
      movementRadius: Math.random() * 25 + 15,
    };
  }, [star.id]);

  // Current star properties (will update for pooling)
  const [currentProps, setCurrentProps] = React.useState(star);

  // Star recycling system - creates infinite star field effect with only 20 stars
  const startStarCycle = useCallback(() => {
    // Reset animations
    twinkle.value = 0;
    movement.value = 0;
    lifecycle.value = 0;

    // Start lifecycle animation (30-60 seconds per star cycle)
    const cycleDuration = 30000 + Math.random() * 30000;

    lifecycle.value = withTiming(
      1,
      {
        duration: cycleDuration,
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) {
          // Recycle star with new properties
          runOnJS(() => {
            setCurrentProps(generateNewStarProperties());
            startStarCycle();
          })();
        }
      }
    );

    // Twinkle animation (continuous during lifecycle)
    twinkle.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: currentProps.animationDuration / 2,
          easing: Easing.ease,
        }),
        withTiming(0, {
          duration: currentProps.animationDuration / 2,
          easing: Easing.ease,
        })
      ),
      -1, // Repeat forever during lifecycle
      false
    );

    // Circular movement animation (continuous during lifecycle)
    movement.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: currentProps.movementSpeed * 1000,
        easing: Easing.linear,
      }),
      -1, // Repeat forever during lifecycle
      false
    );
  }, [currentProps, generateNewStarProperties, twinkle, movement, lifecycle]);

  // Initialize star cycle
  React.useEffect(() => {
    // Add random initial delay to spread out star recycling
    const initialDelay = Math.random() * 10000;
    const timer = setTimeout(() => {
      startStarCycle();
    }, initialDelay);

    return () => clearTimeout(timer);
  }, [startStarCycle]);

  // Animated style for twinkle, movement, and lifecycle
  const animatedStyle = useAnimatedStyle(() => {
    // Use circular motion for smooth, continuous movement
    const angle =
      movement.value + (currentProps.movementDirection * Math.PI) / 180;
    const moveX = Math.cos(angle) * currentProps.movementRadius;
    const moveY = Math.sin(angle) * currentProps.movementRadius;

    // Enhanced twinkle effect on opacity and size
    const twinkleOpacity = interpolate(
      twinkle.value,
      [0, 1],
      [currentProps.opacity * 0.4, currentProps.opacity]
    );

    // Lifecycle fade (fade in at start, fade out at end)
    const lifecycleOpacity = interpolate(
      lifecycle.value,
      [0, 0.1, 0.9, 1],
      [0, 1, 1, 0]
    );

    const finalOpacity = twinkleOpacity * lifecycleOpacity;
    const scale = interpolate(twinkle.value, [0, 1], [0.7, 1.3]);

    return {
      opacity: finalOpacity,
      transform: [
        { translateX: currentProps.initialX + moveX },
        { translateY: currentProps.initialY + moveY },
        { scale },
      ],
    };
  });

  const starStyle = [
    styles.star,
    {
      width: currentProps.size,
      height: currentProps.size,
      borderRadius: currentProps.size / 2,
      shadowRadius: currentProps.size * 1.5,
    },
    animatedStyle,
  ];

  return <Animated.View style={starStyle} />;
});
/* eslint-enable react/prop-types */

// Enhanced Animated Sun component with more realistic effects
const AnimatedSun: React.FC = () => {
  const sunGlow = useSharedValue(0);
  const sunFlare = useSharedValue(0);
  const sunX = SCREEN_WIDTH * 0.85;
  const sunY = SCREEN_HEIGHT * 0.3;
  const sunSize = 32; // Slightly larger

  React.useEffect(() => {
    // Main glow animation
    sunGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    // Solar flare animation (faster)
    sunFlare.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [sunGlow, sunFlare]);

  const animatedProps = useAnimatedStyle(() => {
    const glowIntensity = interpolate(sunGlow.value, [0, 1], [0.85, 1.25]);
    const flareIntensity = interpolate(sunFlare.value, [0, 1], [1, 1.15]);
    const scale =
      interpolate(sunGlow.value, [0, 1], [1, 1.08]) * flareIntensity;

    return {
      transform: [{ scale }],
      opacity: glowIntensity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.animatedSunContainer,
        { left: sunX - sunSize / 2, top: sunY - sunSize / 2 },
        animatedProps,
      ]}
    >
      {/* Enhanced sun with 3D texture and glow effects */}
      <Image
        source={SUN_TEXTURES.sunGlow}
        style={{
          width: sunSize * 1.5, // Larger glow layer
          height: sunSize * 1.5,
          position: "absolute",
          top: -sunSize * 0.25,
          left: -sunSize * 0.25,
          opacity: 0.6,
        }}
        resizeMode="contain"
      />
      <Image
        source={SUN_TEXTURES.sun}
        style={{
          width: sunSize,
          height: sunSize,
          borderRadius: sunSize / 2, // Make circular
        }}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

// Enhanced Animated Planet component with rotation and Saturn rings
/* eslint-disable react/prop-types */
const AnimatedPlanet: React.FC<AnimatedPlanetProps> = React.memo(
  ({ planet }) => {
    const orbit = useSharedValue(0);
    const rotation = useSharedValue(0);

    React.useEffect(() => {
      // Orbital motion
      orbit.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: planet.orbitSpeed * 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Planet rotation
      if (planet.rotationSpeed) {
        rotation.value = withRepeat(
          withTiming(2 * Math.PI, {
            duration: planet.rotationSpeed * 1000,
            easing: Easing.linear,
          }),
          -1,
          false
        );
      }
    }, [orbit, rotation, planet.orbitSpeed, planet.rotationSpeed]);

    const animatedProps = useAnimatedStyle(() => {
      const angle = orbit.value + planet.initialAngle;
      const x =
        planet.centerX + Math.cos(angle) * planet.orbitRadius - planet.size / 2;
      const y =
        planet.centerY + Math.sin(angle) * planet.orbitRadius - planet.size / 2;

      return {
        transform: [{ translateX: x }, { translateY: y }],
      };
    });

    // Animated style for planet rotation
    const rotationProps = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${rotation.value}rad` }],
      };
    });

    return (
      <Animated.View style={[styles.animatedPlanetContainer, animatedProps]}>
        {/* Rings (rendered behind planet) - supports both 3D textures and SVG fallback */}
        {planet.hasRings &&
          (planet.use3DTextures && planet.ringTexture ? (
            // Use 3D ring texture if available
            <Image
              source={planet.ringTexture}
              style={[
                styles.animatedSaturnRingsSvg,
                {
                  width: planet.size * 2.5,
                  height: planet.size * 2.5,
                  left: -planet.size * 0.75,
                  top: -planet.size * 0.75,
                  opacity: 0.8,
                },
              ]}
              resizeMode="contain"
            />
          ) : (
            // Fallback to SVG rings
            <Svg
              width={planet.size * 2.5}
              height={planet.size * 2.5}
              style={[
                styles.animatedSaturnRingsSvg,
                { left: -planet.size * 0.75, top: -planet.size * 0.75 },
              ]}
            >
              <Ellipse
                cx={(planet.size * 2.5) / 2}
                cy={(planet.size * 2.5) / 2}
                rx={planet.size * 1.2}
                ry={planet.size * 0.3}
                fill="url(#saturnRingsGradient)"
                stroke="#C0C0C0"
                strokeWidth="0.5"
                strokeOpacity="0.3"
              />
              <Ellipse
                cx={(planet.size * 2.5) / 2}
                cy={(planet.size * 2.5) / 2}
                rx={planet.size * 1.0}
                ry={planet.size * 0.25}
                fill="none"
                stroke="#A0A0A0"
                strokeWidth="0.3"
                strokeOpacity="0.6"
              />
            </Svg>
          ))}

        {/* Planet with rotation - supports both 3D textures and SVG fallback */}
        <Animated.View style={rotationProps}>
          {planet.use3DTextures && planet.textureImage ? (
            // Use 3D texture if available
            <Image
              source={planet.textureImage}
              style={{
                width: planet.size,
                height: planet.size,
                borderRadius: planet.size / 2, // Make circular
              }}
              resizeMode="cover"
            />
          ) : (
            // Fallback to SVG gradient
            <Svg width={planet.size} height={planet.size}>
              <Circle
                cx={planet.size / 2}
                cy={planet.size / 2}
                r={planet.size / 2}
                fill={`url(#${planet.gradientId})`}
                stroke={planet.color}
                strokeWidth="0.5"
                strokeOpacity="0.6"
              />
            </Svg>
          )}
        </Animated.View>

        {/* Moons */}
        {planet.hasMoons && planet.moonCount && (
          <>
            {Array.from({ length: planet.moonCount }, (_, index) => (
              <AnimatedMoon
                key={`moon-${planet.id}-${index}`}
                planet={planet}
                moonIndex={index}
                orbit={orbit}
              />
            ))}
          </>
        )}
      </Animated.View>
    );
  }
);
/* eslint-enable react/prop-types */

// Animated Moon component
/* eslint-disable react/prop-types */
const AnimatedMoon: React.FC<{
  planet: Planet;
  moonIndex: number;
  orbit: Animated.SharedValue<number>;
}> = React.memo(({ planet, moonIndex, orbit }) => {
  const moonOrbit = useSharedValue(0);
  const moonSize = Math.max(2, planet.size * 0.3);
  const moonDistance = planet.size * 1.8 + moonIndex * 10; // Increased distance

  React.useEffect(() => {
    moonOrbit.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: (12 + moonIndex * 4) * 1000, // Different speeds for each moon
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [moonOrbit, moonIndex]);

  const animatedProps = useAnimatedStyle(() => {
    // Planet position
    const planetAngle = orbit.value + planet.initialAngle;
    const planetX = planet.centerX + Math.cos(planetAngle) * planet.orbitRadius;
    const planetY = planet.centerY + Math.sin(planetAngle) * planet.orbitRadius;

    // Moon position relative to planet
    const moonAngle = moonOrbit.value + (moonIndex * Math.PI) / 2;
    const moonX = planetX + Math.cos(moonAngle) * moonDistance - moonSize / 2;
    const moonY = planetY + Math.sin(moonAngle) * moonDistance - moonSize / 2;

    return {
      transform: [{ translateX: moonX }, { translateY: moonY }],
    };
  });

  // Get moon texture if available
  const moonTexture =
    planet.use3DTextures &&
    planet.moonTextures &&
    planet.moonTextures[moonIndex]
      ? planet.moonTextures[moonIndex]
      : null;

  return (
    <Animated.View style={[styles.animatedMoonContainer, animatedProps]}>
      {moonTexture ? (
        // Use 3D moon texture if available
        <Image
          source={moonTexture}
          style={{
            width: moonSize,
            height: moonSize,
            borderRadius: moonSize / 2, // Make circular
          }}
          resizeMode="cover"
        />
      ) : (
        // Fallback to SVG moon
        <Svg width={moonSize} height={moonSize}>
          <Circle
            cx={moonSize / 2}
            cy={moonSize / 2}
            r={moonSize / 2}
            fill="#C0C0C0"
            stroke="#A9A9A9"
            strokeWidth="0.3"
          />
        </Svg>
      )}
    </Animated.View>
  );
});
/* eslint-enable react/prop-types */

// New Animated Comet component
/* eslint-disable react/prop-types */
const AnimatedComet: React.FC<AnimatedCometProps> = React.memo(({ comet }) => {
  const cometProgress = useSharedValue(0);

  React.useEffect(() => {
    // Start comet animation after delay
    cometProgress.value = withDelay(
      comet.delay,
      withRepeat(
        withTiming(1, {
          duration: comet.duration,
          easing: Easing.out(Easing.quad),
        }),
        -1, // Repeat forever
        false
      )
    );
  }, [cometProgress, comet.delay, comet.duration]);

  const animatedProps = useAnimatedStyle(() => {
    const progress = cometProgress.value;

    // Comet position
    const x = interpolate(progress, [0, 1], [comet.startX, comet.endX]);
    const y = interpolate(progress, [0, 1], [comet.startY, comet.endY]);

    // Fade in and out
    const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 0.8, 0.8, 0]);

    return {
      transform: [{ translateX: x }, { translateY: y }],
      opacity,
    };
  });

  // Calculate tail direction
  const dx = comet.endX - comet.startX;
  const dy = comet.endY - comet.startY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <Animated.View style={[styles.animatedCometContainer, animatedProps]}>
      <Svg width={comet.tailLength} height={8}>
        {/* Comet tail */}
        <Ellipse
          cx={comet.tailLength / 2}
          cy={4}
          rx={comet.tailLength / 2}
          ry={2}
          fill="url(#cometGradient)"
          transform={`rotate(${angle} ${comet.tailLength / 2} 4)`}
        />
        {/* Comet head */}
        <Circle
          cx={comet.tailLength - 4}
          cy={4}
          r={2}
          fill="#87CEEB"
          stroke="#B0E0E6"
          strokeWidth="0.5"
        />
      </Svg>
    </Animated.View>
  );
});
/* eslint-enable react/prop-types */

// Enhanced Animated Asteroid component with rotation
/* eslint-disable react/prop-types */
const AnimatedAsteroid: React.FC<{ asteroid: Planet }> = React.memo(
  ({ asteroid }) => {
    const orbit = useSharedValue(0);
    const rotation = useSharedValue(0);

    React.useEffect(() => {
      // Orbital motion
      orbit.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: asteroid.orbitSpeed * 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Asteroid rotation (tumbling effect)
      if (asteroid.rotationSpeed) {
        rotation.value = withRepeat(
          withTiming(2 * Math.PI, {
            duration: asteroid.rotationSpeed * 1000,
            easing: Easing.linear,
          }),
          -1,
          false
        );
      }
    }, [orbit, rotation, asteroid.orbitSpeed, asteroid.rotationSpeed]);

    const animatedProps = useAnimatedStyle(() => {
      const angle = orbit.value + asteroid.initialAngle;
      const x =
        asteroid.centerX +
        Math.cos(angle) * asteroid.orbitRadius -
        asteroid.size / 2;
      const y =
        asteroid.centerY +
        Math.sin(angle) * asteroid.orbitRadius -
        asteroid.size / 2;

      return {
        transform: [
          { translateX: x },
          { translateY: y },
          { rotate: `${rotation.value}rad` },
        ],
        opacity: 0.7, // Slightly more visible
      };
    });

    return (
      <Animated.View style={[styles.animatedAsteroidContainer, animatedProps]}>
        <Svg width={asteroid.size} height={asteroid.size}>
          <Circle
            cx={asteroid.size / 2}
            cy={asteroid.size / 2}
            r={asteroid.size / 2}
            fill={`url(#${asteroid.gradientId})`}
            stroke={asteroid.color}
            strokeWidth="0.3"
            strokeOpacity="0.5"
          />
        </Svg>
      </Animated.View>
    );
  }
);
/* eslint-enable react/prop-types */

AnimatedStar.displayName = "AnimatedStar";
AnimatedSun.displayName = "AnimatedSun";
AnimatedPlanet.displayName = "AnimatedPlanet";
AnimatedMoon.displayName = "AnimatedMoon";
AnimatedComet.displayName = "AnimatedComet";
AnimatedAsteroid.displayName = "AnimatedAsteroid";

export default SolarSystemBackground;
