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
import texRingB from "../../../assets/3d/tex_ring_b.png";

// Sun and corona textures
import texSunSpots from "../../../assets/3d/tex_sun_spots_02.png";
import texGradientCircle from "../../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSunI from "../../../assets/3d/tex_gradient_circle_sun_i.png";
import texGradientCircleSun from "../../../assets/3d/tex_gradient_circle_sun.png";

// Enhanced planet configuration with improved orbital speeds for better visibility
const PLANET_CONFIG = [
  {
    name: "Mercury",
    texture: texPlanetR,
    size: 0.4,
    distance: 4,
    orbitSpeed: 0.02, // Increased for better visibility
    rotationSpeed: 0.01,
    color: 0x8c7853,
    safeZone: 1.0,
    startAngle: 0, // Start at 0 degrees
  },
  {
    name: "Venus",
    texture: texPlanetA,
    size: 0.7,
    distance: 6.5,
    orbitSpeed: 0.016, // Increased for better visibility
    rotationSpeed: 0.008,
    color: 0xffc649,
    safeZone: 1.75,
    startAngle: Math.PI / 4, // Start at 45 degrees
    moons: [
      {
        texture: texMoonH,
        size: 0.2,
        distance: 2.2,
        orbitSpeed: 0.025, // Reduced from 0.08 for better observation
        safeZone: 0.5,
        startAngle: 0, // Moon starting position
      },
    ],
  },
  {
    name: "Earth",
    texture: texPlanetK,
    size: 0.8,
    distance: 8.5,
    orbitSpeed: 0.012, // Increased baseline speed for better engagement
    rotationSpeed: 0.02,
    color: 0x6b93d6,
    safeZone: 2.0,
    startAngle: Math.PI / 2, // Start at 90 degrees
    moons: [
      {
        texture: texMoonF,
        size: 0.25,
        distance: 2.5,
        orbitSpeed: 0.02, // Reduced from 0.06
        safeZone: 0.6,
        startAngle: Math.PI, // Moon starting position
      },
    ],
  },
  {
    name: "Mars",
    texture: texPlanetD,
    size: 0.6,
    distance: 12,
    orbitSpeed: 0.009, // Increased for better visibility
    rotationSpeed: 0.018,
    color: 0xcd5c5c,
    safeZone: 1.5,
    startAngle: (3 * Math.PI) / 4, // Start at 135 degrees
    moons: [
      {
        texture: texMoonG,
        size: 0.15,
        distance: 2.2,
        orbitSpeed: 0.025, // Reduced from 0.08
        safeZone: 0.4,
        startAngle: 0, // First moon starting position
      },
      {
        texture: texMoonD,
        size: 0.12,
        distance: 3.2,
        orbitSpeed: 0.018, // Reduced from 0.05
        safeZone: 0.3,
        startAngle: Math.PI, // Second moon opposite to first
      },
    ],
  },
  {
    name: "Jupiter",
    texture: texPlanetV,
    size: 2.2,
    distance: 18, // Increased from 16 to provide more space for rings
    orbitSpeed: 0.007, // Increased significantly for better visibility
    rotationSpeed: 0.04,
    color: 0xd8ca9d,
    safeZone: 6.5, // Increased to account for ring system
    startAngle: Math.PI, // Start at 180 degrees
    rings: {
      texture: texRingA,
      innerRadius: 2.6, // Slightly reduced inner radius
      outerRadius: 3.8, // Reduced outer radius to prevent collisions
      opacity: 0.6,
    },
    moons: [
      {
        texture: texMoonC,
        size: 0.3,
        distance: 4.5, // Adjusted to account for smaller rings
        orbitSpeed: 0.015, // Reduced from 0.04
        safeZone: 0.75,
        startAngle: Math.PI / 2, // Moon starting position
      },
    ],
  },
  {
    name: "Saturn",
    texture: texPlanetR,
    size: 1.9,
    distance: 29, // Increased further to provide clear separation from Jupiter's rings
    orbitSpeed: 0.005, // Increased significantly for better visibility
    rotationSpeed: 0.035,
    color: 0xfad5a5,
    safeZone: 5.5, // Adjusted for smaller rings
    startAngle: (5 * Math.PI) / 4, // Start at 225 degrees
    rings: {
      texture: texRingB,
      innerRadius: 2.0, // Further reduced inner radius
      outerRadius: 3.8, // Further reduced outer radius to prevent collisions
      opacity: 0.8,
    },
    moons: [
      {
        texture: texMoonC,
        size: 0.28,
        distance: 5.0, // Adjusted for smaller rings
        orbitSpeed: 0.012, // Reduced from 0.03
        safeZone: 0.7,
        startAngle: 0, // First moon starting position
      },
      {
        texture: texMoonD,
        size: 0.22,
        distance: 6.0, // Adjusted for smaller rings
        orbitSpeed: 0.008, // Reduced from 0.02
        safeZone: 0.55,
        startAngle: (2 * Math.PI) / 3, // Second moon at 120 degrees offset
      },
    ],
  },
  {
    name: "Uranus",
    texture: texPlanetR,
    size: 1.6,
    distance: 36, // Increased to provide safe distance from Saturn's rings
    orbitSpeed: 0.004, // Increased dramatically for much better visibility
    rotationSpeed: 0.025,
    color: 0x4fd0e3,
    safeZone: 4.0, // Adjusted for smaller rings
    startAngle: (3 * Math.PI) / 2, // Start at 270 degrees
    rings: {
      texture: texRingA,
      innerRadius: 1.8, // Slightly reduced inner radius
      outerRadius: 2.8, // Reduced outer radius to prevent collisions
      opacity: 0.4,
    },
    moons: [
      {
        texture: texMoonG,
        size: 0.18,
        distance: 3.5, // Adjusted for smaller rings
        orbitSpeed: 0.018, // Reduced from 0.05
        safeZone: 0.45,
        startAngle: Math.PI / 3, // Moon starting position
      },
    ],
  },
  {
    name: "Neptune",
    texture: texPlanetA,
    size: 1.5,
    distance: 42, // Increased to provide safe distance from Uranus
    orbitSpeed: 0.003, // Increased dramatically for much better visibility
    rotationSpeed: 0.028,
    color: 0x4b70dd,
    safeZone: 3.75,
    startAngle: (7 * Math.PI) / 4, // Start at 315 degrees
    moons: [
      {
        texture: texMoonF,
        size: 0.2,
        distance: 3.2,
        orbitSpeed: 0.015, // Reduced from 0.045
        safeZone: 0.5,
        startAngle: (3 * Math.PI) / 4, // Moon starting position
      },
    ],
  },
];

