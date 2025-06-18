/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/prop-types */
import React, {
  useRef,
  useMemo,
  Suspense,
  useCallback,
  useState,
  useEffect,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import {
  TextureLoader,
  Mesh,
  Group,
  RepeatWrapping,
  FrontSide,
  BackSide,
} from "three";
import { Dimensions, View, StyleSheet } from "react-native";
import { Asset } from "expo-asset";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Performance monitoring
interface PerformanceMetrics {
  frameCount: number;
  lastFPSCheck: number;
  currentFPS: number;
  averageFPS: number;
  fpsHistory: number[];
}

// Texture cache for memory optimization
const textureCache = new Map<string, any>();

// Geometry cache for reusing common geometries
const geometryCache = new Map<string, any>();

// LOD thresholds for performance optimization
const LOD_CONFIG = {
  HIGH_DETAIL_DISTANCE: 25,
  MEDIUM_DETAIL_DISTANCE: 45,
  LOW_DETAIL_DISTANCE: 70,
  CULL_DISTANCE: 100,
};

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

// Mobile-optimized planet configuration for smooth orbital motion
const PLANET_CONFIG = [
  {
    name: "Mercury",
    texture: texPlanetR,
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.035, // Increased for better visibility
    rotationSpeed: 0.015,
    color: 0x8c7853,
    startAngle: 0,
    priority: 1,
  },
  {
    name: "Venus",
    texture: texPlanetA,
    size: 0.7,
    distance: 6.5,
    orbitSpeed: 0.028, // Increased for smoother motion
    rotationSpeed: 0.012,
    color: 0xffc649,
    startAngle: Math.PI / 4,
    priority: 1,
    moons: [
      {
        texture: texMoonH,
        size: 0.2,
        distance: 2.2,
        orbitSpeed: 0.04, // Faster moon orbit for visibility
        startAngle: 0,
        priority: 2,
      },
    ],
  },
  {
    name: "Earth",
    texture: texPlanetK,
    size: 0.8,
    distance: 8.5,
    orbitSpeed: 0.022, // Increased for better motion
    rotationSpeed: 0.025,
    color: 0x6b93d6,
    startAngle: Math.PI / 2,
    priority: 1,
    moons: [
      {
        texture: texMoonF,
        size: 0.25,
        distance: 2.5,
        orbitSpeed: 0.035, // Faster for smooth motion
        startAngle: Math.PI,
        priority: 1,
      },
    ],
  },
  {
    name: "Mars",
    texture: texPlanetD,
    size: 0.6,
    distance: 12,
    orbitSpeed: 0.018, // Increased for visibility
    rotationSpeed: 0.022,
    color: 0xcd5c5c,
    startAngle: (3 * Math.PI) / 4,
    priority: 1,
    moons: [
      {
        texture: texMoonG,
        size: 0.15,
        distance: 2.2,
        orbitSpeed: 0.045, // Fast moon orbit
        startAngle: 0,
        priority: 2,
      },
      {
        texture: texMoonD,
        size: 0.12,
        distance: 3.2,
        orbitSpeed: 0.032, // Coordinated moon speed
        startAngle: Math.PI,
        priority: 3,
      },
    ],
  },
  {
    name: "Jupiter",
    texture: texPlanetV,
    size: 2.2,
    distance: 18,
    orbitSpeed: 0.014, // Doubled for better visibility
    rotationSpeed: 0.05,
    color: 0xd8ca9d,
    startAngle: Math.PI,
    priority: 2, // Reduced priority for performance
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
        orbitSpeed: 0.025, // Faster for visibility
        startAngle: Math.PI / 2,
        priority: 2,
      },
    ],
  },
  {
    name: "Saturn",
    texture: texPlanetR,
    size: 1.9,
    distance: 25, // Moved closer for better visibility
    orbitSpeed: 0.011, // More than doubled for motion
    rotationSpeed: 0.04,
    color: 0xfad5a5,
    startAngle: (5 * Math.PI) / 4,
    priority: 2,
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
        orbitSpeed: 0.022, // Increased moon speed
        startAngle: 0,
        priority: 3,
      },
      {
        texture: texMoonD,
        size: 0.22,
        distance: 6.0,
        orbitSpeed: 0.016, // Increased moon speed
        startAngle: (2 * Math.PI) / 3,
        priority: 3,
      },
    ],
  },
  {
    name: "Uranus",
    texture: texPlanetR,
    size: 1.6,
    distance: 32, // Moved closer
    orbitSpeed: 0.008, // Doubled for visibility
    rotationSpeed: 0.03,
    color: 0x4fd0e3,
    startAngle: (3 * Math.PI) / 2,
    priority: 3,
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
        orbitSpeed: 0.028, // Increased for motion
        startAngle: Math.PI / 3,
        priority: 3,
      },
    ],
  },
  {
    name: "Neptune",
    texture: texPlanetA,
    size: 1.5,
    distance: 38, // Moved closer
    orbitSpeed: 0.006, // Doubled for motion
    rotationSpeed: 0.032,
    color: 0x4b70dd,
    startAngle: (7 * Math.PI) / 4,
    priority: 3,
    moons: [
      {
        texture: texMoonF,
        size: 0.2,
        distance: 3.2,
        orbitSpeed: 0.025, // Increased for visibility
        startAngle: (3 * Math.PI) / 4,
        priority: 3,
      },
    ],
  },
];

