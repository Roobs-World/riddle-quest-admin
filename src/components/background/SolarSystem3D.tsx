/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useRef, useMemo, Suspense, useCallback } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
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
import texGradientCircleSun from "../../../assets/3d/tex_gradient_circle_sun.png";

// Planet configuration with realistic proportions and orbit data
const PLANET_CONFIG = [
  {
    name: "Mercury",
    texture: texPlanetR,
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.06, // Increased for visible movement (fastest orbit)
    rotationSpeed: 0.01,
    color: 0x8c7853,
  },
  {
    name: "Venus",
    texture: texPlanetA,
    size: 0.7,
    distance: 6,
    orbitSpeed: 0.045, // Increased for visible movement
    rotationSpeed: 0.008,
    color: 0xffc649,
    moons: [{ texture: texMoonH, size: 0.2, distance: 1.5, orbitSpeed: 0.08 }],
  },
  {
    name: "Earth",
    texture: texPlanetD,
    size: 0.8,
    distance: 8,
    orbitSpeed: 0.035, // Increased for visible movement
    rotationSpeed: 0.02,
    color: 0x6b93d6,
    moons: [{ texture: texMoonF, size: 0.25, distance: 2, orbitSpeed: 0.06 }],
  },
  {
    name: "Mars",
    texture: texPlanetV,
    size: 0.6,
    distance: 11,
    orbitSpeed: 0.025, // Increased for visible movement
    rotationSpeed: 0.018,
    color: 0xcd5c5c,
    moons: [
      { texture: texMoonG, size: 0.15, distance: 1.8, orbitSpeed: 0.08 },
      { texture: texMoonD, size: 0.12, distance: 2.5, orbitSpeed: 0.05 },
    ],
  },
  {
    name: "Jupiter",
    texture: texPlanetK,
    size: 2.2,
    distance: 16,
    orbitSpeed: 0.015, // Increased for visible movement (slowest orbit)
    rotationSpeed: 0.04,
    color: 0xd8ca9d,
    rings: {
      texture: texRingA,
      innerRadius: 2.8,
      outerRadius: 4.2,
      opacity: 0.6,
    },
    moons: [{ texture: texMoonC, size: 0.3, distance: 3.5, orbitSpeed: 0.04 }],
  },
];

// Optimized geometry configurations - reduced complexity for performance
const GEOMETRY_CONFIG = {
  sun: { widthSegments: 24, heightSegments: 24 }, // Reduced from 32,32
  planet: { widthSegments: 16, heightSegments: 16 }, // Reduced from 24,24
  moon: { widthSegments: 12, heightSegments: 12 }, // Reduced from 16,16
  ring: { segments: 32 }, // Reduced from 64
};

// Corona component with billboard behavior - 6x the size of the sun
const Corona: React.FC = () => {
  const coronaRef = useRef<Mesh>(null);

  // Load corona texture
  const coronaTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircleSun).uri
  );

  // Enhanced pulsing animation effect for dramatic corona
  const animateCorona = useCallback((state: any) => {
    if (coronaRef.current) {
      // Add subtle pulsing effect with slower, more gentle movement
      const time = state.clock.getElapsedTime();
      const scale = 1 + Math.sin(time * 1.5) * 0.08; // Gentler pulsing
      const rotation = time * 0.5; // Slow rotation for dynamic effect

      coronaRef.current.scale.setScalar(scale);
      coronaRef.current.rotation.z = rotation;
    }
  }, []);

  useFrame(animateCorona);

  return (
    <Billboard>
      <mesh ref={coronaRef} position={[0, 0, 0]}>
        <planeGeometry args={[22, 22]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={0.8}
          blending={2} // AdditiveBlending
          depthWrite={false}
          side={2} // DoubleSide
          color={0xfff5e1} // Warm corona tint (255,245,225)
        />
      </mesh>
    </Billboard>
  );
};

// Sun component with optimized performance
const Sun: React.FC = () => {
  const sunRef = useRef<Mesh>(null);

  // Load texture with memoization
  const sunTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircleSunI).uri
  );

  // Optimized animation using useCallback
  const animateSun = useCallback(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.008;
    }
  }, []);

  useFrame(animateSun);

  // Memoized geometry
  const sunGeometry = useMemo(
    () =>
      [
        1.8,
        GEOMETRY_CONFIG.sun.widthSegments,
        GEOMETRY_CONFIG.sun.heightSegments,
      ] as const,
    []
  );

  return (
    <group>
      {/* Corona effect - rendered first for proper blending */}
      <Corona />

      {/* Main sun body */}
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={sunGeometry} />
        <meshPhongMaterial
          map={sunTexture}
          emissive={0xffdd00}
          emissiveIntensity={1.0}
          color={0xffff44}
        />
      </mesh>
    </group>
  );
};