// Collision detection utilities
const CollisionDetector = {
  // Calculate distance between two 3D points
  distance3D: (
    pos1: [number, number, number],
    pos2: [number, number, number]
  ): number => {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  // Check if two spherical objects are colliding
  areSpheresColliding: (
    pos1: [number, number, number],
    radius1: number,
    pos2: [number, number, number],
    radius2: number,
    safetyMargin: number = 0.1
  ): boolean => {
    const distance = CollisionDetector.distance3D(pos1, pos2);
    const combinedRadius = radius1 + radius2 + safetyMargin;
    return distance < combinedRadius;
  },

  // Calculate safe orbital position to avoid collision
  calculateSafePosition: (
    idealPos: [number, number, number],
    obstaclePos: [number, number, number],
    minDistance: number
  ): [number, number, number] => {
    const currentDistance = CollisionDetector.distance3D(idealPos, obstaclePos);

    if (currentDistance >= minDistance) {
      return idealPos; // No collision, use ideal position
    }

    // Calculate direction vector from obstacle to ideal position
    const dx = idealPos[0] - obstaclePos[0];
    const dy = idealPos[1] - obstaclePos[1];
    const dz = idealPos[2] - obstaclePos[2];

    // Normalize the direction vector
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (magnitude === 0) {
      // If positions are identical, move object slightly
      return [idealPos[0] + minDistance, idealPos[1], idealPos[2]];
    }

    const normalizedX = dx / magnitude;
    const normalizedY = dy / magnitude;
    const normalizedZ = dz / magnitude;

    // Position the object at minimum safe distance
    return [
      obstaclePos[0] + normalizedX * minDistance,
      obstaclePos[1] + normalizedY * minDistance,
      obstaclePos[2] + normalizedZ * minDistance,
    ];
  },

  // Check collision with planet
  checkPlanetCollision: (
    moonPos: [number, number, number],
    planetPos: [number, number, number],
    moonSize: number,
    planetSize: number,
    safetyMargin: number = 0.2
  ): boolean => {
    return CollisionDetector.areSpheresColliding(
      moonPos,
      moonSize,
      planetPos,
      planetSize,
      safetyMargin
    );
  },

  // Check collision between moons
  checkMoonCollision: (
    moon1Pos: [number, number, number],
    moon1Size: number,
    moon2Pos: [number, number, number],
    moon2Size: number,
    safetyMargin: number = 0.15
  ): boolean => {
    return CollisionDetector.areSpheresColliding(
      moon1Pos,
      moon1Size,
      moon2Pos,
      moon2Size,
      safetyMargin
    );
  },
};

// Optimized geometry configurations - reduced complexity for performance
const GEOMETRY_CONFIG = {
  sun: { widthSegments: 24, heightSegments: 24 }, // Reduced from 32,32
  planet: { widthSegments: 16, heightSegments: 16 }, // Reduced from 24,24
  moon: { widthSegments: 12, heightSegments: 12 }, // Reduced from 16,16
  ring: { segments: 32 }, // Reduced from 64
  corona: { widthSegments: 16, heightSegments: 16 }, // For planet coronas
};

// Planetary Corona component with customizable size and intensity
interface PlanetaryCoronaProps {
  planetSize: number;
  color?: number;
  intensity?: number;
}

const PlanetaryCorona: React.FC<PlanetaryCoronaProps> = ({
  planetSize,
  color = 0xfff5e1,
  intensity = 0.3,
}) => {
  const coronaRef = useRef<Mesh>(null);

  // Load corona texture
  const coronaTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texGradientCircle).uri
  );

  // Enhanced pulsing animation effect for planetary corona
  const animateCorona = useCallback((state: any) => {
    if (coronaRef.current) {
      // Add subtle pulsing effect with slower, more gentle movement
      const time = state.clock.getElapsedTime();
      const scale = 1 + Math.sin(time * 2.0) * 0.05; // Gentler pulsing for planets
      const rotation = time * 0.3; // Slower rotation

      coronaRef.current.scale.setScalar(scale);
      coronaRef.current.rotation.z = rotation;
    }
  }, []);

  useFrame(animateCorona);

  // Calculate corona size relative to planet size
  const coronaSize = planetSize * 4; // 4x the planet size

  return (
    <Billboard>
      <mesh ref={coronaRef} position={[0, 0, 0]}>
        <planeGeometry args={[coronaSize, coronaSize]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={intensity}
          blending={2} // AdditiveBlending
          depthWrite={false}
          side={2} // DoubleSide
          color={color}
        />
      </mesh>
    </Billboard>
  );
};