// Mobile-optimized geometry configurations - reduced complexity for smooth orbits
const GEOMETRY_CONFIG = {
  sun: {
    high: { widthSegments: 16, heightSegments: 16 },
    medium: { widthSegments: 12, heightSegments: 12 },
    low: { widthSegments: 8, heightSegments: 8 },
  },
  planet: {
    high: { widthSegments: 12, heightSegments: 12 },
    medium: { widthSegments: 8, heightSegments: 8 },
    low: { widthSegments: 6, heightSegments: 6 },
  },
  moon: {
    high: { widthSegments: 8, heightSegments: 8 },
    medium: { widthSegments: 6, heightSegments: 6 },
    low: { widthSegments: 4, heightSegments: 4 },
  },
  ring: {
    high: { segments: 16 },
    medium: { segments: 12 },
    low: { segments: 8 },
  },
  corona: {
    high: { widthSegments: 8, heightSegments: 8 },
    medium: { widthSegments: 6, heightSegments: 6 },
    low: { widthSegments: 4, heightSegments: 4 },
  },
};

// Optimized texture loader with caching - simplified for reliability
const useOptimizedTexture = (textureAsset: any) => {
  // Always call useLoader with a fallback approach
  const textureUri = useMemo(() => {
    try {
      const asset = Asset.fromModule(textureAsset);
      return asset.localUri || asset.uri || "";
    } catch (error) {
      console.warn("Failed to load texture asset:", textureAsset, error);
      // Return empty string as fallback - useLoader will handle this gracefully
      return "";
    }
  }, [textureAsset]);

  // Always call useLoader (required for React hooks)
  const texture = useLoader(TextureLoader, textureUri);

  return useMemo(() => {
    // Return null if no valid texture or URI
    if (!texture || !textureUri) return null;

    try {
      // Optimize texture settings for performance
      if (texture && typeof texture.generateMipmaps !== "undefined") {
        texture.generateMipmaps = true;
        texture.flipY = false;
      }
      return texture;
    } catch (error) {
      console.warn("Failed to configure texture:", error);
      return null;
    }
  }, [texture, textureUri]);
};

