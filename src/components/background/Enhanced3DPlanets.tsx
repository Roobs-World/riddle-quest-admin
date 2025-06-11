import React, { useMemo } from "react";
import { View, Image, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Planet configuration with 3D texture mapping
interface Enhanced3DPlanet {
  id: number;
  name: string;
  centerX: number;
  centerY: number;
  orbitRadius: number;
  size: number;
  orbitSpeed: number;
  rotationSpeed: number;
  initialAngle: number;
  textureSource: any; // Image source for the planet texture
  hasMoons: boolean;
  moonTextures?: any[]; // Moon texture sources
  hasRings?: boolean;
  ringTexture?: any; // Ring texture source
}

const Enhanced3DPlanets: React.FC = () => {
  // Define planets using your actual 3D textures
  const planets = useMemo((): Enhanced3DPlanet[] => {
    const sunX = SCREEN_WIDTH * 0.85;
    const sunY = SCREEN_HEIGHT * 0.3;

    return [
      {
        id: 1,
        name: "Mercury",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 60,
        size: 16, // Increased size to show texture detail
        orbitSpeed: 0.02,
        rotationSpeed: 0.008,
        initialAngle: 0,
        textureSource: { uri: "file:///android_asset/3d/tex/tex_planet_r.png" }, // Grey/green planet
        hasMoons: false,
      },
      {
        id: 2,
        name: "Venus",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 85,
        size: 20,
        orbitSpeed: 0.015,
        rotationSpeed: 0.005,
        initialAngle: Math.PI / 3,
        textureSource: { uri: "file:///android_asset/3d/tex/tex_planet_v.png" }, // Blue planet with ring
        hasMoons: false,
        hasRings: true,
        ringTexture: { uri: "file:///android_asset/3d/tex/tex_ring_a.png" },
      },
      {
        id: 3,
        name: "Earth",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 120,
        size: 24,
        orbitSpeed: 0.01,
        rotationSpeed: 0.01,
        initialAngle: Math.PI,
        textureSource: { uri: "file:///android_asset/3d/tex/tex_planet_a.png" }, // Red planet with moon
        hasMoons: true,
        moonTextures: [{ uri: "file:///android_asset/3d/tex/tex_moon_h.png" }],
      },
      {
        id: 4,
        name: "Mars",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 160,
        size: 18,
        orbitSpeed: 0.008,
        rotationSpeed: 0.012,
        initialAngle: Math.PI * 1.5,
        textureSource: { uri: "file:///android_asset/3d/tex/tex_planet_d.png" }, // Large orange planet
        hasMoons: true,
        moonTextures: [
          { uri: "file:///android_asset/3d/tex/tex_moon_f.png" },
          { uri: "file:///android_asset/3d/tex/tex_moon_g.png" },
        ],
      },
      {
        id: 5,
        name: "Jupiter",
        centerX: sunX,
        centerY: sunY,
        orbitRadius: 220,
        size: 36,
        orbitSpeed: 0.005,
        rotationSpeed: 0.008,
        initialAngle: Math.PI / 6,
        textureSource: { uri: "file:///android_asset/3d/tex/tex_planet_k.png" }, // Green planet with ring
        hasMoons: true,
        moonTextures: [
          { uri: "file:///android_asset/3d/tex/tex_moon_c.png" },
          { uri: "file:///android_asset/3d/tex/tex_moon_d.png" },
        ],
        hasRings: true,
        ringTexture: { uri: "file:///android_asset/3d/tex/tex_ring_b.png" },
      },
    ];
  }, []);

  return (
    <View style={styles.container}>
      {planets.map((planet) => (
        <Enhanced3DPlanet key={planet.id} planet={planet} />
      ))}
    </View>
  );
};

interface Enhanced3DPlanetProps {
  planet: Enhanced3DPlanet;
}

const Enhanced3DPlanet: React.FC<Enhanced3DPlanetProps> = React.memo(
  ({ planet }) => {
    const orbit = useSharedValue(0);
    const rotation = useSharedValue(0);

    React.useEffect(() => {
      // Start orbital animation
      orbit.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: planet.orbitSpeed * 100000, // Convert to milliseconds
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Start rotation animation
      rotation.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: planet.rotationSpeed * 50000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
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

    const rotationProps = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${rotation.value}rad` }],
      };
    });

    return (
      <Animated.View style={[styles.planetContainer, animatedProps]}>
        {/* Rings (rendered behind planet) */}
        {planet.hasRings && planet.ringTexture && (
          <Image
            source={planet.ringTexture}
            style={[
              styles.ringImage,
              {
                width: planet.size * 2.5,
                height: planet.size * 2.5,
                left: -planet.size * 0.75,
                top: -planet.size * 0.75,
              },
            ]}
            resizeMode="contain"
          />
        )}

        {/* Planet with rotation and 3D texture */}
        <Animated.View style={rotationProps}>
          <Image
            source={planet.textureSource}
            style={[
              styles.planetImage,
              {
                width: planet.size,
                height: planet.size,
              },
            ]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Moons with 3D textures */}
        {planet.hasMoons && planet.moonTextures && (
          <>
            {planet.moonTextures.map((moonTexture, index) => (
              <Enhanced3DMoon
                key={`moon-${planet.id}-${index}`}
                planet={planet}
                moonIndex={index}
                moonTexture={moonTexture}
                orbit={orbit}
              />
            ))}
          </>
        )}
      </Animated.View>
    );
  }
);

interface Enhanced3DMoonProps {
  planet: Enhanced3DPlanet;
  moonIndex: number;
  moonTexture: any;
  orbit: Animated.SharedValue<number>;
}

const Enhanced3DMoon: React.FC<Enhanced3DMoonProps> = React.memo(
  ({ planet, moonIndex, moonTexture, orbit }) => {
    const moonOrbit = useSharedValue(0);
    const moonSize = Math.max(4, planet.size * 0.25);
    const moonDistance = planet.size * 1.5 + moonIndex * 8;

    React.useEffect(() => {
      moonOrbit.value = withRepeat(
        withTiming(2 * Math.PI, {
          duration: (12 + moonIndex * 4) * 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }, [moonOrbit, moonIndex]);

    const animatedProps = useAnimatedStyle(() => {
      // Planet position
      const planetAngle = orbit.value + planet.initialAngle;
      const planetX =
        planet.centerX + Math.cos(planetAngle) * planet.orbitRadius;
      const planetY =
        planet.centerY + Math.sin(planetAngle) * planet.orbitRadius;

      // Moon position relative to planet
      const moonAngle = moonOrbit.value + (moonIndex * Math.PI) / 2;
      const moonX = planetX + Math.cos(moonAngle) * moonDistance - moonSize / 2;
      const moonY = planetY + Math.sin(moonAngle) * moonDistance - moonSize / 2;

      return {
        transform: [{ translateX: moonX }, { translateY: moonY }],
      };
    });

    return (
      <Animated.View style={[styles.moonContainer, animatedProps]}>
        <Image
          source={moonTexture}
          style={[
            styles.moonImage,
            {
              width: moonSize,
              height: moonSize,
            },
          ]}
          resizeMode="cover"
        />
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  moonContainer: {
    position: "absolute",
  },
  moonImage: {
    borderRadius: 999,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  planetContainer: {
    position: "absolute",
  },
  planetImage: {
    borderRadius: 999, // Make it circular
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  ringImage: {
    opacity: 0.7,
    position: "absolute",
  },
});

export default Enhanced3DPlanets;
