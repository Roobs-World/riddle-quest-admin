/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader, Mesh, Group, RepeatWrapping } from "three";
import { Dimensions, View, StyleSheet } from "react-native";
import { Asset } from "expo-asset";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Import texture assets
import texPlanetA from "../../../assets/3d/tex_planet_a.png";
import texPlanetD from "../../../assets/3d/tex_planet_d.png";
import texPlanetK from "../../../assets/3d/tex_planet_k.png";
import texPlanetR from "../../../assets/3d/tex_planet_r.png";
import texPlanetV from "../../../assets/3d/tex_planet_v.png";
import texMoonC from "../../../assets/3d/tex_moon_c.png";
import texMoonD from "../../../assets/3d/tex_moon_d.png";
import texMoonF from "../../../assets/3d/tex_moon_f.png";
import texMoonG from "../../../assets/3d/tex_moon_g.png";
import texMoonH from "../../../assets/3d/tex_moon_h.png";
import texRingA from "../../../assets/3d/tex_ring_a.png";

import texGradientCircle from "../../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSunI from "../../../assets/3d/tex_gradient_circle_sun_i.png";

// Planet configuration with realistic proportions and orbit data
const PLANET_CONFIG = [
  {
    name: "Mercury",
    texture: texPlanetR,
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.024,
    rotationSpeed: 0.01,
    color: 0x8c7853,
  },
  {
    name: "Venus",
    texture: texPlanetA,
    size: 0.7,
    distance: 6,
    orbitSpeed: 0.015,
    rotationSpeed: 0.008,
    color: 0xffc649,
    moons: [{ texture: texMoonH, size: 0.2, distance: 1.5, orbitSpeed: 0.05 }],
  },
  {
    name: "Earth",
    texture: texPlanetD,
    size: 0.8,
    distance: 8,
    orbitSpeed: 0.01,
    rotationSpeed: 0.02,
    color: 0x6b93d6,
    moons: [{ texture: texMoonF, size: 0.25, distance: 2, orbitSpeed: 0.03 }],
  },
  {
    name: "Mars",
    texture: texPlanetV,
    size: 0.6,
    distance: 11,
    orbitSpeed: 0.008,
    rotationSpeed: 0.018,
    color: 0xcd5c5c,
    moons: [
      { texture: texMoonG, size: 0.15, distance: 1.8, orbitSpeed: 0.04 },
      { texture: texMoonD, size: 0.12, distance: 2.5, orbitSpeed: 0.025 },
    ],
  },
  {
    name: "Jupiter",
    texture: texPlanetK,
    size: 2.2,
    distance: 16,
    orbitSpeed: 0.004,
    rotationSpeed: 0.04,
    color: 0xd8ca9d,
    rings: {
      texture: texRingA,
      innerRadius: 2.8,
      outerRadius: 4.2,
      opacity: 0.6,
    },
    moons: [{ texture: texMoonC, size: 0.3, distance: 3.5, orbitSpeed: 0.02 }],
  },
];