// Enhanced Corona component for the Sun
const SunCorona: React.FC = () => {
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
          opacity={0.95}
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

  // Load sun surface texture with proper error handling
  const sunTexture = useLoader(
    TextureLoader,
    Asset.fromModule(texSunSpots).uri as string
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
      <SunCorona />

      {/* Main sun body with enhanced material */}
      <mesh ref={sunRef} position={[0, 0, 0]} castShadow={false}>
        <sphereGeometry args={sunGeometry} />
        <meshPhongMaterial
          map={sunTexture}
          emissive={0xffaa00}
          emissiveIntensity={1.2}
          color={0xffcc00}
          shininess={5}
          specular={0xffcc44}
          transparent={false}
          opacity={1}
        />
      </mesh>
    </group>
  );
};

// Enhanced Moon component with comprehensive collision detection
interface MoonProps {
  config: {
    texture: any;
    size: number;
    distance: number;
    orbitSpeed: number;
    safeZone?: number;
    startAngle?: number;
  };
  planetPosition: [number, number, number];
  planetSize: number;
  planetRings?: {
    innerRadius: number;
    outerRadius: number;
  };
  otherMoons?: Array<{
    position: [number, number, number];
    size: number;
    safeZone?: number;
  }>;
  moonIndex?: number; // Index of this moon for identification
}

