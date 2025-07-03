/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */
import React, { useRef, useMemo, Suspense } from "react";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { TextureLoader, Mesh, Group } from "three";
import { Dimensions, View, StyleSheet } from "react-native";
import { Asset } from "expo-asset";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Import texture assets
import texSunSpots from "../../../assets/3d/tex_sun_spots_02.png";

// Simplified planet configuration
const SIMPLE_PLANET_CONFIG = [
  {
    name: "Mercury",
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    startAngle: 0,
  },
  {
    name: "Venus",
    size: 0.7,
    distance: 6,
    orbitSpeed: 0.015,
    rotationSpeed: 0.008,
    color: 0xffc649,
    startAngle: Math.PI / 3,
  },
  {
    name: "Earth",
    size: 0.8,
    distance: 8,
    orbitSpeed: 0.012,
    rotationSpeed: 0.02,
    color: 0x6b93d6,
    startAngle: (2 * Math.PI) / 3,
  },
  {
    name: "Mars",
    size: 0.6,
    distance: 10,
    orbitSpeed: 0.008,
    rotationSpeed: 0.015,
    color: 0xcd5c5c,
    startAngle: Math.PI,
  },
];

// Simplified texture loader
const useSimpleTexture = (textureAsset: number | string) => {
  const textureUri = useMemo(() => {
    try {
      const asset = Asset.fromModule(textureAsset);
      return asset.localUri || asset.uri || String(textureAsset);
    } catch (error) {
      console.warn("Failed to load texture asset:", error);
      return String(textureAsset);
    }
  }, [textureAsset]);

  try {
    const texture = useLoader(TextureLoader, textureUri);
    return texture;
  } catch (error) {
    console.warn("Failed to load texture:", error);
    return null;
  }
};

// Simple Sun component
const SimpleSun: React.FC = () => {
  const sunRef = useRef<Mesh>(null);
  const sunTexture = useSimpleTexture(texSunSpots);

  console.log(
    "☀️ SimpleSun rendering, texture:",
    sunTexture ? "loaded" : "null"
  );

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.005;
    }
  });

  return (
    <mesh ref={sunRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshPhongMaterial
        map={sunTexture}
        color={0xffaa00}
        emissive={0xffaa00}
        emissiveIntensity={0.5}
      />
    </mesh>
  );
};

// Simple Planet component
interface SimplePlanetProps {
  config: (typeof SIMPLE_PLANET_CONFIG)[0];
}

const SimplePlanet: React.FC<SimplePlanetProps> = ({ config }) => {
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
        <sphereGeometry args={[config.size, 8, 8]} />
        <meshBasicMaterial color={config.color} />
      </mesh>
    </group>
  );
};

// Test cube to verify 3D rendering
const TestCube: React.FC = () => {
  const cubeRef = useRef<Mesh>(null);

  console.log(
    "🔴 TestCube rendering - this should be visible as a red wireframe cube"
  );

  useFrame(() => {
    if (cubeRef.current) {
      cubeRef.current.rotation.x += 0.01;
      cubeRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={cubeRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshBasicMaterial color={0xff0000} wireframe />
    </mesh>
  );
};

// Simple scene component
const SimpleScene: React.FC = () => {
  console.log("🌌 SimpleScene rendering...");
  console.log("🪐 Planet config:", SIMPLE_PLANET_CONFIG);

  return (
    <>
      {/* Basic lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={1} />

      {/* Test cube - should be visible if 3D is working */}
      <TestCube />

      {/* Sun */}
      <SimpleSun />

      {/* Planets */}
      {SIMPLE_PLANET_CONFIG.map((config) => {
        console.log(
          "🪐 Rendering planet:",
          config.name,
          "at distance:",
          config.distance
        );
        return <SimplePlanet key={config.name} config={config} />;
      })}
    </>
  );
};

// Loading fallback
const LoadingFallback: React.FC = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={0x444444} />
    </mesh>
  );
};

// Main component
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
      position: [0, 15, 25] as [number, number, number], // Closer camera position
      fov: 75,
      near: 0.1,
      far: 100,
    }),
    []
  );

  const glConfig = useMemo(
    () => ({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance" as const,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={cameraConfig}
        gl={glConfig}
        onCreated={({ gl, camera }) => {
          // Set clear color to transparent
          gl.setClearColor(0x000000, 0);

          // Reduce pixel ratio for better performance
          gl.setPixelRatio(
            Math.min(
              1,
              typeof window !== "undefined" ? window.devicePixelRatio : 1
            )
          );

          // Disable shadows for simplicity
          gl.shadowMap.enabled = false;

          // Set camera to look at origin
          camera.lookAt(0, 0, 0);

          console.log("✅ Canvas created successfully");
          console.log("📷 Camera position:", camera.position);
          console.log("📐 Canvas size:", gl.getSize(new THREE.Vector2()));
          console.log("🎯 Scene setup complete");
        }}
        frameloop="always"
      >
        <Suspense fallback={<LoadingFallback />}>
          <SimpleScene />
        </Suspense>
      </Canvas>
    </View>
  );
};

const COLORS = {
  TRANSPARENT: "transparent",
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.TRANSPARENT,
    bottom: 0,
    left: 0,
    position: "absolute" as const,
    right: 0,
    top: 0,
    zIndex: 1,
  },
});

export default SolarSystem3D;