// Sun component
const Sun: React.FC = () => {
  const sunRef = useRef<Mesh>(null);
  const innerCoronaRef = useRef<Mesh>(null);
  const outerCoronaRef = useRef<Mesh>(null);

  // Load the correct textures for different layers
  const sunTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircleSunI).uri
  );
  const coronaTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircle).uri
  );

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.008;
    }
    if (innerCoronaRef.current) {
      innerCoronaRef.current.rotation.z += 0.003;
    }
    if (outerCoronaRef.current) {
      outerCoronaRef.current.rotation.z -= 0.001;
    }
  });

  return (
    <group>
      {/* Main sun body - brighter and more prominent */}
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshPhongMaterial
          map={sunTexture}
          emissive={0xffdd00}
          emissiveIntensity={1.0}
          color={0xffff44}
        />
      </mesh>

      {/* Simple sun glow effect */}
      <mesh ref={innerCoronaRef} position={[0, 0, 0]} scale={[2.8, 2.8, 2.8]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={0.3}
          color={0xffaa00}
          blending={2} // AdditiveBlending
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={outerCoronaRef} position={[0, 0, 0]} scale={[4.2, 4.2, 4.2]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={0.15}
          color={0xff8800}
          blending={2} // AdditiveBlending
        />
      </mesh>
    </group>
  );
};

// Moon component
interface MoonProps {
  config: {
    texture: any;
    size: number;
    distance: number;
    orbitSpeed: number;
  };
  planetPosition: [number, number, number];
}

const Moon: React.FC<MoonProps> = ({ config, planetPosition }) => {
  const moonRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  useFrame((state) => {
    if (moonRef.current) {
      moonRef.current.rotation.y += config.orbitSpeed;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group ref={moonRef} position={planetPosition}>
      <mesh ref={meshRef} position={[config.distance, 0, 0]}>
        <sphereGeometry args={[config.size, 16, 16]} />
        <meshPhongMaterial map={texture} />
      </mesh>
    </group>
  );
};

// Ring component
interface RingProps {
  config: {
    texture: any;
    innerRadius: number;
    outerRadius: number;
    opacity: number;
  };
  planetPosition: [number, number, number];
}

const Ring: React.FC<RingProps> = ({ config, planetPosition }) => {
  const ringRef = useRef<Mesh>(null);
  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Configure texture for ring
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.002;
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={planetPosition}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[config.innerRadius, config.outerRadius, 64]} />
      <meshPhongMaterial
        map={texture}
        transparent
        opacity={config.opacity}
        side={2} // DoubleSide
      />
    </mesh>
  );
};

// Planet component
interface PlanetProps {
  config: (typeof PLANET_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = ({ config }) => {
  const planetGroupRef = useRef<Group>(null);
  const planetMeshRef = useRef<Mesh>(null);
  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  useFrame((state) => {
    if (planetGroupRef.current) {
      // Orbit around sun
      planetGroupRef.current.rotation.y += config.orbitSpeed;
    }
    if (planetMeshRef.current) {
      // Planet rotation
      planetMeshRef.current.rotation.y += config.rotationSpeed;
    }
  });

  const planetPosition: [number, number, number] = [config.distance, 0, 0];

  return (
    <group ref={planetGroupRef}>
      {/* Planet */}
      <mesh ref={planetMeshRef} position={planetPosition}>
        <sphereGeometry args={[config.size, 24, 24]} />
        <meshPhongMaterial map={texture} color={config.color} />
      </mesh>

      {/* Rings */}
      {config.rings && (
        <Ring config={config.rings} planetPosition={planetPosition} />
      )}

      {/* Moons */}
      {config.moons?.map((moon, index) => (
        <Moon key={index} config={moon} planetPosition={planetPosition} />
      ))}
    </group>
  );
};

// Camera controller for dynamic movement
const CameraController: React.FC = () => {
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Gentle camera orbit
    state.camera.position.x = Math.cos(time * 0.1) * 25;
    state.camera.position.z = Math.sin(time * 0.1) * 25;
    state.camera.position.y = Math.sin(time * 0.05) * 8 + 12;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

// Lighting setup
const Lighting: React.FC = () => {
  return (
    <>
      {/* Increased ambient light for better overall visibility */}
      <ambientLight intensity={0.6} color={0x404080} />

      {/* Enhanced main sun light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={4}
        color={0xffddaa}
        distance={120}
        decay={1.5}
      />

      {/* Additional strong directional lights for depth */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.2}
        color={0xffffff}
      />

      {/* Enhanced rim lighting */}
      <directionalLight
        position={[-10, -10, -5]}
        intensity={0.8}
        color={0x8888ff}
      />

      {/* Additional side lighting for better planet illumination */}
      <directionalLight
        position={[0, 0, 20]}
        intensity={0.6}
        color={0xffffaa}
      />

      {/* Back lighting to prevent complete darkness on far side */}
      <directionalLight
        position={[0, 0, -20]}
        intensity={0.4}
        color={0xaaaaff}
      />
    </>
  );
};

// Main Solar System Scene
const SolarSystemScene: React.FC = () => {
  return (
    <>
      <Lighting />
      <CameraController />

      {/* Sun at center */}
      <Sun />

      {/* Planets */}
      {PLANET_CONFIG.map((planetConfig, index) => (
        <Planet key={index} config={planetConfig} />
      ))}
    </>
  );
};

// Loading fallback
const LoadingFallback: React.FC = () => {
  return (
    <mesh>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={0x444444} wireframe />
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

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={{
          position: [0, 12, 25],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // Transparent background
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SolarSystemScene />
        </Suspense>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
});

export default SolarSystem3D;
