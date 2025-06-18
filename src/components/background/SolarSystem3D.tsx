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
  sun: { widthSegments: 16, heightSegments: 16 },
  planet: { widthSegments: 12, heightSegments: 12 },
  moon: { widthSegments: 8, heightSegments: 8 },
  ring: { segments: 24 },
  corona: { widthSegments: 12, heightSegments: 12 },
};

// Animation state management for centralized control
interface AnimationRefs {
  sunMesh: React.RefObject<Mesh | null>;
  sunCorona: React.RefObject<Mesh | null>;
  planetaryCoronas: React.RefObject<Mesh | null>[];
  planets: {
    group: React.RefObject<Group | null>;
    mesh: React.RefObject<Mesh | null>;
    orbitTime: React.MutableRefObject<number>;
    config: (typeof PLANET_CONFIG)[0];
    moons: {
      group: React.RefObject<Group | null>;
      mesh: React.RefObject<Mesh | null>;
      orbitTime: React.MutableRefObject<number>;
      config: any;
      moonIndex: number;
    }[];
    rings: React.RefObject<Mesh | null>[];
  }[];
  camera: any;
  sunLight: any;
}

// Static Corona component (no animation)
interface PlanetaryCoronaProps {
  planetSize: number;
  color?: number;
  intensity?: number;
  coronaRef: React.RefObject<Mesh | null>;
}

const PlanetaryCorona: React.FC<PlanetaryCoronaProps> = React.memo(
  ({ planetSize, color = 0xfff5e1, intensity = 0.2, coronaRef }) => {
    const coronaTexture = useLoader(
      TextureLoader,
      Asset.fromModule(texGradientCircle).uri
    );

    const coronaSize = planetSize * 3;

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

// Static Sun Corona component
const SunCorona: React.FC<{ coronaRef: React.RefObject<Mesh | null> }> =
  React.memo(({ coronaRef }) => {
    const coronaTexture = useLoader(
      TextureLoader,
      Asset.fromModule(texGradientCircleSun).uri
    );

    return (
      <Billboard>
        <mesh ref={coronaRef} position={[0, 0, 0]}>
          <planeGeometry args={[18, 18]} />
          <meshBasicMaterial
            map={coronaTexture}
            transparent
            opacity={0.8}
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

// Static Sun component
const Sun: React.FC<{
  sunRef: React.RefObject<Mesh | null>;
  coronaRef: React.RefObject<Mesh | null>;
}> = React.memo(({ sunRef, coronaRef }) => {
  const sunTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texSunSpots).uri as string
  );

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
      <SunCorona coronaRef={coronaRef} />
      <mesh ref={sunRef} position={[0, 0, 0]} castShadow={false}>
        <sphereGeometry args={sunGeometry} />
        <meshPhongMaterial
          map={sunTexture}
          emissive={0xffaa00}
          emissiveIntensity={1.0}
          color={0xffcc00}
          shininess={5}
          specular={0xffcc44}
        />
      </mesh>
    </group>
  );
});
Sun.displayName = "Sun";

// Static Moon component
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
  moonRef: React.RefObject<Group | null>;
  meshRef: React.RefObject<Mesh | null>;
}

const Moon: React.FC<MoonProps> = React.memo(
  ({ config, planetPosition, moonIndex = 0, moonRef, meshRef }) => {
    const texture = useLoader(
      TextureLoader,
      Asset.fromModule(config.texture).uri
    );

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
            shininess={10}
            specular={0x333333}
            emissive={0x111111}
            emissiveIntensity={0.03}
          />
        </mesh>
      </group>
    );
  }
);
Moon.displayName = "Moon";

// Static Ring component
interface RingProps {
  config: {
    texture: any;
    innerRadius: number;
    outerRadius: number;
    opacity: number;
  };
  planetPosition: [number, number, number];
  ringRef: React.RefObject<Mesh | null>;
}

const Ring: React.FC<RingProps> = React.memo(
  ({ config, planetPosition, ringRef }) => {
    const texture = useLoader(
      TextureLoader,
      Asset.fromModule(config.texture).uri
    );

    // Configure texture wrapping
    useMemo(() => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    }, [texture]);

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
          shininess={20}
          specular={0x555555}
          emissive={0x222222}
          emissiveIntensity={0.05}
        />
      </mesh>
    );
  }
);
Ring.displayName = "Ring";