// Optimized geometry creator with caching and LOD
const createOptimizedGeometry = (
  type: string,
  size: number,
  lodLevel: string,
  segments?: number
) => {
  const cacheKey = `${type}-${size}-${lodLevel}-${segments || "default"}`;

  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey);
  }

  let geometry;
  const config = GEOMETRY_CONFIG[type as keyof typeof GEOMETRY_CONFIG];

  // Safety check for config
  if (!config) {
    console.warn(`Invalid geometry type: ${type}, falling back to sphere`);
    geometry = new THREE.SphereGeometry(size, 8, 8);
    geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  const lodConfig = config[lodLevel as keyof typeof config] as any;

  // Safety check for lodConfig
  if (!lodConfig) {
    console.warn(`Invalid LOD level: ${lodLevel}, falling back to medium`);
    const fallbackConfig = config.medium || config.low || config.high;
    if (!fallbackConfig) {
      geometry = new THREE.SphereGeometry(size, 8, 8);
      geometryCache.set(cacheKey, geometry);
      return geometry;
    }

    switch (type) {
      case "sphere": {
        const sphereConfig = fallbackConfig as {
          widthSegments: number;
          heightSegments: number;
        };
        geometry = new THREE.SphereGeometry(
          size,
          sphereConfig.widthSegments || 8,
          sphereConfig.heightSegments || 8
        );
        break;
      }
      case "ring": {
        const ringConfig = fallbackConfig as { segments: number };
        geometry = new THREE.RingGeometry(
          size,
          segments || size * 1.5,
          ringConfig.segments || 16
        );
        break;
      }
      case "plane": {
        const planeConfig = fallbackConfig as {
          widthSegments: number;
          heightSegments: number;
        };
        geometry = new THREE.PlaneGeometry(
          size,
          size,
          planeConfig.widthSegments || 8,
          planeConfig.heightSegments || 8
        );
        break;
      }
      default:
        geometry = new THREE.SphereGeometry(size, 8, 8);
    }

    geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  switch (type) {
    case "sphere":
      geometry = new THREE.SphereGeometry(
        size,
        lodConfig.widthSegments || 8,
        lodConfig.heightSegments || 8
      );
      break;
    case "ring":
      geometry = new THREE.RingGeometry(
        size,
        segments || size * 1.5,
        lodConfig.segments || 16
      );
      break;
    case "plane":
      geometry = new THREE.PlaneGeometry(
        size,
        size,
        lodConfig.widthSegments || 8,
        lodConfig.heightSegments || 8
      );
      break;
    default:
      geometry = new THREE.SphereGeometry(size, 8, 8);
  }

  geometryCache.set(cacheKey, geometry);
  return geometry;
};

// LOD calculator based on camera distance
const useLOD = (distance: number) => {
  return useMemo(() => {
    if (distance < LOD_CONFIG.HIGH_DETAIL_DISTANCE) return "high";
    if (distance < LOD_CONFIG.MEDIUM_DETAIL_DISTANCE) return "medium";
    if (distance < LOD_CONFIG.LOW_DETAIL_DISTANCE) return "low";
    return "cull";
  }, [distance]);
};

// Performance monitor hook
const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    frameCount: 0,
    lastFPSCheck: 0,
    currentFPS: 60,
    averageFPS: 60,
    fpsHistory: [],
  });

  const updateMetrics = useCallback((time: number) => {
    setMetrics((prev) => {
      const newFrameCount = prev.frameCount + 1;
      const timeDiff = time - prev.lastFPSCheck;

      if (timeDiff >= 1000) {
        // Update FPS every second
        const currentFPS = Math.round((newFrameCount * 1000) / timeDiff);
        const newHistory = [...prev.fpsHistory, currentFPS].slice(-10);
        const averageFPS = Math.round(
          newHistory.reduce((a, b) => a + b, 0) / newHistory.length
        );

        return {
          frameCount: 0,
          lastFPSCheck: time,
          currentFPS,
          averageFPS,
          fpsHistory: newHistory,
        };
      }

      return { ...prev, frameCount: newFrameCount };
    });
  }, []);

  return { metrics, updateMetrics };
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

// Optimized Corona component with LOD
interface PlanetaryCoronaProps {
  planetSize: number;
  color?: number;
  intensity?: number;
  coronaRef: React.RefObject<Mesh | null>;
  cameraDistance: number;
}

