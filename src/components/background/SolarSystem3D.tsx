/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/prop-types */
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
import texRingB from "../../../assets/3d/tex_ring_b.png";

// Sun and corona textures
import texSunSpots from "../../../assets/3d/tex_sun_spots_02.png";
import texGradientCircle from "../../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSunI from "../../../assets/3d/tex_gradient_circle_sun_i.png";
import texGradientCircleSun from "../../../assets/3d/tex_gradient_circle_sun.png";

// Optimized planet configuration with simplified orbital mechanics
const PLANET_CONFIG = [
  {
    name: "Mercury",
    texture: texPlanetR,
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    startAngle: 0,
  },
  {
    name: "Venus",
    texture: texPlanetA,
    size: 0.7,
    distance: 6.5,
    orbitSpeed: 0.016,
    rotationSpeed: 0.008,
    color: 0xffc649,
    startAngle: Math.PI / 4,
    moons: [
      {
        texture: texMoonH,
        size: 0.2,
        distance: 2.2,
        orbitSpeed: 0.025,
        startAngle: 0,
      },
    ],
  },
  {
    name: "Earth",
    texture: texPlanetK,
    size: 0.8,
    distance: 8.5,
    orbitSpeed: 0.012,
    rotationSpeed: 0.02,
    color: 0x6b93d6,
    startAngle: Math.PI / 2,
    moons: [
      {
        texture: texMoonF,
        size: 0.25,
        distance: 2.5,
        orbitSpeed: 0.02,
        startAngle: Math.PI,
      },
    ],
  },
  {
    name: "Mars",
    texture: texPlanetD,
    size: 0.6,
    distance: 12,
    orbitSpeed: 0.009,
    rotationSpeed: 0.018,
    color: 0xcd5c5c,
    startAngle: (3 * Math.PI) / 4,
    moons: [
      {
        texture: texMoonG,
        size: 0.15,
        distance: 2.2,
        orbitSpeed: 0.025,
        startAngle: 0,
      },
      {
        texture: texMoonD,
        size: 0.12,
        distance: 3.2,
        orbitSpeed: 0.018,
        startAngle: Math.PI,
      },
    ],
  },
  {
    name: "Jupiter",
    texture: texPlanetV,
    size: 2.2,
    distance: 18,
    orbitSpeed: 0.007,
    rotationSpeed: 0.04,
    color: 0xd8ca9d,
    startAngle: Math.PI,
    rings: {
      texture: texRingA,
      innerRadius: 2.6,
      outerRadius: 3.8,
      opacity: 0.6,
    },
    moons: [
      {
        texture: texMoonC,
        size: 0.3,
        distance: 4.5,
        orbitSpeed: 0.015,
        startAngle: Math.PI / 2,
      },
    ],
  },
  {
    name: "Saturn",
    texture: texPlanetR,
    size: 1.9,
    distance: 29,
    orbitSpeed: 0.005,
    rotationSpeed: 0.035,
    color: 0xfad5a5,
    startAngle: (5 * Math.PI) / 4,
    rings: {
      texture: texRingB,
      innerRadius: 2.0,
      outerRadius: 3.8,
      opacity: 0.8,
    },
    moons: [
      {
        texture: texMoonC,
        size: 0.28,
        distance: 5.0,
        orbitSpeed: 0.012,
        startAngle: 0,
      },
      {
        texture: texMoonD,
        size: 0.22,
        distance: 6.0,
        orbitSpeed: 0.008,
        startAngle: (2 * Math.PI) / 3,
      },
    ],
  },
  {
    name: "Uranus",
    texture: texPlanetR,
    size: 1.6,
    distance: 36,
    orbitSpeed: 0.004,
    rotationSpeed: 0.025,
    color: 0x4fd0e3,
    startAngle: (3 * Math.PI) / 2,
    rings: {
      texture: texRingA,
      innerRadius: 1.8,
      outerRadius: 2.8,
      opacity: 0.4,
    },
    moons: [
      {
        texture: texMoonG,
        size: 0.18,
        distance: 3.5,
        orbitSpeed: 0.018,
        startAngle: Math.PI / 3,
      },
    ],
  },
  {
    name: "Neptune",
    texture: texPlanetA,
    size: 1.5,
    distance: 42,
    orbitSpeed: 0.003,
    rotationSpeed: 0.028,
    color: 0x4b70dd,
    startAngle: (7 * Math.PI) / 4,
    moons: [
      {
        texture: texMoonF,
        size: 0.2,
        distance: 3.2,
        orbitSpeed: 0.015,
        startAngle: (3 * Math.PI) / 4,
      },
    ],
  },
];