// Static Planet component
interface PlanetProps {
  config: (typeof PLANET_CONFIG)[0];
  planetGroupRef: React.RefObject<Group | null>;
  planetMeshRef: React.RefObject<Mesh | null>;
  coronaRef?: React.RefObject<Mesh | null>;
  ringRefs: React.RefObject<Mesh | null>[];
  moonRefs: {
    group: React.RefObject<Group | null>;
    mesh: React.RefObject<Mesh | null>;
  }[];
}

const Planet: React.FC<PlanetProps> = React.memo(
  ({
    config,
    planetGroupRef,
    planetMeshRef,
    coronaRef,
    ringRefs,
    moonRefs,
  }) => {
    const texture = useLoader(
      TextureLoader,
      Asset.fromModule(config.texture).uri
    );

    const planetMaterial = useMemo(
      () => ({
        map: texture,
        color: config.color,
        shininess: 25,
        specular: 0x444444,
        emissive: 0x000000,
        emissiveIntensity: 0.05,
      }),
      [texture, config.color]
    );

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
        {config.size > 1.0 && coronaRef && (
          <PlanetaryCorona
            planetSize={config.size}
            color={config.color}
            intensity={0.15}
            coronaRef={coronaRef}
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
          <Ring
            config={config.rings}
            planetPosition={[0, 0, 0]}
            ringRef={ringRefs[0]}
          />
        )}

        {config.moons?.map((moon, index) => (
          <Moon
            key={index}
            config={moon}
            planetPosition={[0, 0, 0]}
            moonIndex={index}
            moonRef={moonRefs[index].group}
            meshRef={moonRefs[index].mesh}
          />
        ))}
      </group>
    );
  }
);
Planet.displayName = "Planet";

// Centralized Animation Manager - Single useFrame for all animations
const AnimationManager: React.FC<{ animationRefs: AnimationRefs }> = ({
  animationRefs,
}) => {
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Sun rotation
    if (animationRefs.sunMesh.current) {
      animationRefs.sunMesh.current.rotation.y += 0.006;
    }

    // Sun corona animation
    if (animationRefs.sunCorona.current) {
      const scale = 1 + Math.sin(time * 1.2) * 0.05;
      animationRefs.sunCorona.current.scale.setScalar(scale);
      animationRefs.sunCorona.current.rotation.z = time * 0.3;
    }

    // Planetary corona animations
    animationRefs.planetaryCoronas.forEach((coronaRef) => {
      if (coronaRef.current) {
        const scale = 1 + Math.sin(time * 1.5) * 0.03;
        coronaRef.current.scale.setScalar(scale);
        coronaRef.current.rotation.z = time * 0.2;
      }
    });

    // Planet animations
    animationRefs.planets.forEach((planet) => {
      // Planet orbit
      planet.orbitTime.current += planet.config.orbitSpeed;

      if (planet.group.current) {
        const x = Math.cos(planet.orbitTime.current) * planet.config.distance;
        const z = Math.sin(planet.orbitTime.current) * planet.config.distance;
        planet.group.current.position.set(x, 0, z);
      }

      // Planet rotation
      if (planet.mesh.current) {
        planet.mesh.current.rotation.y += planet.config.rotationSpeed;
      }

      // Moon animations
      planet.moons.forEach((moon) => {
        moon.orbitTime.current += moon.config.orbitSpeed;

        if (moon.group.current) {
          const x = Math.cos(moon.orbitTime.current) * moon.config.distance;
          const z = Math.sin(moon.orbitTime.current) * moon.config.distance;
          const y = moon.moonIndex > 0 ? 0.5 + moon.moonIndex * 0.3 : 0;
          moon.group.current.position.set(x, y, z);
        }

        if (moon.mesh.current) {
          moon.mesh.current.rotation.y += 0.015;
        }
      });

      // Ring animations
      planet.rings.forEach((ringRef) => {
        if (ringRef.current) {
          ringRef.current.rotation.z += 0.001;
        }
      });
    });

    // Camera animation (60fps, no throttling)
    const cameraTime = time * 0.025;
    const cameraDistance = 55;
    const heightVariation = 5;

    state.camera.position.x = Math.cos(cameraTime) * cameraDistance;
    state.camera.position.z = Math.sin(cameraTime) * cameraDistance;
    state.camera.position.y = Math.sin(time * 0.02) * heightVariation + 18;
    state.camera.lookAt(0, 0, 0);

    // Light animation
    if (animationRefs.sunLight) {
      const sunIntensityVariation = 1 + Math.sin(time * 0.3) * 0.05;
      animationRefs.sunLight.intensity = 10 * sunIntensityVariation;
    }
  });

  return null;
};