const Moon: React.FC<MoonProps> = ({
  config,
  planetPosition,
  planetSize,
  planetRings,
  otherMoons = [],
  moonIndex = 0,
}) => {
  const moonRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const moonOrbitTime = useRef(config.startAngle || 0); // Use proper starting position
  const collisionAvoidanceOffset = useRef({ x: 0, y: 0, z: 0 });

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Enhanced animation with comprehensive collision detection
  const animateMoon = useCallback(() => {
    // Update moon's orbital position around its planet
    moonOrbitTime.current += config.orbitSpeed;

    if (moonRef.current) {
      // Calculate ideal orbital position around the planet
      let x = Math.cos(moonOrbitTime.current) * config.distance;
      let z = Math.sin(moonOrbitTime.current) * config.distance;
      let y = 0;

      // Ring collision detection - prevent moons from passing through rings
      if (planetRings) {
        const distanceFromPlanet = Math.sqrt(x * x + z * z);

        // If moon would pass through ring area, adjust its orbit to go above/below
        if (
          distanceFromPlanet >= planetRings.innerRadius &&
          distanceFromPlanet <= planetRings.outerRadius
        ) {
          // Move moon above the ring plane with dynamic height
          y = 1.8 + Math.sin(moonOrbitTime.current * 2) * 0.6;
        }
      }

      // Calculate world position for collision detection
      const worldPos: [number, number, number] = [
        planetPosition[0] + x,
        planetPosition[1] + y,
        planetPosition[2] + z,
      ];

      // Planet collision detection - ensure moon doesn't get too close to planet
      const planetWorldPos: [number, number, number] = planetPosition;
      const minDistanceFromPlanet =
        planetSize + config.size + (config.safeZone || 0.5);

      if (
        CollisionDetector.checkPlanetCollision(
          worldPos,
          planetWorldPos,
          config.size,
          planetSize,
          config.safeZone || 0.2
        )
      ) {
        // Push moon away from planet
        const distance = CollisionDetector.distance3D(worldPos, planetWorldPos);
        if (distance < minDistanceFromPlanet) {
          const pushFactor = minDistanceFromPlanet / distance;
          x *= pushFactor;
          z *= pushFactor;
          // Also add some vertical offset to avoid the planet
          y = Math.max(y, planetSize * 0.8 + config.size);
        }
      }

      // Moon-to-moon collision detection
      let finalX = x;
      let finalY = y;
      let finalZ = z;

      for (let i = 0; i < otherMoons.length; i++) {
        const otherMoon = otherMoons[i];
        const moonWorldPos: [number, number, number] = [
          planetPosition[0] + finalX,
          planetPosition[1] + finalY,
          planetPosition[2] + finalZ,
        ];

        if (
          CollisionDetector.checkMoonCollision(
            moonWorldPos,
            config.size,
            otherMoon.position,
            otherMoon.size,
            (config.safeZone || 0.3) + (otherMoon.safeZone || 0.3)
          )
        ) {
          // Avoid collision by adjusting position
          const minDistance =
            config.size +
            otherMoon.size +
            (config.safeZone || 0.3) +
            (otherMoon.safeZone || 0.3);
          const safePos = CollisionDetector.calculateSafePosition(
            moonWorldPos,
            otherMoon.position,
            minDistance
          );

          // Convert back to relative position
          finalX = safePos[0] - planetPosition[0];
          finalY = safePos[1] - planetPosition[1];
          finalZ = safePos[2] - planetPosition[2];
        }
      }

      // Apply the final position
      moonRef.current.position.set(finalX, finalY, finalZ);
    }

    if (meshRef.current) {
      // Moon rotation on its own axis
      meshRef.current.rotation.y += 0.02;
    }
  }, [
    config.orbitSpeed,
    config.distance,
    config.size,
    config.safeZone,
    planetRings,
    planetPosition,
    planetSize,
    otherMoons,
    moonIndex,
  ]);

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
      <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow castShadow>
        <sphereGeometry args={moonGeometry} />
        <meshPhongMaterial
          map={texture}
          shininess={15}
          specular={0x444444}
          emissive={0x111111}
          emissiveIntensity={0.05}
        />
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
      receiveShadow
      castShadow
    >
      <ringGeometry args={ringGeometry} />
      <meshPhongMaterial
        map={texture}
        transparent
        opacity={config.opacity}
        side={2} // DoubleSide
        shininess={25}
        specular={0x666666}
        emissive={0x222222}
        emissiveIntensity={0.08}
      />
    </mesh>
  );
};