// Extremely optimized geometry configurations for maximum performance
const GEOMETRY_CONFIG = {
  sun: { widthSegments: 16, heightSegments: 16 }, // Reduced from 24,24
  planet: { widthSegments: 12, heightSegments: 12 }, // Reduced from 16,16
  moon: { widthSegments: 8, heightSegments: 8 }, // Reduced from 12,12
  ring: { segments: 24 }, // Reduced from 32
  corona: { widthSegments: 12, heightSegments: 12 },
};

// Simplified Corona component optimized for performance
interface PlanetaryCoronaProps {
  planetSize: number;
  color?: number;
  intensity?: number;
}

const PlanetaryCorona: React.FC<PlanetaryCoronaProps> = React.memo(
  ({
    planetSize,
    color = 0xfff5e1,
    intensity = 0.2, // Reduced intensity for better performance
  }) => {
    const coronaRef = useRef<Mesh>(null);

    // Load corona texture
    const coronaTexture = useLoader(
      TextureLoader,
      Asset.fromModule(texGradientCircle).uri
    );

    // Simplified animation with reduced calculations
    const animateCorona = useCallback((state: any) => {
      if (coronaRef.current) {
        const time = state.clock.getElapsedTime();
        // Simpler animation with less calculations
        const scale = 1 + Math.sin(time * 1.5) * 0.03; // Reduced amplitude
        coronaRef.current.scale.setScalar(scale);
        coronaRef.current.rotation.z = time * 0.2; // Slower rotation
      }
    }, []);

    useFrame(animateCorona);

    const coronaSize = planetSize * 3; // Reduced from 4x for performance

    return (
      <Billboard>
        <mesh ref={coronaRef} position={[0, 0, 0]}>
          <planeGeometry args={[coronaSize, coronaSize]} />
          <meshBasicMaterial
            map={coronaTexture}
            transparent
            opacity={intensity}
            blending={2}
            depthWrite={false}
            side={2}
            color={color}
          />
        </mesh>
      </Billboard>
    );
  }
);
PlanetaryCorona.displayName = "PlanetaryCorona";

// Optimized Sun Corona component
const SunCorona: React.FC = React.memo(() => {
  const coronaRef = useRef<Mesh>(null);

  const coronaTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircleSun).uri
  );

  const animateCorona = useCallback((state: any) => {
    if (coronaRef.current) {
      const time = state.clock.getElapsedTime();
      const scale = 1 + Math.sin(time * 1.2) * 0.05; // Reduced calculation complexity
      coronaRef.current.scale.setScalar(scale);
      coronaRef.current.rotation.z = time * 0.3;
    }
  }, []);

  useFrame(animateCorona);

  return (
    <Billboard>
      <mesh ref={coronaRef} position={[0, 0, 0]}>
        <planeGeometry args={[18, 18]} /> {/* Reduced from 22x22 */}
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={0.8} // Reduced from 0.95
          blending={2}
          depthWrite={false}
          side={2}
          color={0xfff5e1}
        />
      </mesh>
    </Billboard>
  );
});
SunCorona.displayName = "SunCorona";

// Highly optimized Sun component
const Sun: React.FC = React.memo(() => {
  const sunRef = useRef<Mesh>(null);

  const sunTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texSunSpots).uri as string
  );

  const animateSun = useCallback(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.006; // Slightly reduced rotation speed
    }
  }, []);

  useFrame(animateSun);

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
      <SunCorona />
      <mesh ref={sunRef} position={[0, 0, 0]} castShadow={false}>
        <sphereGeometry args={sunGeometry} />
        <meshPhongMaterial
          map={sunTexture}
          emissive={0xffaa00}
          emissiveIntensity={1.0} // Reduced from 1.2
          color={0xffcc00}
          shininess={5}
          specular={0xffcc44}
        />
      </mesh>
    </group>
  );
});
Sun.displayName = "Sun";

// Optimized Moon component with fixed orbital paths (no collision detection)
interface MoonProps {
  config: {
    texture: any;
    size: number;
    distance: number;
    orbitSpeed: number;
    startAngle?: number;
  };
  planetPosition: [number, number, number];
  moonIndex?: number;
}