// Moon component with performance optimizations
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
  const moonOrbitTime = useRef(Math.random() * Math.PI * 2); // Random starting position

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Optimized animation with proper orbital mechanics
  const animateMoon = useCallback(() => {
    // Update moon's orbital position around its planet
    moonOrbitTime.current += config.orbitSpeed;

    if (moonRef.current) {
      // Calculate moon's orbital position around the planet
      const x = Math.cos(moonOrbitTime.current) * config.distance;
      const z = Math.sin(moonOrbitTime.current) * config.distance;

      // Position moon relative to planet (planetPosition is [0,0,0] in new system)
      moonRef.current.position.set(x, 0, z);
    }

    if (meshRef.current) {
      // Moon rotation on its own axis
      meshRef.current.rotation.y += 0.02;
    }
  }, [config.orbitSpeed, config.distance]);

  useFrame(animateMoon);

  // Memoized geometry
  const moonGeometry = useMemo(
    () =>
      [
        config.size,
        GEOMETRY_CONFIG.moon.widthSegments,
        GEOMETRY_CONFIG.moon.heightSegments,
      ] as const,
    [config.size]
  );

  return (
    <group ref={moonRef} position={planetPosition}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={moonGeometry} />
        <meshPhongMaterial map={texture} shininess={20} specular={0x333333} />
      </mesh>
    </group>
  );
};

// Ring component with optimized geometry
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

  // Configure texture for ring with memoization
  useMemo(() => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }, [texture]);

  // Optimized animation with useCallback
  const animateRing = useCallback(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.002;
    }
  }, []);

  useFrame(animateRing);

  // Memoized geometry
  const ringGeometry = useMemo(
    () =>
      [
        config.innerRadius,
        config.outerRadius,
        GEOMETRY_CONFIG.ring.segments,
      ] as const,
    [config.innerRadius, config.outerRadius]
  );

  return (
    <mesh
      ref={ringRef}
      position={planetPosition}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={ringGeometry} />
      <meshPhongMaterial
        map={texture}
        transparent
        opacity={config.opacity}
        side={2} // DoubleSide
      />
    </mesh>
  );
};