// Enhanced Planet component with improved materials and atmospheric effects
interface PlanetProps {
  config: (typeof PLANET_CONFIG)[0];
}

const Planet: React.FC<PlanetProps> = ({ config }) => {
  const planetGroupRef = useRef<Group>(null);
  const planetMeshRef = useRef<Mesh>(null);
  // Use proper starting orbital position based on configuration
  const orbitTime = useRef(config.startAngle || 0);

  const texture = useLoader(
    TextureLoader,
    Asset.fromModule(config.texture).uri
  );

  // Enhanced material properties based on planet type
  const planetMaterial = useMemo(() => {
    const baseProps = {
      map: texture,
      color: config.color,
      shininess: 30,
      specular: 0x444444,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    };

    // Planet-specific material enhancements
    switch (config.name) {
      case "Mercury":
        return {
          ...baseProps,
          shininess: 5,
          specular: 0x222222,
          emissive: 0x111111,
          emissiveIntensity: 0.1,
        };
      case "Venus":
        return {
          ...baseProps,
          shininess: 80,
          specular: 0x888844,
          emissive: 0x332211,
          emissiveIntensity: 0.15,
        };
      case "Earth":
        return {
          ...baseProps,
          shininess: 40,
          specular: 0x4466aa,
          emissive: 0x001122,
          emissiveIntensity: 0.08,
        };
      case "Mars":
        return {
          ...baseProps,
          shininess: 20,
          specular: 0x442222,
          emissive: 0x220000,
          emissiveIntensity: 0.05,
        };
      case "Jupiter":
        return {
          ...baseProps,
          shininess: 60,
          specular: 0x666644,
          emissive: 0x221100,
          emissiveIntensity: 0.12,
        };
      case "Saturn":
        return {
          ...baseProps,
          shininess: 50,
          specular: 0x555533,
          emissive: 0x221100,
          emissiveIntensity: 0.1,
        };
      case "Uranus":
        return {
          ...baseProps,
          shininess: 70,
          specular: 0x336677,
          emissive: 0x001133,
          emissiveIntensity: 0.08,
        };
      case "Neptune":
        return {
          ...baseProps,
          shininess: 75,
          specular: 0x334466,
          emissive: 0x001122,
          emissiveIntensity: 0.1,
        };
      default:
        return baseProps;
    }
  }, [texture, config.color, config.name]);

  // Improved animation with stable orbital mechanics
  const animatePlanet = useCallback(
    (state: any) => {
      // Update orbital position using proper Kepler's laws
      orbitTime.current += config.orbitSpeed;

      if (planetGroupRef.current) {
        // Calculate stable orbital position around the sun
        const x = Math.cos(orbitTime.current) * config.distance;
        const z = Math.sin(orbitTime.current) * config.distance;

        // Remove elliptical variation to keep planets in consistent orbits
        // This ensures planets stay at their designated distances and remain visible
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
      {/* Planetary Corona - applied to each planet */}
      <PlanetaryCorona
        planetSize={config.size}
        color={config.color}
        intensity={0.25}
      />

      {/* Enhanced Planet with improved materials */}
      <mesh ref={planetMeshRef} position={[0, 0, 0]} receiveShadow castShadow>
        <sphereGeometry args={planetGeometry} />
        <meshPhongMaterial
          map={planetMaterial.map}
          color={planetMaterial.color}
          shininess={planetMaterial.shininess}
          specular={planetMaterial.specular}
          emissive={planetMaterial.emissive}
          emissiveIntensity={planetMaterial.emissiveIntensity}
          transparent={false}
          opacity={1}
        />
      </mesh>

      {/* Rings positioned relative to planet */}
      {config.rings && (
        <Ring config={config.rings} planetPosition={[0, 0, 0]} />
      )}

      {/* Moons positioned relative to planet with comprehensive collision detection */}
      {config.moons?.map((moon, index) => {
        // Calculate actual positions of other moons for proper collision detection
        const otherMoons =
          config.moons
            ?.filter((_, i) => i !== index)
            .map((otherMoon, otherIndex) => {
              // Use proper starting angle for each moon to calculate their actual positions
              const otherOrbitTime =
                otherMoon.startAngle ||
                (otherIndex * (Math.PI * 2)) / (config.moons?.length || 1);
              return {
                position: [
                  Math.cos(otherOrbitTime) * otherMoon.distance,
                  0,
                  Math.sin(otherOrbitTime) * otherMoon.distance,
                ] as [number, number, number],
                size: otherMoon.size,
                safeZone: otherMoon.safeZone || 0.3,
              };
            }) || [];

        return (
          <Moon
            key={index}
            config={moon}
            planetPosition={[0, 0, 0]}
            planetSize={config.size}
            planetRings={config.rings}
            otherMoons={otherMoons}
            moonIndex={index}
          />
        );
      })}
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

    // Optimized camera orbit for viewing properly spaced planets with corrected orbital mechanics
    const time = currentTime * 0.03; // Even slower camera movement for better observation of orbital mechanics
    const cameraDistance = 58; // Increased distance to accommodate Neptune at 42 units with safe margins
    const heightVariation = 6; // Reduced height variation for more stable viewing

    state.camera.position.x = Math.cos(time) * cameraDistance;
    state.camera.position.z = Math.sin(time) * cameraDistance;
    state.camera.position.y =
      Math.sin(currentTime * 0.025) * heightVariation + 20; // Higher camera position for better overview
    state.camera.lookAt(0, 0, 0); // Always look at the sun
  }, []);

  useFrame(animateCamera);
  return null;
};

// Enhanced lighting setup for realistic solar system illumination
const Lighting: React.FC = () => {
  const lightGroupRef = useRef<Group>(null);

  // Dynamic lighting animation for more realistic sun behavior
  const animateLighting = useCallback((state: any) => {
    if (lightGroupRef.current) {
      const time = state.clock.getElapsedTime();

      // Subtle intensity variation to simulate solar activity
      const sunIntensityVariation = 1 + Math.sin(time * 0.5) * 0.1;

      // Get the sun point light and update its intensity
      const sunLight = lightGroupRef.current.children.find(
        (child: any) => child.userData?.name === "sunLight"
      );
      if (sunLight) {
        (sunLight as any).intensity = 12 * sunIntensityVariation;
      }
    }
  }, []);

  useFrame(animateLighting);

  return (
    <group ref={lightGroupRef}>
      {/* Enhanced ambient light with subtle blue tint (space background) */}
      <ambientLight intensity={0.8} color={0x404060} />

      {/* Primary Sun Light - Realistic solar illumination */}
      <pointLight
        userData={{ name: "sunLight" }}
        position={[0, 0, 0]}
        intensity={12}
        color={0xfff2e6}
        distance={100}
        decay={1.2}
        castShadow={true}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
      />

      {/* Secondary sun point light for corona effects */}
      <pointLight
        position={[0, 0, 0]}
        intensity={3}
        color={0xffbb77}
        distance={80}
        decay={2}
      />

      {/* Rim lighting for dramatic planet edges */}
      <directionalLight
        position={[50, 30, 40]}
        intensity={1.2}
        color={0xffffff}
        castShadow={false}
      />

      {/* Counter rim light for balance */}
      <directionalLight
        position={[-40, 25, -30]}
        intensity={0.8}
        color={0xffffdd}
        castShadow={false}
      />

      {/* Subtle back lighting for space depth */}
      <directionalLight
        position={[0, -20, -50]}
        intensity={0.4}
        color={0x8888bb}
        castShadow={false}
      />

      {/* Inner planet illumination enhancement */}
      <pointLight
        position={[15, 8, 15]}
        intensity={2}
        color={0xffe4b3}
        distance={25}
        decay={1.5}
      />

      {/* Outer planet illumination enhancement */}
      <pointLight
        position={[-25, 5, -25]}
        intensity={1.5}
        color={0xfff8f0}
        distance={50}
        decay={1.8}
      />

      {/* Atmospheric scattering simulation for inner planets */}
      <rectAreaLight
        position={[0, 0, 0]}
        width={30}
        height={30}
        intensity={0.3}
        color={0xffeedd}
      />
    </group>
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

      {/* All 8 planets with enhanced features */}
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