const PlanetaryCorona: React.FC<PlanetaryCoronaProps> = React.memo(
  ({
    planetSize,
    color = 0xfff5e1,
    intensity = 0.2,
    coronaRef,
    cameraDistance,
  }) => {
    const coronaTexture = useOptimizedTexture(texGradientCircle);
    const lodLevel = useLOD(cameraDistance);

    if (lodLevel === "cull") return null;

    const coronaSize = planetSize * 3;

    // Adjust intensity based on LOD
    const adjustedIntensity = lodLevel === "low" ? intensity * 0.5 : intensity;

    return (
      <Billboard>
        <mesh ref={coronaRef} position={[0, 0, 0]}>
          <planeGeometry args={[coronaSize, coronaSize]} />
          <meshBasicMaterial
            map={coronaTexture}
            transparent
            opacity={adjustedIntensity}
            blending={2}
            depthWrite={false}
            side={FrontSide}
            color={color}
          />
        </mesh>
      </Billboard>
    );
  }
);
PlanetaryCorona.displayName = "PlanetaryCorona";

// Optimized Sun Corona component
const SunCorona: React.FC<{
  coronaRef: React.RefObject<Mesh | null>;
  cameraDistance: number;
}> = React.memo(({ coronaRef, cameraDistance }) => {
  const coronaTexture = useOptimizedTexture(texGradientCircleSun);

  // Sun corona always uses high quality settings
  const size = 18;
  const opacity = 0.8;

  return (
    <Billboard>
      <mesh ref={coronaRef} position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={opacity}
          blending={2}
          depthWrite={false}
          side={FrontSide}
          color={0xfff5e1}
        />
      </mesh>
    </Billboard>
  );
});
SunCorona.displayName = "SunCorona";

// Optimized Sun component with reliable texture loading
const Sun: React.FC<{
  sunRef: React.RefObject<Mesh | null>;
  coronaRef: React.RefObject<Mesh | null>;
  cameraDistance: number;
}> = React.memo(({ sunRef, coronaRef, cameraDistance }) => {
  // Load sun texture (hook must be called unconditionally)
  const sunTexture = useOptimizedTexture(texSunSpots);

  // Create sun material with proper fallback properties
  const sunMaterial = useMemo(
    () => ({
      map: sunTexture || null, // Use texture if available
      emissive: 0xffaa00,
      emissiveIntensity: 1.0,
      color: 0xffcc00,
      shininess: 5,
      specular: 0xffcc44,
    }),
    [sunTexture]
  );

  return (
    <group>
      <SunCorona coronaRef={coronaRef} cameraDistance={cameraDistance} />
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1.8, 16, 16]} />
        <meshPhongMaterial
          map={sunMaterial.map}
          emissive={sunMaterial.emissive}
          emissiveIntensity={sunMaterial.emissiveIntensity}
          color={sunMaterial.color}
          shininess={sunMaterial.shininess}
          specular={sunMaterial.specular}
        />
      </mesh>
    </group>
  );
});
Sun.displayName = "Sun";

// Optimized Moon component with LOD
interface MoonProps {
  config: {
    texture: any;
    size: number;
    distance: number;
    orbitSpeed: number;
    startAngle?: number;
    priority?: number;
  };
  planetPosition: [number, number, number];
  moonIndex?: number;
  moonRef: React.RefObject<Group | null>;
  meshRef: React.RefObject<Mesh | null>;
  cameraDistance: number;
}