// Static Lighting component
const Lighting: React.FC<{ lightRef: React.MutableRefObject<any> }> =
  React.memo(({ lightRef }) => {
    return (
      <group>
        <ambientLight intensity={0.6} color={0x404060} />

        <pointLight
          ref={(ref) => (lightRef.current = ref)}
          userData={{ name: "sunLight" }}
          position={[0, 0, 0]}
          intensity={10}
          color={0xfff2e6}
          distance={80}
          decay={1.5}
          castShadow={true}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
        />

        <directionalLight
          position={[30, 20, 25]}
          intensity={0.8}
          color={0xffffff}
          castShadow={false}
        />

        <directionalLight
          position={[-25, 15, -20]}
          intensity={0.5}
          color={0xffffdd}
          castShadow={false}
        />
      </group>
    );
  });
Lighting.displayName = "Lighting";

// Main Solar System Scene with centralized animation
const SolarSystemScene: React.FC = React.memo(() => {
  // Create all refs for centralized animation control
  const sunMeshRef = useRef<Mesh>(null);
  const sunCoronaRef = useRef<Mesh>(null);
  const sunLightRef = useRef<any>(null);

  // Create planet refs
  const planetRefs = useMemo(
    () =>
      PLANET_CONFIG.map((config) => ({
        group: React.createRef<Group>(),
        mesh: React.createRef<Mesh>(),
        orbitTime: { current: config.startAngle || 0 },
        config,
        moons:
          config.moons?.map((moon, index) => ({
            group: React.createRef<Group>(),
            mesh: React.createRef<Mesh>(),
            orbitTime: { current: moon.startAngle || 0 },
            config: moon,
            moonIndex: index,
          })) || [],
        rings: config.rings ? [React.createRef<Mesh>()] : [],
      })),
    []
  );

  // Create corona refs for large planets
  const planetaryCoronaRefs = useMemo(
    () =>
      PLANET_CONFIG.map((config) =>
        config.size > 1.0 ? React.createRef<Mesh>() : null
      ).filter(Boolean) as React.RefObject<Mesh>[],
    []
  );

  // Build animation refs object
  const animationRefs: AnimationRefs = useMemo(
    () => ({
      sunMesh: sunMeshRef,
      sunCorona: sunCoronaRef,
      planetaryCoronas: planetaryCoronaRefs,
      planets: planetRefs,
      camera: null, // Will be set by useFrame
      sunLight: sunLightRef.current,
    }),
    [planetRefs, planetaryCoronaRefs]
  );

  return (
    <>
      <Lighting lightRef={sunLightRef} />

      <Sun sunRef={sunMeshRef} coronaRef={sunCoronaRef} />

      {PLANET_CONFIG.map((planetConfig, index) => (
        <Planet
          key={planetConfig.name}
          config={planetConfig}
          planetGroupRef={planetRefs[index].group}
          planetMeshRef={planetRefs[index].mesh}
          coronaRef={
            planetConfig.size > 1.0
              ? planetaryCoronaRefs[
                  planetaryCoronaRefs.findIndex(
                    (_, i) =>
                      PLANET_CONFIG[i] === planetConfig &&
                      PLANET_CONFIG[i].size > 1.0
                  )
                ]
              : undefined
          }
          ringRefs={planetRefs[index].rings}
          moonRefs={planetRefs[index].moons}
        />
      ))}

      <AnimationManager animationRefs={animationRefs} />
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
      antialias: false,
      alpha: true,
      powerPreference: "high-performance" as const,
      stencil: false,
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
          );
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = 2; // PCFShadowMap for performance
        }}
        frameloop="always"
        performance={{ min: 0.9, max: 1.0, debounce: 100 }} // Increased performance thresholds
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
