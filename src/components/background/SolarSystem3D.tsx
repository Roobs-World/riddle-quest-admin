/* eslint-disable react/no-unknown-property */
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Mesh, Group, TextureLoader } from "three";
import { Dimensions, View, StyleSheet } from "react-native";

// Import texture assets
import sunTexture from "../../../assets/3d/tex_sun_spots_02.png";
import planetATexture from "../../../assets/3d/tex_planet_a.png";
import planetVTexture from "../../../assets/3d/tex_planet_v.png";
import planetDTexture from "../../../assets/3d/tex_planet_d.png";
import planetRTexture from "../../../assets/3d/tex_planet_r.png";
import planetKTexture from "../../../assets/3d/tex_planet_k.png";
import moonCTexture from "../../../assets/3d/tex_moon_c.png";
import moonDTexture from "../../../assets/3d/tex_moon_d.png";
import moonFTexture from "../../../assets/3d/tex_moon_f.png";
import moonGTexture from "../../../assets/3d/tex_moon_g.png";
import moonHTexture from "../../../assets/3d/tex_moon_h.png";

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
const SOLAR_SYSTEM_CONFIG = [
  // Inner rocky planets - increased distances for better spacing
  {
    name: "Mercury",
    size: 2.2,
    distance: 18, // Increased from 15
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    texture: planetATexture,
    startAngle: 0,
    yPosition: 15, // Earth's plane
    moons: [],
  },
  {
    name: "Venus",
    size: 3.0,
    distance: 26, // Increased from 20
    orbitSpeed: 0.018,
    rotationSpeed: 0.008,
    color: 0xffd700,
    texture: planetVTexture,
    startAngle: Math.PI / 3,
    yPosition: 15, // Slightly below Earth's plane
    moons: [],
  },
  {
    name: "Earth",
    size: 3.5,
    distance: 30, // Increased from 25
    orbitSpeed: 0.015,
    rotationSpeed: 0.02,
    color: 0x4169e1,
    texture: planetDTexture,
    startAngle: (Math.PI * 2) / 3,
    yPosition: 15, // Main orbital plane
    moons: [
      {
        size: 1, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.06,
        color: 0xc0c0c0,
        texture: moonFTexture,
        startAngle: 0,
      },
    ],
  },
  {
    name: "Mars",
    size: 2.6,
    distance: 35, // Increased from 32
    orbitSpeed: 0.015,
    rotationSpeed: 0.015,
    color: 0xcd5c5c,
    texture: planetRTexture,
    startAngle: Math.PI,
    yPosition: 13, // Above Earth's plane
    moons: [
      {
        size: 0.8, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.08,
        color: 0x8b7355,
        texture: moonCTexture,
        startAngle: 0,
      },
    ],
  },

  // Gas giants - increased distances for better spacing
  {
    name: "Jupiter",
    size: 10.0,
    distance: 70, // Increased from 55
    orbitSpeed: 0.004,
    rotationSpeed: 0.025,
    color: 0xdaa520,
    texture: planetKTexture,
    startAngle: Math.PI * 1.2,
    yPosition: 15, // Further below Earth's plane for depth
    moons: [
      {
        size: 1.3, // Balanced size for visibility
        distance: 13, // Further increased orbital distance
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        texture: moonHTexture,
        startAngle: 0,
      },
      {
        size: 1, // Balanced size for visibility
        distance: 11.5, // Further increased orbital distance with more separation
        orbitSpeed: 0.032,
        color: 0xc0c0c0,
        texture: moonFTexture,
        startAngle: Math.PI / 3,
      },
    ],
  },
  {
    name: "Saturn",
    size: 8.5,
    distance: 90, // Increased from 70
    orbitSpeed: 0.005,
    rotationSpeed: 0.022,
    color: 0xffd700,
    texture: moonCTexture,
    startAngle: Math.PI * 1.7,
    yPosition: 15, // Above Earth's plane for depth
    moons: [
      {
        size: 2.0, // Balanced size for visibility
        distance: 12, // Further increased orbital distance
        orbitSpeed: 0.038,
        color: 0xc0c0c0,
        texture: moonDTexture,
        startAngle: 0,
      },
      {
        size: 1.6, // Balanced size for visibility
        distance: 12, // Further increased orbital distance with more separation
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        texture: moonHTexture,
        startAngle: Math.PI / 2,
      },
    ],
  },

  // Ice giants - increased distance for better spacing
  {
    name: "Uranus",
    size: 7.0,
    distance: 150, // Increased from 85
    orbitSpeed: 0.004,
    rotationSpeed: 0.018,
    color: 0x4fd0e3,
    texture: moonGTexture,
    startAngle: Math.PI * 0.3,
    yPosition: 15, // Slight deviation below Earth's plane
    moons: [],
  },
];

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
    <mesh ref={sunRef} position={[0, 15, 0]}>
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
      <meshLambertMaterial
        map={texture}
        color={moonConfig.color}
        emissive={0x333333}
        emissiveIntensity={0.2}
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
      position: [0, 45, 150] as [number, number, number],
      fov: 60,
      near: 0.1,
      far: 700,
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