const Moon: React.FC<MoonProps> = React.memo(
  ({
    config,
    planetPosition,
    moonIndex = 0,
    moonRef,
    meshRef,
    cameraDistance,
  }) => {
    const texture = useOptimizedTexture(config.texture);
    const lodLevel = useLOD(cameraDistance);

    const geometry = useMemo(
      () => createOptimizedGeometry("sphere", config.size, lodLevel),
      [config.size, lodLevel]
    );

    // Cull low priority moons at distance
    if (
      lodLevel === "cull" ||
      (lodLevel === "low" && (config.priority || 1) > 2) ||
      !geometry
    ) {
      return null;
    }

    return (
      <group ref={moonRef} position={planetPosition}>
        <mesh ref={meshRef} position={[0, 0, 0]}>
          <primitive object={geometry} />
          <meshPhongMaterial
            map={texture}
            shininess={lodLevel === "low" ? 5 : 10}
            specular={lodLevel === "low" ? 0x222222 : 0x333333}
            emissive={0x111111}
            emissiveIntensity={lodLevel === "low" ? 0.01 : 0.03}
          />
        </mesh>
      </group>
    );
  }
);
Moon.displayName = "Moon";

// Optimized Ring component with LOD
interface RingProps {
  config: {
    texture: any;
    innerRadius: number;
    outerRadius: number;
    opacity: number;
  };
  planetPosition: [number, number, number];
  ringRef: React.RefObject<Mesh | null>;
  cameraDistance: number;
}

const Ring: React.FC<RingProps> = React.memo(
  ({ config, planetPosition, ringRef, cameraDistance }) => {
    const texture = useOptimizedTexture(config.texture);
    const lodLevel = useLOD(cameraDistance);

    const geometry = useMemo(
      () =>
        createOptimizedGeometry(
          "ring",
          config.innerRadius,
          lodLevel,
          config.outerRadius
        ),
      [config.innerRadius, config.outerRadius, lodLevel]
    );

    // Configure texture wrapping
    useMemo(() => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    }, [texture]);

    if (lodLevel === "cull" || !geometry) return null;

    return (
      <mesh
        ref={ringRef}
        position={planetPosition}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <primitive object={geometry} />
        <meshPhongMaterial
          map={texture}
          transparent
          opacity={lodLevel === "low" ? config.opacity * 0.7 : config.opacity}
          side={2}
          shininess={lodLevel === "low" ? 10 : 20}
          specular={lodLevel === "low" ? 0x333333 : 0x555555}
          emissive={0x222222}
          emissiveIntensity={lodLevel === "low" ? 0.02 : 0.05}
        />
      </mesh>
    );
  }
);
Ring.displayName = "Ring";

// Optimized Planet component with LOD
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
  cameraDistance: number;
}

const Planet: React.FC<PlanetProps> = React.memo(
  ({
    config,
    planetGroupRef,
    planetMeshRef,
    coronaRef,
    ringRefs,
    moonRefs,
    cameraDistance,
  }) => {
    const texture = useOptimizedTexture(config.texture);
    const lodLevel = useLOD(cameraDistance);

    const geometry = useMemo(
      () => createOptimizedGeometry("sphere", config.size, lodLevel),
      [config.size, lodLevel]
    );

    const planetMaterial = useMemo(
      () => ({
        map: texture,
        color: config.color,
        shininess: lodLevel === "low" ? 15 : 25,
        specular: lodLevel === "low" ? 0x222222 : 0x444444,
        emissive: 0x000000,
        emissiveIntensity: lodLevel === "low" ? 0.02 : 0.05,
      }),
      [texture, config.color, lodLevel]
    );

    // Cull low priority planets at extreme distance
    if ((lodLevel === "cull" && (config.priority || 1) > 2) || !geometry) {
      return null;
    }

    return (
      <group ref={planetGroupRef}>
        {config.size > 1.0 && coronaRef && lodLevel !== "low" && (
          <PlanetaryCorona
            planetSize={config.size}
            color={config.color}
            intensity={0.15}
            coronaRef={coronaRef}
            cameraDistance={cameraDistance}
          />
        )}

        <mesh ref={planetMeshRef} position={[0, 0, 0]}>
          <primitive object={geometry} />
          <meshPhongMaterial
            map={planetMaterial.map}
            color={planetMaterial.color}
            shininess={planetMaterial.shininess}
            specular={planetMaterial.specular}
            emissive={planetMaterial.emissive}
            emissiveIntensity={planetMaterial.emissiveIntensity}
          />
        </mesh>

        {config.rings && lodLevel !== "cull" && (
          <Ring
            config={config.rings}
            planetPosition={[0, 0, 0]}
            ringRef={ringRefs[0]}
            cameraDistance={cameraDistance}
          />
        )}

        {config.moons?.map((moon, index) => (
          <Moon
            key={index}
            config={moon}
            planetPosition={[0, 0, 0]}
            moonIndex={index}
            moonRef={moonRefs[index]?.group}
            meshRef={moonRefs[index]?.mesh}
            cameraDistance={cameraDistance}
          />
        ))}
      </group>
    );
  }
);
Planet.displayName = "Planet";