// Planet component with proper Newtonian orbital mechanics
interface PlanetProps {
  config: (typeof PLANET_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = ({ config }) => {
  const planetGroupRef = useRef<Group>(null);
  const planetMeshRef = useRef<Mesh>(null);
  // Give each planet a random starting orbital position to spread them out
  const orbitTime = useRef(Math.random() * Math.PI * 2);

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Optimized animation with proper orbital mechanics
  const animatePlanet = useCallback(
    (state: any) => {
      // Update orbital position
      orbitTime.current += config.orbitSpeed;

      if (planetGroupRef.current) {
        // Calculate actual orbital position around the sun
        const x = Math.cos(orbitTime.current) * config.distance;
        const z = Math.sin(orbitTime.current) * config.distance;

        // Position the entire planet group (including moons and rings) in orbit
        planetGroupRef.current.position.set(x, 0, z);
      }

      if (planetMeshRef.current) {
        // Planet rotation on its own axis (separate from orbital motion)
        planetMeshRef.current.rotation.y += config.rotationSpeed;
      }
    },
    [config.orbitSpeed, config.rotationSpeed, config.distance]
  );

  useFrame(animatePlanet);

  // Memoized geometry
  const planetGeometry = useMemo(
    () =>
      [
        config.size,
        GEOMETRY_CONFIG.planet.widthSegments,
        GEOMETRY_CONFIG.planet.heightSegments,
      ] as const,
    [config.size]
  );

  return (
    <group ref={planetGroupRef}>
      {/* Planet at origin of this group (group position handles orbital motion) */}
      <mesh ref={planetMeshRef} position={[0, 0, 0]}>
        <sphereGeometry args={planetGeometry} />
        <meshPhongMaterial
          map={texture}
          color={config.color}
          shininess={30}
          specular={0x444444}
        />
      </mesh>

      {/* Rings positioned relative to planet */}
      {config.rings && (
        <Ring config={config.rings} planetPosition={[0, 0, 0]} />
      )}

      {/* Moons positioned relative to planet */}
      {config.moons?.map((moon, index) => (
        <Moon key={index} config={moon} planetPosition={[0, 0, 0]} />
      ))}
    </group>
  );
};

// Optimized camera controller with better viewing angle for orbital motion
const CameraController: React.FC = () => {
  const lastUpdate = useRef(0);
  const UPDATE_FREQUENCY = 1 / 30; // Update camera 30 times per second instead of 60

  const animateCamera = useCallback((state: any) => {
    const currentTime = state.clock.getElapsedTime();

    // Throttle camera updates for better performance
    if (currentTime - lastUpdate.current < UPDATE_FREQUENCY) {
      return;
    }

    lastUpdate.current = currentTime;

    // Optimized camera orbit that provides good view of planetary orbits
    const time = currentTime * 0.08; // Slightly slower camera movement
    const cameraDistance = 30; // Increased distance to see full orbital paths
    const heightVariation = 6; // Reduced height variation

    state.camera.position.x = Math.cos(time) * cameraDistance;
    state.camera.position.z = Math.sin(time) * cameraDistance;
    state.camera.position.y =
      Math.sin(currentTime * 0.03) * heightVariation + 15; // Higher camera position
    state.camera.lookAt(0, 0, 0); // Always look at the sun
  }, []);

  useFrame(animateCamera);
  return null;
};

// Enhanced lighting setup for dramatic planet illumination
const Lighting: React.FC = () => {
  return (
    <>
      {/* Enhanced ambient light for better overall visibility */}
      <ambientLight intensity={1.2} color={0x606090} />

      {/* Powerful main sun light - dramatically increased intensity */}
      <pointLight
        position={[0, 0, 0]}
        intensity={8}
        color={0xffddaa}
        distance={150}
        decay={0.8}
      />

      {/* Primary directional light for strong planet illumination */}
      <directionalLight
        position={[20, 20, 15]}
        intensity={2.0}
        color={0xffffff}
      />

      {/* Secondary directional light for balanced lighting */}
      <directionalLight
        position={[-15, 15, 10]}
        intensity={1.5}
        color={0xffffdd}
      />

      {/* Enhanced rim lighting for dramatic depth */}
      <directionalLight
        position={[-20, -15, -10]}
        intensity={1.2}
        color={0x9999ff}
      />

      {/* Side lighting to prevent dark sides */}
      <directionalLight
        position={[0, 10, 25]}
        intensity={1.0}
        color={0xffeedd}
      />

      {/* Back lighting for subtle glow */}
      <directionalLight
        position={[0, -5, -25]}
        intensity={0.8}
        color={0xddddff}
      />
    </>
  );
};

// Main Solar System Scene with memoization
const SolarSystemScene: React.FC = React.memo(() => {
  return (
    <>
      <Lighting />
      <CameraController />

      {/* Sun at center */}
      <Sun />

      {/* Planets with memoized rendering */}
      {PLANET_CONFIG.map((planetConfig, index) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
});
SolarSystemScene.displayName = "SolarSystemScene";

// Optimized loading fallback
const LoadingFallback: React.FC = React.memo(() => {
  return (
    <mesh>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={0x444444} wireframe />
    </mesh>
  );
});
LoadingFallback.displayName = "LoadingFallback";

// Main component with performance optimizations
const SolarSystem3D: React.FC = () => {
  // Memoized canvas style
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

  // Memoized camera configuration
  const cameraConfig = useMemo(
    () => ({
      position: [0, 12, 25] as [number, number, number],
      fov: 60,
      near: 0.1,
      far: 1000,
    }),
    []
  );

  // Memoized GL configuration
  const glConfig = useMemo(
    () => ({
      antialias: false, // Disabled for performance on mobile
      alpha: true,
      powerPreference: "high-performance" as const,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={cameraConfig}
        gl={glConfig}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // Transparent background
          gl.pixelRatio = Math.min(
            2,
            typeof window !== "undefined" ? window.devicePixelRatio : 1
          ); // Limit pixel ratio for performance
        }}
        frameloop="always" // Continuous rendering for animations
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

export default React.memo(SolarSystem3D);