const Moon: React.FC<MoonProps> = React.memo(
  ({ config, planetPosition, moonIndex = 0 }) => {
    const moonRef = useRef<Group>(null);
    const meshRef = useRef<Mesh>(null);
    const moonOrbitTime = useRef(config.startAngle || 0);

    const texture = useLoader(
      TextureLoader,
      Asset.fromModule(config.texture).uri
    );

    // Simplified animation with fixed orbital path - no collision detection
    const animateMoon = useCallback(() => {
      moonOrbitTime.current += config.orbitSpeed;

      if (moonRef.current) {
        // Simple circular orbit calculation
        const x = Math.cos(moonOrbitTime.current) * config.distance;
        const z = Math.sin(moonOrbitTime.current) * config.distance;

        // Fixed height offset for ring avoidance (no dynamic collision detection)
        const y = moonIndex > 0 ? 0.5 + moonIndex * 0.3 : 0; // Simple static spacing

        moonRef.current.position.set(x, y, z);
      }

      if (meshRef.current) {
        meshRef.current.rotation.y += 0.015; // Reduced rotation speed
      }
    }, [config.orbitSpeed, config.distance, moonIndex]);

    useFrame(animateMoon);

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
        <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow castShadow>
          <sphereGeometry args={moonGeometry} />
          <meshPhongMaterial
            map={texture}
            shininess={10} // Reduced from 15
            specular={0x333333} // Reduced from 0x444444
            emissive={0x111111}
            emissiveIntensity={0.03} // Reduced from 0.05
          />
        </mesh>
      </group>
    );
  }
);
Moon.displayName = "Moon";

// Optimized Ring component
interface RingProps {
  config: {
    texture: any;
    innerRadius: number;
    outerRadius: number;
    opacity: number;
  };
  planetPosition: [number, number, number];
}

const Ring: React.FC<RingProps> = React.memo(({ config, planetPosition }) => {
  const ringRef = useRef<Mesh>(null);

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Configure texture wrapping
  useMemo(() => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }, [texture]);

  const animateRing = useCallback(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.001; // Reduced rotation speed
    }
  }, []);

  useFrame(animateRing);

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
      receiveShadow
      castShadow
    >
      <ringGeometry args={ringGeometry} />
      <meshPhongMaterial
        map={texture}
        transparent
        opacity={config.opacity}
        side={2}
        shininess={20} // Reduced from 25
        specular={0x555555} // Reduced from 0x666666
        emissive={0x222222}
        emissiveIntensity={0.05} // Reduced from 0.08
      />
    </mesh>
  );
});
Ring.displayName = "Ring";