// Mobile-optimized animation with smooth continuous orbital motion
const AnimationManager: React.FC<{
  animationRefs: AnimationRefs;
  performanceMetrics: PerformanceMetrics;
  updateMetrics: (time: number) => void;
}> = ({ animationRefs, performanceMetrics, updateMetrics }) => {
  const { camera } = useThree();
  const frameSkip = useRef(0);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const currentTime = performance.now();

    // Update performance metrics
    updateMetrics(currentTime);

    // Light frame skipping for very low performance
    const shouldSkipFrame =
      performanceMetrics.currentFPS < 15 && frameSkip.current % 2 === 0;
    frameSkip.current++;

    if (shouldSkipFrame) return;

    // Calculate camera distance for LOD
    const currentCameraDistance = camera.position.length();

    // Sun rotation (always animate)
    if (animationRefs.sunMesh.current) {
      animationRefs.sunMesh.current.rotation.y += 0.006;
    }

    // Sun corona animation
    if (animationRefs.sunCorona.current) {
      const animationSpeed = performanceMetrics.currentFPS < 30 ? 0.8 : 1.2;
      const scale = 1 + Math.sin(time * animationSpeed) * 0.05;
      animationRefs.sunCorona.current.scale.setScalar(scale);
      animationRefs.sunCorona.current.rotation.z = time * 0.3;
    }

    // Planet animations - continuous motion for smooth orbits
    animationRefs.planets.forEach((planet, index) => {
      // Planet orbit - continuous smooth motion
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

      // Moon animations (limit to first 4 planets for performance)
      if (index < 4 && planet.moons.length > 0) {
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
      }

      // Ring animations (for close planets only)
      if (index < 5) {
        planet.rings.forEach((ringRef) => {
          if (ringRef.current) {
            ringRef.current.rotation.z += 0.001;
          }
        });
      }
    });

    // Camera animation (adaptive speed based on performance)
    const cameraSpeed = performanceMetrics.currentFPS < 30 ? 0.02 : 0.025;
    const cameraTime = time * cameraSpeed;
    const cameraDistance = 55;
    const heightVariation = 5;

    state.camera.position.x = Math.cos(cameraTime) * cameraDistance;
    state.camera.position.z = Math.sin(cameraTime) * cameraDistance;
    state.camera.position.y = Math.sin(time * 0.02) * heightVariation + 18;
    state.camera.lookAt(0, 0, 0);

    // Planetary corona animations (performance-conscious)
    if (performanceMetrics.currentFPS > 25) {
      animationRefs.planetaryCoronas.forEach((coronaRef) => {
        if (coronaRef.current) {
          const scale = 1 + Math.sin(time * 1.5) * 0.03;
          coronaRef.current.scale.setScalar(scale);
          coronaRef.current.rotation.z = time * 0.2;
        }
      });
    }

    // Light animation (reduced frequency for performance)
    if (animationRefs.sunLight && frameSkip.current % 4 === 0) {
      const sunIntensityVariation = 1 + Math.sin(time * 0.3) * 0.05;
      animationRefs.sunLight.intensity = 8 * sunIntensityVariation;
    }
  });

  return null;
};

