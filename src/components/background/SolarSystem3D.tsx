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
 * @author Riddle Quest Development Team
 * @version 1.1.0
 * @since 2024
 */

/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import React, {useRef, useMemo, useState, useEffect} from "react";
import {Canvas, useFrame} from "@react-three/fiber";
import {
  Mesh,
  Group,
  SphereGeometry,
  RingGeometry,
  MeshBasicMaterial,
  MeshPhongMaterial,
  ColorManagement,
  Texture,
  DoubleSide,
} from "three";
import type {MeshBasicMaterialParameters} from "three";
import {AppState, StyleSheet, View} from "react-native";
import {SOLAR_SYSTEM_CONFIG} from "./SolarSystemConfig";
import {dimensions} from "../../utils/responsive";
import {loadTextureFromAsset, resolveAssetModule} from "../../services/solar/textureLoader";
import type {AssetModuleReference} from "../../services/solar/textureLoader";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";
// Import texture assets
import sunTextureModule from "../../../assets/3d/tex_sun_spots_02.png";

// Expo's EXGL doesn't support UNPACK_COLORSPACE_CONVERSION_WEBGL which Three.js
// r152+ tries to set when color management is enabled.
ColorManagement.enabled = false;

const EXGL_UNSUPPORTED_PIXEL_STORE_PARAMETERS = new Set<number>([
  0x9240, // UNPACK_FLIP_Y_WEBGL
  0x9241, // UNPACK_PREMULTIPLY_ALPHA_WEBGL
  0x9243, // UNPACK_COLORSPACE_CONVERSION_WEBGL
]);

// Cache for loaded textures
const textureCache = new Map<string | number, Texture>();
const sphereGeometryCache = new Map<string, SphereGeometry>();
const ringGeometryCache = new Map<string, RingGeometry>();
let texturedPhongMaterialCache = new WeakMap<Texture, MeshPhongMaterial>();
let texturedRingMaterialCache = new WeakMap<Texture, MeshPhongMaterial>();
let fallbackPhongMaterial: MeshPhongMaterial | null = null;
let fallbackRingMaterial: MeshPhongMaterial | null = null;

const isTextureDebugEnabled = process.env.EXPO_PUBLIC_TEXTURE_DEBUG === "1";
const SUN_POSITION: [number, number, number] = [0, 30, 0];

const textureDebugLog = (level: "log" | "warn" | "error", message: string, details?: Record<string, unknown>): void => {
  if (!isTextureDebugEnabled) {
    return;
  }

  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console[level](`[SolarTexture] ${message}${payload}`);
};

// Test-only helper to clear module cache between unit tests.
export const __resetSolarSystem3DTextureCacheForTests = (): void => {
  textureCache.clear();
  sphereGeometryCache.clear();
  ringGeometryCache.clear();
  texturedPhongMaterialCache = new WeakMap<Texture, MeshPhongMaterial>();
  texturedRingMaterialCache = new WeakMap<Texture, MeshPhongMaterial>();
  fallbackPhongMaterial = null;
  fallbackRingMaterial = null;
};

const getSphereGeometry = (radius: number, widthSegments: number, heightSegments: number): SphereGeometry => {
  const key = `${radius}:${widthSegments}:${heightSegments}`;
  const cached = sphereGeometryCache.get(key);
  if (cached) {
    return cached;
  }

  const geometry = new SphereGeometry(radius, widthSegments, heightSegments);
  sphereGeometryCache.set(key, geometry);
  return geometry;
};

const getRingGeometry = (innerRadius: number, outerRadius: number): RingGeometry => {
  const key = `${innerRadius}:${outerRadius}`;
  const cached = ringGeometryCache.get(key);
  if (cached) {
    return cached;
  }

  const geometry = new RingGeometry(innerRadius, outerRadius, 64);
  ringGeometryCache.set(key, geometry);
  return geometry;
};