// Optimized Planet component with simplified materials
interface PlanetProps {
  config: (typeof PLANET_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = React.memo(({ config }) => {
  const planetGroupRef = useRef<Group>(null);
  const planetMeshRef = useRef<Mesh>(null);
  const orbitTime = useRef(config.startAngle || 0);

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Simplified material properties for better performance
  const planetMaterial = useMemo(() => {
    const baseProps = {
      map: texture,
      color: config.color,
      shininess: 25, // Standardized for performance
      specular: 0x444444,
      emissive: 0x000000,
      emissiveIntensity: 0.05, // Standardized low value
    };

    return baseProps;
  }, [texture, config.color]);

  // Optimized animation with minimal calculations
  const animatePlanet = useCallback(() => {
    orbitTime.current += config.orbitSpeed;

    if (planetGroupRef.current) {
      const x = Math.cos(orbitTime.current) * config.distance;
      const z = Math.sin(orbitTime.current) * config.distance;
      planetGroupRef.current.position.set(x, 0, z);
    }

    if (planetMeshRef.current) {
      planetMeshRef.current.rotation.y += config.rotationSpeed;
    }
  }, [config.orbitSpeed, config.rotationSpeed, config.distance]);

  useFrame(animatePlanet);

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
      {/* Simplified planetary corona - only for large planets */}
      {config.size > 1.0 && (
        <PlanetaryCorona
          planetSize={config.size}
          color={config.color}
          intensity={0.15} // Reduced intensity
        />
      )}

      <mesh ref={planetMeshRef} position={[0, 0, 0]} receiveShadow castShadow>
        <sphereGeometry args={planetGeometry} />
        <meshPhongMaterial
          map={planetMaterial.map}
          color={planetMaterial.color}
          shininess={planetMaterial.shininess}
          specular={planetMaterial.specular}
          emissive={planetMaterial.emissive}
          emissiveIntensity={planetMaterial.emissiveIntensity}
        />
      </mesh>

      {config.rings && (
        <Ring config={config.rings} planetPosition={[0, 0, 0]} />
      )}

      {config.moons?.map((moon, index) => (
        <Moon
          key={index}
          config={moon}
          planetPosition={[0, 0, 0]}
          moonIndex={index}
        />
      ))}
    </group>
  );
});
Planet.displayName = "Planet";

// Optimized camera controller with reduced update frequency
const CameraController: React.FC = React.memo(() => {
  const lastUpdate = useRef(0);
  const UPDATE_FREQUENCY = 1 / 30; // 30fps updates for camera

  const animateCamera = useCallback((state: any) => {
    const currentTime = state.clock.getElapsedTime();

    if (currentTime - lastUpdate.current < UPDATE_FREQUENCY) {
      return;
    }

    lastUpdate.current = currentTime;

    const time = currentTime * 0.025; // Slower camera movement
    const cameraDistance = 55;
    const heightVariation = 5; // Reduced height variation

    state.camera.position.x = Math.cos(time) * cameraDistance;
    state.camera.position.z = Math.sin(time) * cameraDistance;
    state.camera.position.y =
      Math.sin(currentTime * 0.02) * heightVariation + 18;
    state.camera.lookAt(0, 0, 0);
  }, []);

  useFrame(animateCamera);
  return null;
});
CameraController.displayName = "CameraController";

// Simplified lighting setup for maximum performance
const Lighting: React.FC = React.memo(() => {
  const lightGroupRef = useRef<Group>(null);

  // Minimal lighting animation for performance
  const animateLighting = useCallback((state: any) => {
    if (lightGroupRef.current) {
      const time = state.clock.getElapsedTime();
      const sunIntensityVariation = 1 + Math.sin(time * 0.3) * 0.05; // Reduced variation

      const sunLight = lightGroupRef.current.children.find(
        (child: any) => child.userData?.name === "sunLight"
      );
      if (sunLight) {
        (sunLight as any).intensity = 10 * sunIntensityVariation; // Reduced base intensity
      }
    }
  }, []);

  useFrame(animateLighting);

  return (
    <group ref={lightGroupRef}>
      {/* Simplified lighting setup - reduced from 8+ lights to 4 essential lights */}
      <ambientLight intensity={0.6} color={0x404060} />{" "}
      {/* Reduced intensity */}
      <pointLight
        userData={{ name: "sunLight" }}
        position={[0, 0, 0]}
        intensity={10} // Reduced from 12
        color={0xfff2e6}
        distance={80} // Reduced distance
        decay={1.5} // Increased decay for performance
        castShadow={true}
        shadow-mapSize={[1024, 1024]} // Reduced shadow map size
        shadow-camera-near={0.5}
        shadow-camera-far={80}
      />
      <directionalLight
        position={[30, 20, 25]} // Closer position
        intensity={0.8} // Reduced intensity
        color={0xffffff}
        castShadow={false}
      />
      <directionalLight
        position={[-25, 15, -20]} // Closer position
        intensity={0.5} // Reduced intensity
        color={0xffffdd}
        castShadow={false}
      />
    </group>
  );
});
Lighting.displayName = "Lighting";

// Main Solar System Scene with maximum optimization
const SolarSystemScene: React.FC = React.memo(() => {
  return (
    <>
      <Lighting />
      <CameraController />
      <Sun />
      {PLANET_CONFIG.map((planetConfig) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
});
SolarSystemScene.displayName = "SolarSystemScene";

// Minimal loading fallback
const LoadingFallback: React.FC = React.memo(() => {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 6, 6]} />
      <meshBasicMaterial color={0x444444} wireframe />
    </mesh>
  );
});
LoadingFallback.displayName = "LoadingFallback";

// Main component with maximum performance optimizations
const SolarSystem3D: React.FC = React.memo(() => {
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
      position: [0, 12, 25] as [number, number, number],
      fov: 60,
      near: 0.1,
      far: 1000,
    }),
    []
  );

  const glConfig = useMemo(
    () => ({
      antialias: false, // Disabled for mobile performance
      alpha: true,
      powerPreference: "high-performance" as const,
      stencil: false, // Disabled for performance
      depth: true,
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
          gl.setClearColor(0x000000, 0);
          gl.pixelRatio = Math.min(
            1.5,
            typeof window !== "undefined" ? window.devicePixelRatio : 1
          ); // Reduced pixel ratio
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = 2; // PCFShadowMap for performance
        }}
        frameloop="always"
        performance={{ min: 0.8, max: 1.0, debounce: 200 }} // Performance hints
      >
        <Suspense fallback={<LoadingFallback />}>
          <SolarSystemScene />
        </Suspense>
      </Canvas>
    </View>
  );
});
SolarSystem3D.displayName = "SolarSystem3D";

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
