/* eslint-disable react/no-unknown-property */
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Mesh, Group, TextureLoader } from "three";
import { Dimensions, View, StyleSheet } from "react-native";
import { SOLAR_SYSTEM_CONFIG } from "./SolarSystemConfig";
// Import texture assets
import sunTexture from "../../../assets/3d/tex_sun_spots_02.png";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Solar system configuration with 3D positioning
// 3D SOLAR SYSTEM - ONE TEXTURE PER PLANET:
// 1. Planets orbit with configurable Y positions for 3D depth
// 2. Different orbital distances for visual depth - ADJUSTED TO PREVENT COLLISIONS
// 3. All planets orbit in the same direction around the sun
// 4. Each planet uses a unique texture
// 5. Enhanced lighting to show planetary details
// 6. Orbital distances increased to prevent planet and moon collisions
// 7. Y positions create visual depth and separation between planetary orbits
// 8. All moon textures used for maximum visual variety and brightness

// Sun component with enhanced size and brightness for dramatic effect
const Sun: React.FC = () => {
  const sunRef = useRef<Mesh>(null);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.008;
      sunRef.current.rotation.x += 0.002;
    }
  });

  return (
    <mesh ref={sunRef} position={[0, 30, 0]}>
      <sphereGeometry args={[12.0, 24, 24]} />
      <meshBasicMaterial>
        <primitive object={useLoader(TextureLoader, sunTexture)} attach="map" />
      </meshBasicMaterial>
    </mesh>
  );
};

// Moon component with orbital ring system support
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

const Moon: React.FC<MoonProps> = ({ moonConfig }) => {
  const moonRef = useRef<Mesh>(null);
  const orbitTime = useRef(moonConfig.startAngle);

  // Load texture properly at component level
  const texture = useLoader(TextureLoader, moonConfig.texture);

  // Debug logging for moon creation
  console.log(
    `🌙 Creating moon with size: ${moonConfig.size}, distance: ${moonConfig.distance}`
  );

  useFrame(() => {
    // Update orbit time for smooth circular motion around parent planet
    orbitTime.current += moonConfig.orbitSpeed;

    if (moonRef.current) {
      // Circular orbit calculation around parent planet (NOT the sun)
      // The moon's position is relative to its parent planet's position
      const x = Math.cos(orbitTime.current) * moonConfig.distance;
      const z = Math.sin(orbitTime.current) * moonConfig.distance;
      const y = 0; // Same Y level as parent planet

      // Set position for circular orbit around parent planet
      moonRef.current.position.set(x, y, z);
      moonRef.current.rotation.y += 0.02; // Moon self-rotation
    }
  });

  return (
    <mesh ref={moonRef}>
      {/* Balanced size multiplier for optimal visibility and proportions */}
      <sphereGeometry args={[moonConfig.size * 1.4, 16, 16]} />
      <meshStandardMaterial
        map={texture}
        color={0xffffff}
        emissive={0x666666}
        emissiveIntensity={0.8}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
};

// Planet component with orbital ring system
interface PlanetProps {
  config: (typeof SOLAR_SYSTEM_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = ({ config }) => {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const orbitTime = useRef(config.startAngle);

  useFrame(() => {
    // Update orbit time for smooth circular motion
    orbitTime.current += config.orbitSpeed;

    if (groupRef.current) {
      // Circular orbit with configurable Y position for 3D depth
      const x = Math.cos(orbitTime.current) * config.distance;
      const z = Math.sin(orbitTime.current) * config.distance;
      const y = config.yPosition; // Use configurable Y position

      // Set position for circular orbit with depth variation
      groupRef.current.position.set(x, y, z);
    }

    // Update planet self-rotation
    if (meshRef.current) {
      meshRef.current.rotation.y += config.rotationSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[config.size, 8, 8]} />
        <meshBasicMaterial>
          <primitive
            object={useLoader(TextureLoader, config.texture)}
            attach="map"
          />
        </meshBasicMaterial>
      </mesh>

      {/* Moons orbiting the planet */}
      {config.moons.map((moonConfig, index) => (
        <Moon key={`${config.name}-moon-${index}`} moonConfig={moonConfig} />
      ))}
    </group>
  );
};

// Enhanced solar system scene with single plane lighting
const SolarSystemScene: React.FC = () => {
  console.log("🌌 Rendering single plane solar system with enhanced lighting");

  // Count total moons for debugging
  const totalMoons = SOLAR_SYSTEM_CONFIG.reduce(
    (count, planet) => count + planet.moons.length,
    0
  );
  console.log(`🌙 Total moons in solar system: ${totalMoons}`);

  return (
    <>
      {/* Enhanced lighting for single plane orbital system */}
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

      {/* Sun at center with enhanced brightness */}
      <Sun />

      {/* All planets in single orbital plane */}
      {SOLAR_SYSTEM_CONFIG.map((planetConfig) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
};

const SolarSystem3D: React.FC = () => {
  console.log(
    "🟢 SolarSystem3D component is rendering single plane solar system"
  );

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

  // Enhanced camera configuration for single plane orbital view
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

          console.log(
            "✅ Single plane solar system canvas created successfully"
          );
          console.log("📷 Camera position:", camera.position);
          console.log("🎯 Camera looking at sun position [0, 0, 0]");
          console.log(
            "🪐 Solar system now contains",
            SOLAR_SYSTEM_CONFIG.length,
            "celestial bodies in single orbital plane"
          );
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