const getSharedTexturedPhongMaterial = (texture: Texture | null): MeshPhongMaterial => {
  if (!texture) {
    if (!fallbackPhongMaterial) {
      fallbackPhongMaterial = new MeshPhongMaterial({
        color: 0xd8d8d8,
        shininess: 30,
        specular: 0x222222,
      });
    }
    return fallbackPhongMaterial;
  }

  const cached = texturedPhongMaterialCache.get(texture);
  if (cached) {
    return cached;
  }

  const material = new MeshPhongMaterial({
    map: texture,
    color: 0xffffff,
    shininess: 34,
    specular: 0x3a3a3a,
  });
  texturedPhongMaterialCache.set(texture, material);
  return material;
};

const getSharedRingMaterial = (texture: Texture | null): MeshPhongMaterial => {
  if (!texture) {
    if (!fallbackRingMaterial) {
      fallbackRingMaterial = new MeshPhongMaterial({
        color: 0xe4d6a4,
        opacity: 0.42,
        depthWrite: false,
        alphaTest: 0.01,
        side: DoubleSide,
        transparent: true,
      });
    }
    return fallbackRingMaterial;
  }

  const cached = texturedRingMaterialCache.get(texture);
  if (cached) {
    return cached;
  }

  const material = new MeshPhongMaterial({
    map: texture,
    color: 0xffffff,
    opacity: 0.48,
    depthWrite: false,
    alphaTest: 0.01,
    side: DoubleSide,
    transparent: true,
  });
  texturedRingMaterialCache.set(texture, material);
  return material;
};

export const __createSharedRingMaterialForTests = getSharedRingMaterial;

const createSunMaterial = (texture: Texture | null): MeshBasicMaterial => {
  const materialParameters: MeshBasicMaterialParameters = {
    color: 0xfff4d6,
    toneMapped: false,
    transparent: false,
  };

  if (texture) {
    materialParameters.map = texture;
  }

  return new MeshBasicMaterial(materialParameters);
};

export const __createSunMaterialForTests = createSunMaterial;

/**
 * Custom hook to load textures for React Native using expo-asset directly.
 * Avoids expo-three's problematic loader imports.
 */
function useExpoTexture(assetModule: AssetModuleReference | null | undefined): Texture | null {
  const resolvedModule = useMemo(() => (assetModule == null ? null : resolveAssetModule(assetModule)), [assetModule]);

  const [texture, setTexture] = useState<Texture | null>(() => {
    return resolvedModule == null ? null : textureCache.get(resolvedModule) || null;
  });

  useEffect(() => {
    if (resolvedModule == null) {
      setTexture(null);
      return undefined;
    }

    let mounted = true;
    const loadTexture = async () => {
      try {
        const cached = textureCache.get(resolvedModule);
        if (cached) {
          if (mounted) {
            setTexture(cached);
          }
          return;
        }

        const loaded = await loadTextureFromAsset(resolvedModule, String(resolvedModule));
        textureCache.set(resolvedModule, loaded);

        textureDebugLog("log", "three texture created", {
          module: resolvedModule,
          hasImage: Boolean(loaded.image),
          image: loaded.image as Record<string, unknown>,
          needsUpdate: loaded.needsUpdate,
        });

        if (mounted) {
          setTexture(loaded);
        }
      } catch (error) {
        textureDebugLog("error", "asset load failed", {
          module: resolvedModule,
          error: error instanceof Error ? error.message : String(error),
        });
        console.warn("Failed to load texture:", error);
      }
    };

    loadTexture();
    return () => {
      mounted = false;
    };
  }, [resolvedModule]);

  return texture;
}

const {screenWidth: SCREEN_WIDTH, screenHeight: SCREEN_HEIGHT} = dimensions;

// Pre-defined shared geometries — lower segment counts are fine for a background
const sunGeometry = getSphereGeometry(12.0, 48, 48);

