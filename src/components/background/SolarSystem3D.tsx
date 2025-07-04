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

// Solar system configuration with textures
const SOLAR_SYSTEM_CONFIG = [
  {
    name: "Mercury",
    size: 0.8,
    distance: 6,
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    texture: planetATexture,
    startAngle: 0,
    moon: {
      size: 0.15,
      distance: 1.5,
      orbitSpeed: 0.08,
      color: 0x888888,
      texture: moonCTexture,
    },
  },
  {
    name: "Venus",
    size: 1.2,
    distance: 8,
    orbitSpeed: 0.015,
    rotationSpeed: 0.008,
    color: 0xffd700,
    texture: planetVTexture,
    startAngle: Math.PI / 3,
    moon: {
      size: 0.2,
      distance: 2.0,
      orbitSpeed: 0.06,
      color: 0x999999,
      texture: moonDTexture,
    },
  },
  {
    name: "Earth",
    size: 1.4,
    distance: 10,
    orbitSpeed: 0.012,
    rotationSpeed: 0.02,
    color: 0x4169e1,
    texture: planetDTexture,
    startAngle: (2 * Math.PI) / 3,
    moon: {
      size: 0.3,
      distance: 2.5,
      orbitSpeed: 0.05,
      color: 0xc0c0c0,
      texture: moonFTexture,
    },
  },
  {
    name: "Mars",
    size: 1.0,
    distance: 12,
    orbitSpeed: 0.008,
    rotationSpeed: 0.015,
    color: 0xcd5c5c,
    texture: planetRTexture,
    startAngle: Math.PI,
    moon: {
      size: 0.18,
      distance: 1.8,
      orbitSpeed: 0.07,
      color: 0x777777,
      texture: moonGTexture,
    },
  },
  {
    name: "Jupiter",
    size: 2.2,
    distance: 15,
    orbitSpeed: 0.005,
    rotationSpeed: 0.025,
    color: 0xdaa520,
    texture: planetKTexture,
    startAngle: Math.PI * 1.5,
    moon: {
      size: 0.4,
      distance: 3.5,
      orbitSpeed: 0.04,
      color: 0xaaaaaa,
      texture: moonHTexture,
    },
  },
];

// Sun component with texture loading
const Sun: React.FC = () => {
  const sunRef = useRef<Mesh>(null);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.005;
    }
  });

  return (
    <mesh ref={sunRef} position={[0, 0, 0]}>
      <sphereGeometry args={[5.5, 32, 32]} />
      <meshBasicMaterial>
        <primitive object={useLoader(TextureLoader, sunTexture)} attach="map" />
      </meshBasicMaterial>
    </mesh>
  );
};

// Moon component with texture loading
interface MoonProps {
  moonConfig: (typeof SOLAR_SYSTEM_CONFIG)[0]["moon"];
}

const Moon: React.FC<MoonProps> = ({ moonConfig }) => {
  const moonRef = useRef<Mesh>(null);
  const orbitTime = useRef(0);

  useFrame(() => {
    orbitTime.current += moonConfig.orbitSpeed;
    if (moonRef.current) {
      const x = Math.cos(orbitTime.current) * moonConfig.distance;
      const z = Math.sin(orbitTime.current) * moonConfig.distance;
      moonRef.current.position.set(x, 0, z);
      moonRef.current.rotation.y += 0.02;
    }
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[moonConfig.size, 16, 16]} />
      <meshBasicMaterial>
        <primitive
          object={useLoader(TextureLoader, moonConfig.texture)}
          attach="map"
        />
      </meshBasicMaterial>
    </mesh>
  );
};

// Planet component with texture loading
interface PlanetProps {
  config: (typeof SOLAR_SYSTEM_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = ({ config }) => {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const orbitTime = useRef(config.startAngle);

  useFrame(() => {
    // Update orbit
    orbitTime.current += config.orbitSpeed;
    if (groupRef.current) {
      const x = Math.cos(orbitTime.current) * config.distance;
      const z = Math.sin(orbitTime.current) * config.distance;
      groupRef.current.position.set(x, 0, z);
    }

    // Update rotation
    if (meshRef.current) {
      meshRef.current.rotation.y += config.rotationSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[config.size, 20, 20]} />
        <meshBasicMaterial>
          <primitive
            object={useLoader(TextureLoader, config.texture)}
            attach="map"
          />
        </meshBasicMaterial>
      </mesh>

      {/* Moon orbiting the planet */}
      <Moon moonConfig={config.moon} />
    </group>
  );
};

// Solar system scene
const SolarSystemScene: React.FC = () => {
  console.log("🌌 Rendering solar system with texture support prepared");

  return (
    <>
      {/* Bright ambient light */}
      <ambientLight intensity={1.5} />

      {/* Sun at center */}
      <Sun />

      {/* All planets */}
      {SOLAR_SYSTEM_CONFIG.map((planetConfig) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
};

const SolarSystem3D: React.FC = () => {
  console.log("🟢 SolarSystem3D component is rendering");

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
      position: [0, 0, 60] as [number, number, number],
      fov: 75,
      near: 0.1,
      far: 100,
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

          console.log("✅ Canvas created successfully");
          console.log("📷 Camera position:", camera.position);
          console.log("🎯 Camera looking at solar system center");
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