// Mobile-optimized Lighting component - simplified for performance
const Lighting: React.FC<{ lightRef: React.MutableRefObject<any> }> =
  React.memo(({ lightRef }) => {
    return (
      <group>
        <ambientLight intensity={0.8} color={0x404080} />

        <pointLight
          ref={(ref) => (lightRef.current = ref)}
          userData={{ name: "sunLight" }}
          position={[0, 0, 0]}
          intensity={8} // Reduced for mobile performance
          color={0xfff2e6}
          distance={60} // Reduced range for performance
          decay={1.2} // Reduced for simpler calculations
          castShadow={false} // Disabled for mobile performance
        />

        {/* Simplified lighting setup - removed extra directional lights for performance */}
        <directionalLight
          position={[20, 15, 20]}
          intensity={0.6} // Reduced intensity
          color={0xffffff}
          castShadow={false}
        />
      </group>
    );
  });
Lighting.displayName = "Lighting";

// Performance-optimized Solar System Scene
const SolarSystemScene: React.FC = React.memo(() => {
  const { camera } = useThree();
  const { metrics, updateMetrics } = usePerformanceMonitor();

  // Create all refs for centralized animation control
  const sunMeshRef = useRef<Mesh>(null);
  const sunCoronaRef = useRef<Mesh>(null);
  const sunLightRef = useRef<any>(null);

  // Calculate camera distance for LOD
  const [cameraDistance, setCameraDistance] = useState(55);

  useFrame(() => {
    setCameraDistance(camera.position.length());
  });

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
      planetaryCoronas: planetaryCoronaRefs || [],
      planets: planetRefs || [],
      camera: null, // Will be set by useFrame
      sunLight: sunLightRef.current,
    }),
    [planetRefs, planetaryCoronaRefs]
  );

  return (
    <>
      <Lighting lightRef={sunLightRef} />

      <Sun
        sunRef={sunMeshRef}
        coronaRef={sunCoronaRef}
        cameraDistance={cameraDistance}
      />

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
          cameraDistance={cameraDistance}
        />
      ))}

      <AnimationManager
        animationRefs={animationRefs}
        performanceMetrics={metrics}
        updateMetrics={updateMetrics}
      />
    </>
  );
});
SolarSystemScene.displayName = "SolarSystemScene";

// Optimized loading fallback
const LoadingFallback: React.FC = React.memo(() => {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 6, 6]} />
      <meshBasicMaterial color={0x444444} wireframe />
    </mesh>
  );
});
LoadingFallback.displayName = "LoadingFallback";

// Mobile-optimized main component for smooth orbital motion on phones
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
      far: 200, // Increased for better culling
    }),
    []
  );

  const glConfig = useMemo(
    () => ({
      antialias: false, // Disabled for mobile performance
      alpha: true,
      powerPreference: "high-performance" as const,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false, // Better mobile performance
      logarithmicDepthBuffer: false,
    }),
    []
  );

  // Cleanup function for memory management
  useEffect(() => {
    return () => {
      // Cleanup texture cache
      textureCache.forEach((texture) => {
        if (texture.dispose) texture.dispose();
      });
      textureCache.clear();

      // Cleanup geometry cache
      geometryCache.forEach((geometry) => {
        if (geometry.dispose) geometry.dispose();
      });
      geometryCache.clear();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={cameraConfig}
        gl={glConfig}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0);
          // More aggressive pixel ratio capping for mobile performance
          gl.pixelRatio = Math.min(
            1.2, // Reduced from 1.5 for better mobile performance
            typeof window !== "undefined" ? window.devicePixelRatio : 1
          );
          gl.shadowMap.enabled = false; // Disabled shadows for mobile performance

          // Mobile-optimized renderer settings
          gl.toneMapping = THREE.NoToneMapping; // Fastest tone mapping
          gl.outputColorSpace = THREE.SRGBColorSpace;

          // Performance optimizations
          gl.info.autoReset = false; // Reduce WebGL state changes
        }}
        frameloop="always" // Need continuous animation for orbital motion
        performance={{
          min: 0.5, // Lower minimum for mobile
          max: 0.8, // Lower maximum for stability
          debounce: 300, // Increased debounce for mobile stability
        }}
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