/**
 * Sun component with enhanced size and brightness for dramatic effect.
 * Creates a self-rotating sun at the center of the solar system.
 *
 * @returns {JSX.Element} Rendered sun mesh with texture
 */
const Sun: React.FC = React.memo(() => {
  const sunRef = useRef<Mesh>(null);
  const sunTexture = useExpoTexture(sunTextureModule);

  const sunMaterial = useMemo(() => createSunMaterial(sunTexture), [sunTexture]);

  useFrame(() => {
    __applySunFrameUpdateForTests(sunRef.current as unknown as {rotation: {x: number; y: number}} | null);
  });

  return (
    <group position={[0, 30, 0]}>
      <mesh ref={sunRef} geometry={sunGeometry} material={sunMaterial} />
    </group>
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
 * @property {number} textureModule - Asset module for the moon's texture
 * @property {number} startAngle - Initial orbital position in radians
 */
interface MoonProps {
  moonConfig: {
    size: number;
    distance: number;
    orbitSpeed: number;
    color: number;
    textureKey: string;
    textureModule: number;
    startAngle: number;
  };
}

export const __applySunFrameUpdateForTests = (sun: {rotation: {x: number; y: number}} | null): void => {
  if (sun) {
    sun.rotation.y += 0.008;
    sun.rotation.x += 0.002;
  }
};

export const __applyMoonFrameUpdateForTests = (
  moon: {
    position: {set: (x: number, y: number, z: number) => void};
    rotation: {y: number};
  } | null,
  orbit: number,
  moonConfig: MoonProps["moonConfig"],
): number => {
  const nextOrbit = orbit + moonConfig.orbitSpeed;

  if (moon) {
    const x = Math.cos(nextOrbit) * moonConfig.distance;
    const z = Math.sin(nextOrbit) * moonConfig.distance;

    moon.position.set(x, 0, z);
    moon.rotation.y += 0.02;
  }

  return nextOrbit;
};

/**
 * Moon component that orbits around a parent planet.
 * Creates a textured moon that orbits its parent with configurable parameters.
 *
 * @param {MoonProps} props - Configuration properties for the moon
 * @returns {JSX.Element} Rendered moon mesh with orbital motion
 */
const Moon: React.FC<MoonProps> = React.memo(({moonConfig}) => {
  const moonRef = useRef<Mesh>(null);
  const orbitTime = useRef(moonConfig.startAngle);
  const texture = useExpoTexture(moonConfig.textureModule);

  const moonGeometry = useMemo(() => getSphereGeometry(moonConfig.size * 1.4, 16, 16), [moonConfig.size]);
  const moonMaterial = useMemo(() => getSharedTexturedPhongMaterial(texture), [texture]);

  useFrame(() => {
    orbitTime.current = __applyMoonFrameUpdateForTests(
      moonRef.current as unknown as {
        position: {set: (x: number, y: number, z: number) => void};
        rotation: {y: number};
      } | null,
      orbitTime.current,
      moonConfig,
    );
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

export const __applyPlanetFrameUpdateForTests = (
  group: {position: {set: (x: number, y: number, z: number) => void}} | null,
  mesh: {rotation: {y: number}} | null,
  orbit: number,
  config: PlanetProps["config"],
): number => {
  const nextOrbit = orbit + config.orbitSpeed;

  if (group) {
    const x = Math.cos(nextOrbit) * config.distance;
    const z = Math.sin(nextOrbit) * config.distance;
    group.position.set(x, config.yPosition, z);
  }

  if (mesh) {
    mesh.rotation.y += config.rotationSpeed;
  }

  return nextOrbit;
};

/**
 * Planet component with orbital mechanics and moon system.
 * Creates a textured planet that orbits the sun and hosts its own moon system.
 *
 * @param {PlanetProps} props - Configuration properties for the planet
 * @returns {JSX.Element} Rendered planet group with orbital motion and moons
 */
const Planet: React.FC<PlanetProps> = React.memo(({config}) => {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const orbitTime = useRef(config.startAngle);
  const planetTexture = useExpoTexture(config.textureModule);
  const ringTexture = useExpoTexture(config.ring?.textureModule);

  const planetGeometry = useMemo(() => getSphereGeometry(config.size, 32, 32), [config.size]);
  const planetMaterial = useMemo(() => getSharedTexturedPhongMaterial(planetTexture), [planetTexture]);
  const ringGeometry = useMemo(
    () => (config.ring ? getRingGeometry(config.ring.innerRadius, config.ring.outerRadius) : null),
    [config.ring],
  );
  const ringMaterial = useMemo(
    () => (config.ring ? getSharedRingMaterial(ringTexture) : null),
    [config.ring, ringTexture],
  );

  useFrame(() => {
    orbitTime.current = __applyPlanetFrameUpdateForTests(
      groupRef.current as unknown as {
        position: {set: (x: number, y: number, z: number) => void};
      } | null,
      meshRef.current as unknown as {rotation: {y: number}} | null,
      orbitTime.current,
      config,
    );
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={planetGeometry} material={planetMaterial} />
      {config.ring && ringGeometry && ringMaterial ? (
        <mesh geometry={ringGeometry} material={ringMaterial} rotation={[config.ring.tiltRadians, 0, 0]} />
      ) : null}
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
      <pointLight position={SUN_POSITION} intensity={45000} color={0xfff4d6} distance={0} decay={2} />

      <Sun />

      {SOLAR_SYSTEM_CONFIG.map((planetConfig) => (
        <Planet key={planetConfig.name} config={planetConfig} />
      ))}
    </>
  );
};

interface SolarSystem3DProps {
  visible?: boolean;
}

const isVisibleAppState = (state: string | null | undefined): boolean => state !== "background" && state !== "inactive";

export const __getSolarCanvasFrameloopForTests = (isVisible: boolean): "always" | "never" =>
  isVisible ? "always" : "never";

/**
 * Main SolarSystem3D component that renders the 3D solar system.
 * Creates a full-screen canvas with the solar system scene and proper camera positioning.
 *
 * @returns {JSX.Element} Rendered solar system component
 */
const SolarSystem3D: React.FC<SolarSystem3DProps> = ({visible = true}) => {
  const [isAppActive, setIsAppActive] = useState(() => isVisibleAppState(AppState.currentState));

  useEffect(() => {
    if (typeof AppState.addEventListener !== "function") {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(isVisibleAppState(nextState));
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const canvasStyle = useMemo(
    () => ({
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      position: "absolute" as const,
      top: 0,
      left: 0,
      zIndex: 1,
    }),
    [],
  );

  const cameraConfig = useMemo(
    () => ({
      position: [0, 45, 350] as [number, number, number],
      fov: 60,
      near: 0.1,
      far: 1700,
    }),
    [],
  );
  const frameloop = useMemo(
    () => __getSolarCanvasFrameloopForTests(visible && isAppActive && !isQASurfaceRuntimeActive()),
    [visible, isAppActive],
  );

  return (
    <View style={styles.container}>
      <Canvas
        style={canvasStyle}
        camera={cameraConfig}
        dpr={[1, 1.5]}
        gl={{alpha: true}}
        onCreated={({gl, camera}) => {
          const webglContext = gl.getContext();
          const originalPixelStorei = webglContext.pixelStorei.bind(webglContext);
          if (originalPixelStorei) {
            webglContext.pixelStorei = ((pname, param) => {
              if (EXGL_UNSUPPORTED_PIXEL_STORE_PARAMETERS.has(pname)) {
                return;
              }
              originalPixelStorei(pname, param);
            }) as typeof webglContext.pixelStorei;
          }

          gl.setClearColor(0x000000, 0);
          camera.lookAt(0, 0, 0);
        }}
        frameloop={frameloop}
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
