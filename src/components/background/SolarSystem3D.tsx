/**
 * @fileoverview Solar System 3D Component
 *
 * A three-dimensional interactive solar system background that renders
 * planets, moons, and a sun in a 3D space using React Three Fiber.
 * This component creates an immersive cosmic environment with realistic
 * orbital mechanics and texture-mapped celestial bodies.
 *
 * **Key Features:**
 * - Dynamic 3D solar system with realistic orbital mechanics
 * - Texture-mapped planets and moons with proper lighting
 * - Configurable orbital parameters and rotational speeds
 * - Optimized rendering for mobile performance
 * - Depth-based positioning for visual interest
 *
 * **Technical Implementation:**
 * - Uses @react-three/fiber for WebGL rendering
 * - Implements Three.js for 3D object manipulation
 * - Loads and applies textures to celestial bodies
 * - Calculates orbital paths with trigonometric functions
 * - Manages component lifecycle for optimal performance
 *
 * @author Qwordly Development Team
 * @version 1.1.0
 * @since 2024
 */

/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  Mesh,
  Group,
  TextureLoader,
  SphereGeometry,
  MeshPhongMaterial,
  AdditiveBlending,
} from "three";
import { Dimensions, View, StyleSheet } from "react-native";
import { SOLAR_SYSTEM_CONFIG } from "./SolarSystemConfig";
// Import texture assets
import sunTexturePath from "../../../assets/3d/tex_sun_spots_02.png";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Pre-defined geometries and materials for performance
const sunGeometry = new SphereGeometry(12.0, 16, 16);

/**
 * Sun component with enhanced size and brightness for dramatic effect.
 * Creates a self-rotating sun at the center of the solar system.
 *
 * @returns {JSX.Element} Rendered sun mesh with texture
 */
const Sun: React.FC = React.memo(() => {
  const sunRef = useRef<Mesh>(null);
  const sunTexture = useLoader(TextureLoader, sunTexturePath);

  const sunMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        map: sunTexture,
        emissive: 0xffa500,
        emissiveIntensity: 1.5,
        emissiveMap: sunTexture,
        transparent: true,
        blending: AdditiveBlending,
      }),
    [sunTexture]
  );

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.008;
      sunRef.current.rotation.x += 0.002;
    }
  });

  return (
    <mesh
      ref={sunRef}
      position={[0, 30, 0]}
      geometry={sunGeometry}
      material={sunMaterial}
    />
  );
});
Sun.displayName = "Sun";

/**
 * Interface for moon configuration properties.
 *
 * @property {number} size - Radius of the moon in arbitrary units
 * @property {number} distance - Orbital distance from parent planet
 * @property {number} orbitSpeed - Angular velocity of orbit
 * @property {number} color - Hexadecimal color value for the moon
 * @property {string} texture - Path to texture image for the moon
 * @property {number} startAngle - Initial orbital position in radians
 */
interface MoonProps {
  moonConfig: {
    size: number;
    distance: number;
    orbitSpeed: number;
    color: number;
    texture: string;
    startAngle: number;
  };
}

/**
 * Moon component that orbits around a parent planet.
 * Creates a textured moon that orbits its parent with configurable parameters.
 *
 * @param {MoonProps} props - Configuration properties for the moon
 * @returns {JSX.Element} Rendered moon mesh with orbital motion
 */
const Moon: React.FC<MoonProps> = React.memo(({ moonConfig }) => {
  const moonRef = useRef<Mesh>(null);
  const orbitTime = useRef(moonConfig.startAngle);
  const texture = useLoader(TextureLoader, moonConfig.texture);

  const moonGeometry = useMemo(
    () => new SphereGeometry(moonConfig.size * 1.4, 8, 8),
    [moonConfig.size]
  );
  const moonMaterial = useMemo(
    () => new MeshPhongMaterial({ map: texture, color: 0xffffff }),
    [texture]
  );

  useFrame(() => {
    orbitTime.current += moonConfig.orbitSpeed;

    if (moonRef.current) {
      const x = Math.cos(orbitTime.current) * moonConfig.distance;
      const z = Math.sin(orbitTime.current) * moonConfig.distance;
      const y = 0;

      moonRef.current.position.set(x, y, z);
      moonRef.current.rotation.y += 0.02;
    }
  });

  return <mesh ref={moonRef} geometry={moonGeometry} material={moonMaterial} />;
});
Moon.displayName = "Moon";

/**
 * Interface for planet configuration properties.
 *
 * @property {object} config - Planet configuration from SOLAR_SYSTEM_CONFIG
 */
interface PlanetProps {
  config: (typeof SOLAR_SYSTEM_CONFIG)[0];
}

/**
 * Planet component with orbital mechanics and moon system.
 * Creates a textured planet that orbits the sun and hosts its own moon system.
 *
 * @param {PlanetProps} props - Configuration properties for the planet
 * @returns {JSX.Element} Rendered planet group with orbital motion and moons
 */
const Planet: React.FC<PlanetProps> = React.memo(({ config }) => {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const orbitTime = useRef(config.startAngle);
  const planetTexture = useLoader(TextureLoader, config.texture);

  const planetGeometry = useMemo(
    () => new SphereGeometry(config.size, 16, 16),
    [config.size]
  );
  const planetMaterial = useMemo(
    () => new MeshPhongMaterial({ map: planetTexture }),
    [planetTexture]
  );

  useFrame(() => {
    orbitTime.current += config.orbitSpeed;

    if (groupRef.current) {
      const x = Math.cos(orbitTime.current) * config.distance;
      const z = Math.sin(orbitTime.current) * config.distance;
      const y = config.yPosition;

      groupRef.current.position.set(x, y, z);
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += config.rotationSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={planetGeometry} material={planetMaterial} />

      {config.moons.map((moonConfig, index) => (
        <Moon key={`${config.name}-moon-${index}`} moonConfig={moonConfig} />
      ))}
    </group>
  );
});
Planet.displayName = "Planet";

/**
 * Enhanced solar system scene with lighting and all celestial bodies.
 * Creates the complete solar system with sun, planets, and moons.
 *
 * @returns {JSX.Element} Rendered solar system scene with lighting
 */
const SolarSystemScene: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[0, 50, 0]}
        intensity={2.5}
        color={0xffffff}
      />
      <pointLight
        position={[0, 0, 0]}
        intensity={3.0}
        color={0xffa500}
        distance={300}
      />

      <Sun />

      {SOLAR_SYSTEM_CONFIG.map((planetConfig) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
};

/**
 * Main SolarSystem3D component that renders the 3D solar system.
 * Creates a full-screen canvas with the solar system scene and proper camera positioning.
 *
 * @returns {JSX.Element} Rendered solar system component
 */
const SolarSystem3D: React.FC = () => {
  const canvasStyle = useMemo(
    () => ({
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      position: "absolute" as const,
      top: 0,
      left: 0,
      zIndex: 1,
    }),
    []
  );

  const cameraConfig = useMemo(
    () => ({
      position: [0, 45, 350] as [number, number, number],
      fov: 60,
      near: 0.1,
      far: 1700,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={cameraConfig}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          camera.lookAt(0, 0, 0);
        }}
        frameloop="always"
      >
        <SolarSystemScene />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
});

export default React.memo(SolarSystem3D);
