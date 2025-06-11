import {
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  AmbientLight,
  PointLight,
  Clock,
  Group,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  RingGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Texture,
} from "three";
import { TexturePreloader, TexturePreloadProgress } from "./TexturePreloader";

// Import textures using relative path to assets
import texPlanetR from "../../assets/3d/tex_planet_r.png";
import texPlanetV from "../../assets/3d/tex_planet_v.png";
import texPlanetA from "../../assets/3d/tex_planet_a.png";
import texPlanetD from "../../assets/3d/tex_planet_d.png";
import texPlanetK from "../../assets/3d/tex_planet_k.png";

import texMoonH from "../../assets/3d/tex_moon_h.png";
import texMoonF from "../../assets/3d/tex_moon_f.png";
import texMoonG from "../../assets/3d/tex_moon_g.png";
import texMoonC from "../../assets/3d/tex_moon_c.png";
import texMoonD from "../../assets/3d/tex_moon_d.png";

import texRingA from "../../assets/3d/tex_ring_a.png";
import texRingB from "../../assets/3d/tex_ring_b.png";

export interface PlanetConfig {
  id: string;
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  radius: number;
  moons?: MoonConfig[];
  rings?: RingConfig;
}

export interface MoonConfig {
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  radius: number;
}

interface RingConfig {
  texture: string;
  innerRadius: number;
  outerRadius: number;
}

export interface SolarSystemPreloadProgress {
  phase: "textures" | "geometries" | "materials" | "scene" | "complete";
  loaded: number;
  total: number;
  currentItem: string;
  percentage: number;
  textureProgress?: TexturePreloadProgress;
}

export interface PreloadedSolarSystem {
  scene: Scene;
  camera: PerspectiveCamera;
  clock: Clock;
  planetsGroup: Group;
  meshes: Mesh[];
  lights: (DirectionalLight | AmbientLight | PointLight)[];
  geometries: Map<string, SphereGeometry | RingGeometry>;
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>;
  textures: Map<string, Texture | null>;
}

export class SolarSystemPreloader {
  private static preloadedSystem: PreloadedSolarSystem | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;

  // Define realistic 3D solar system configuration matching the reference image
  private static readonly solarSystemConfig: PlanetConfig[] = [
    // Mercury - planet_r (small rocky planet, closest to sun) - SCALED UP for visibility
    {
      id: "mercury",
      texture: texPlanetR,
      orbitRadius: 6, // Increased from 4
      orbitSpeed: 0.025,
      rotationSpeed: 0.008,
      radius: 0.5, // Increased from 0.25
    },
    // Venus - planet_v (medium planet with rings) - SCALED UP for visibility
    {
      id: "venus",
      texture: texPlanetV,
      orbitRadius: 9, // Increased from 6
      orbitSpeed: 0.018,
      rotationSpeed: 0.003,
      radius: 0.8, // Increased from 0.4
      rings: {
        texture: texRingA,
        innerRadius: 1.0, // Increased from 0.55
        outerRadius: 1.5, // Increased from 0.9
      },
    },
    // Earth - planet_a (blue-green planet with 1 moon) - SCALED UP for visibility
    {
      id: "earth",
      texture: texPlanetA,
      orbitRadius: 12, // Increased from 8
      orbitSpeed: 0.015,
      rotationSpeed: 0.01,
      radius: 0.9, // Increased from 0.45
      moons: [
        {
          texture: texMoonH,
          orbitRadius: 1.5, // Increased from 0.8
          orbitSpeed: 0.08,
          radius: 0.2, // Increased from 0.1
        },
      ],
    },
    // Mars - planet_d (red planet with 2 small moons) - SCALED UP for visibility
    {
      id: "mars",
      texture: texPlanetD,
      orbitRadius: 16, // Increased from 11
      orbitSpeed: 0.012,
      rotationSpeed: 0.009,
      radius: 0.7, // Increased from 0.35
      moons: [
        {
          texture: texMoonF,
          orbitRadius: 1.2, // Increased from 0.6
          orbitSpeed: 0.06,
          radius: 0.12, // Increased from 0.06
        },
        {
          texture: texMoonG,
          orbitRadius: 1.8, // Increased from 0.9
          orbitSpeed: 0.04,
          radius: 0.1, // Increased from 0.05
        },
      ],
    },
    // Jupiter - planet_k (largest planet with rings and moons) - SCALED UP for visibility
    {
      id: "jupiter",
      texture: texPlanetK,
      orbitRadius: 22, // Increased from 16
      orbitSpeed: 0.008,
      rotationSpeed: 0.015,
      radius: 2.0, // Increased from 1.2
      moons: [
        {
          texture: texMoonC,
          orbitRadius: 3.0, // Increased from 1.8
          orbitSpeed: 0.04,
          radius: 0.3, // Increased from 0.18
        },
        {
          texture: texMoonD,
          orbitRadius: 4.0, // Increased from 2.5
          orbitSpeed: 0.03,
          radius: 0.25, // Increased from 0.15
        },
      ],
      rings: {
        texture: texRingB,
        innerRadius: 2.5, // Increased from 1.4
        outerRadius: 3.5, // Increased from 2.2
      },
    },
  ];

  /**
   * Preload the complete 3D solar system scene
   */
  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void
  ): Promise<PreloadedSolarSystem> {
    // OPTIMIZATION: Return immediately if already preloaded
    if (this.isPreloaded && this.preloadedSystem) {
      console.log(
        "SolarSystemPreloader: System already preloaded - returning cached system"
      );
      if (onProgress) {
        onProgress({
          phase: "complete",
          loaded: 1,
          total: 1,
          currentItem: "Solar system ready (cached)!",
          percentage: 100,
        });
      }
      return this.preloadedSystem;
    }

    if (this.isPreloading) {
      console.log(
        "SolarSystemPreloader: Preloading already in progress - waiting for completion"
      );
      // Wait for current preloading to complete with timeout
      let waitTime = 0;
      const maxWaitTime = 30000; // 30 seconds max wait
      while (this.isPreloading && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitTime += 100;
      }

      if (this.preloadedSystem) {
        console.log("SolarSystemPreloader: Preloading completed while waiting");
        return this.preloadedSystem;
      } else {
        throw new Error("Solar system preloading timed out or failed");
      }
    }

    this.isPreloading = true;

    try {
      console.log(
        "SolarSystemPreloader: Starting complete scene preloading..."
      );

      // Phase 1: Preload textures (40% of progress) with mandatory loading
      console.log(
        "SolarSystemPreloader: Phase 1 - Preloading textures (MANDATORY)..."
      );

      const textures = await TexturePreloader.preloadTextures(
        (textureProgress) => {
          if (onProgress) {
            onProgress({
              phase: "textures",
              loaded: textureProgress.loaded,
              total: textureProgress.total,
              currentItem: textureProgress.currentTexture,
              percentage: Math.round(textureProgress.percentage * 0.4), // 40% of total
              textureProgress,
            });
          }
        }
      );

      // Check texture loading results - all textures should load from local assets
      const successfulTextures = Array.from(textures.values()).filter(
        (t) => t !== null
      ).length;
      const totalTextures = textures.size;
      const successRate = successfulTextures / totalTextures;

      console.log(
        `SolarSystemPreloader: Texture loading results - ${successfulTextures}/${totalTextures} successful (${Math.round(
          successRate * 100
        )}%)`
      );

      if (successRate < 1.0) {
        // Some textures failed to load - continue with fallback colors
        const failedTextures = Array.from(textures.entries())
          .filter(([, texture]) => texture === null)
          .map(([key]) => key);

        console.warn(
          "SolarSystemPreloader: Some textures failed to load - continuing with fallback colors"
        );
        console.warn(
          `Failed textures (using fallbacks): ${failedTextures.join(", ")}`
        );
        console.log(
          `SolarSystemPreloader: ${successfulTextures}/${totalTextures} textures loaded successfully, ${failedTextures.length} using fallback colors`
        );
        console.log(
          "SolarSystemPreloader: The solar system will render with mixed textures and fallback colors"
        );
      }

      // Phase 2: Create geometries (20% of progress)
      console.log("SolarSystemPreloader: Phase 2 - Creating geometries...");
      const geometries = await this.createGeometries(
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "geometries",
              loaded,
              total,
              currentItem: current,
              percentage: 40 + Math.round((loaded / total) * 20), // 40% + 20%
            });
          }
        }
      );

      // Phase 3: Create materials (20% of progress)
      console.log("SolarSystemPreloader: Phase 3 - Creating materials...");
      const materials = await this.createMaterials(
        textures,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "materials",
              loaded,
              total,
              currentItem: current,
              percentage: 60 + Math.round((loaded / total) * 20), // 60% + 20%
            });
          }
        }
      );

      // Phase 4: Create complete scene (20% of progress)
      console.log("SolarSystemPreloader: Phase 4 - Creating complete scene...");
      this.preloadedSystem = await this.createCompleteScene(
        geometries,
        materials,
        textures,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "scene",
              loaded,
              total,
              currentItem: current,
              percentage: 80 + Math.round((loaded / total) * 20), // 80% + 20%
            });
          }
        }
      );

      // Complete
      if (onProgress) {
        onProgress({
          phase: "complete",
          loaded: 1,
          total: 1,
          currentItem: "Solar system ready!",
          percentage: 100,
        });
      }

      this.isPreloaded = true;
      console.log(
        "SolarSystemPreloader: Complete 3D solar system preloaded successfully!"
      );
      return this.preloadedSystem;
    } catch (error) {
      console.error(
        "SolarSystemPreloader: Critical error during preloading:",
        error
      );
      console.error(
        "SolarSystemPreloader: This error must be fixed - no fallback available"
      );
      throw error; // Re-throw to prevent silent failures
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Create and cache all required geometries
   */
  private static async createGeometries(
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<Map<string, SphereGeometry | RingGeometry>> {
    const geometries = new Map<string, SphereGeometry | RingGeometry>();

    // Calculate total geometries needed
    const geometrySpecs: Array<{
      key: string;
      create: () => SphereGeometry | RingGeometry;
    }> = [{ key: "sun", create: () => new SphereGeometry(3.0, 32, 32) }]; // Increased sun size from 2.0 to 3.0

    // Add planet geometries
    this.solarSystemConfig.forEach((planet) => {
      geometrySpecs.push({
        key: `planet_${planet.radius}`,
        create: () => new SphereGeometry(planet.radius, 24, 24),
      });

      // Add moon geometries
      planet.moons?.forEach((moon) => {
        geometrySpecs.push({
          key: `moon_${moon.radius}`,
          create: () => new SphereGeometry(moon.radius, 16, 16),
        });
      });

      // Add ring geometries
      if (planet.rings) {
        geometrySpecs.push({
          key: `ring_${planet.id}`,
          create: () =>
            new RingGeometry(
              planet.rings!.innerRadius,
              planet.rings!.outerRadius,
              24
            ),
        });
      }
    });

    // Create geometries with progress tracking
    for (let i = 0; i < geometrySpecs.length; i++) {
      const spec = geometrySpecs[i];
      geometries.set(spec.key, spec.create());
      onProgress?.(i + 1, geometrySpecs.length, spec.key);

      // Small delay to prevent blocking
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    return geometries;
  }

  /**
   * Create and cache all required materials - FAULT-TOLERANT VERSION
   */
  private static async createMaterials(
    textures: Map<string, Texture | null>,
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<Map<string, MeshPhongMaterial | MeshBasicMaterial>> {
    const materials = new Map<string, MeshPhongMaterial | MeshBasicMaterial>();

    const materialSpecs: Array<{
      key: string;
      create: () => MeshPhongMaterial | MeshBasicMaterial;
    }> = [
      {
        key: "sun",
        create: () => new MeshBasicMaterial({ color: 0xffaa00 }),
      },
    ];

    // Add planet materials using bundled textures with fallbacks
    this.solarSystemConfig.forEach((planet) => {
      const planetTexture = textures.get(planet.id);

      // Define fallback colors for each planet
      const fallbackColors = {
        mercury: 0x8c7853, // Brownish
        venus: 0xffc649, // Yellow
        earth: 0x6b93d6, // Blue
        mars: 0xcd5c5c, // Red
        jupiter: 0xd8ca9d, // Tan
      };

      materialSpecs.push({
        key: `planet_${planet.id}`,
        create: () => {
          if (planetTexture) {
            console.log(`✅ Using texture for planet ${planet.id}`);
            return new MeshPhongMaterial({
              map: planetTexture,
              color: 0xffffff,
              shininess: 100,
              transparent: false,
            });
          } else {
            console.warn(`⚠️ Using fallback color for planet ${planet.id}`);
            return new MeshPhongMaterial({
              color:
                fallbackColors[planet.id as keyof typeof fallbackColors] ||
                0x888888,
              shininess: 100,
              transparent: false,
            });
          }
        },
      });

      // Add moon materials using bundled textures with fallbacks
      planet.moons?.forEach((moon, i) => {
        const moonTexture = textures.get(`moon_${planet.id}_${i}`);
        materialSpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => {
            if (moonTexture) {
              console.log(`✅ Using texture for moon ${planet.id}_${i}`);
              return new MeshPhongMaterial({
                map: moonTexture,
                color: 0xffffff,
                shininess: 50,
              });
            } else {
              console.warn(
                `⚠️ Using fallback color for moon ${planet.id}_${i}`
              );
              return new MeshPhongMaterial({
                color: 0xaaaaaa, // Gray fallback for moons
                shininess: 50,
              });
            }
          },
        });
      });

      // Add ring materials using bundled textures with fallbacks
      if (planet.rings) {
        const ringTexture = textures.get(`ring_${planet.id}`);
        materialSpecs.push({
          key: `ring_mat_${planet.id}`,
          create: () => {
            if (ringTexture) {
              console.log(`✅ Using texture for ring ${planet.id}`);
              return new MeshBasicMaterial({
                map: ringTexture,
                color: 0xffffff,
                side: DoubleSide,
                transparent: true,
                opacity: 0.8,
              });
            } else {
              console.warn(`⚠️ Using fallback color for ring ${planet.id}`);
              return new MeshBasicMaterial({
                color: 0x666666, // Dark gray fallback for rings
                side: DoubleSide,
                transparent: true,
                opacity: 0.6,
              });
            }
          },
        });
      }
    });

    // Create materials with progress tracking
    for (let i = 0; i < materialSpecs.length; i++) {
      const spec = materialSpecs[i];
      materials.set(spec.key, spec.create());
      onProgress?.(i + 1, materialSpecs.length, spec.key);

      // Small delay to prevent blocking
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    console.log(
      `✅ Created ${materials.size} materials (with fallbacks for missing textures)`
    );
    return materials;
  }

  /**
   * Create the complete 3D scene with all objects
   */
  private static async createCompleteScene(
    geometries: Map<string, SphereGeometry | RingGeometry>,
    materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>,
    textures: Map<string, Texture | null>,
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<PreloadedSolarSystem> {
    // Initialize scene
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100); // Aspect ratio will be set later
    camera.position.set(20, 15, 20);
    camera.lookAt(0, 0, 0);

    const clock = new Clock();
    const meshes: Mesh[] = [];
    const lights: (DirectionalLight | AmbientLight | PointLight)[] = [];

    onProgress?.(1, 10, "Scene setup");

    // Setup lighting
    const ambientLight = new AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    lights.push(ambientLight);

    const sunLight = new DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(0, 0, 0);
    sunLight.target.position.set(10, 0, 0);
    scene.add(sunLight);
    scene.add(sunLight.target);
    lights.push(sunLight);

    const sunPointLight = new PointLight(0xffffff, 1.5, 100);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);
    lights.push(sunPointLight);

    onProgress?.(2, 10, "Lighting setup");

    // Create sun
    const sunGeometry = geometries.get("sun")!;
    const sunMaterial = materials.get("sun")!;
    const sun = new Mesh(sunGeometry, sunMaterial);
    sun.userData = { isSun: true };
    scene.add(sun);
    meshes.push(sun);

    onProgress?.(3, 10, "Sun created");

    // Add planets group
    const planetsGroup = new Group();
    scene.add(planetsGroup);

    let planetCount = 0;
    for (const planetConfig of this.solarSystemConfig) {
      // Create planet group for orbital motion
      const planetGroup = new Group();
      planetGroup.userData = {
        config: planetConfig,
        orbitAngle: Math.random() * Math.PI * 2,
      };

      // Get preloaded planet texture (may be null if failed to load)
      const planetTexture = textures.get(planetConfig.id);

      // Always create planet - use fallback material if texture failed
      console.log(
        `🪐 Creating planet ${planetConfig.id} ${
          planetTexture ? "with texture" : "with fallback color"
        }`
      );

      const planetGeometry = geometries.get(`planet_${planetConfig.radius}`)!;
      const planetMaterial = materials.get(`planet_${planetConfig.id}`)!;

      const planet = new Mesh(planetGeometry, planetMaterial);
      planet.position.set(planetConfig.orbitRadius, 0, 0);
      planet.userData = { isPlanet: true, config: planetConfig };
      planetGroup.add(planet);
      meshes.push(planet);

      // Add rings if present (with fallback handling)
      if (planetConfig.rings) {
        const ringTexture = textures.get(`ring_${planetConfig.id}`);
        console.log(
          `💍 Adding ring for ${planetConfig.id} ${
            ringTexture ? "with texture" : "with fallback color"
          }`
        );

        const ringGeometry = geometries.get(`ring_${planetConfig.id}`)!;
        const ringMaterial = materials.get(`ring_mat_${planetConfig.id}`)!;

        const ring = new Mesh(ringGeometry, ringMaterial);
        ring.position.copy(planet.position);
        ring.rotation.x = Math.PI / 2;
        planetGroup.add(ring);
        meshes.push(ring);
      }

      // Add moons if present (with fallback handling)
      if (planetConfig.moons) {
        for (let i = 0; i < planetConfig.moons.length; i++) {
          const moonConfig = planetConfig.moons[i];
          const moonTexture = textures.get(`moon_${planetConfig.id}_${i}`);

          console.log(
            `🌙 Adding moon ${i} for ${planetConfig.id} ${
              moonTexture ? "with texture" : "with fallback color"
            }`
          );

          const moonGeometry = geometries.get(`moon_${moonConfig.radius}`)!;
          const moonMaterial = materials.get(`moon_${planetConfig.id}_${i}`)!;

          const moon = new Mesh(moonGeometry, moonMaterial);

          const moonAngle = (i * Math.PI * 2) / planetConfig.moons.length;
          moon.position.set(
            planetConfig.orbitRadius +
              Math.cos(moonAngle) * moonConfig.orbitRadius,
            0,
            Math.sin(moonAngle) * moonConfig.orbitRadius
          );

          moon.userData = {
            isMoon: true,
            moonConfig,
            moonIndex: i,
            orbitAngle: moonAngle,
          };

          planetGroup.add(moon);
          meshes.push(moon);
        }
      }

      planetsGroup.add(planetGroup);
      planetCount++;
      onProgress?.(3 + planetCount, 10, `Planet ${planetConfig.id} created`);

      // Small delay to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Report final scene statistics
    const textureSuccessCount = Array.from(textures.values()).filter(
      (t) => t !== null
    ).length;
    const textureFailCount = textures.size - textureSuccessCount;

    console.log(`🌌 Solar system scene created successfully!`);
    console.log(`📊 Scene statistics:`);
    console.log(`  - Meshes: ${meshes.length}`);
    console.log(`  - Lights: ${lights.length}`);
    console.log(`  - Geometries: ${geometries.size}`);
    console.log(`  - Materials: ${materials.size}`);
    console.log(
      `  - Textures loaded: ${textureSuccessCount}/${textures.size} (${textureFailCount} failures handled with fallbacks)`
    );

    onProgress?.(10, 10, "Scene complete");

    return {
      scene,
      camera,
      clock,
      planetsGroup,
      meshes,
      lights,
      geometries,
      materials,
      textures,
    };
  }

  /**
   * Get preloaded solar system
   */
  static getPreloadedSystem(): PreloadedSolarSystem | null {
    return this.preloadedSystem;
  }

  /**
   * Check if solar system is preloaded
   */
  static isSystemPreloaded(): boolean {
    return this.isPreloaded;
  }

  /**
   * Clone the preloaded scene for use (creates a fresh instance)
   */
  static clonePreloadedScene(): PreloadedSolarSystem | null {
    if (!this.preloadedSystem) {
      return null;
    }

    // For now, return the same instance since Three.js objects can be shared
    // In the future, if we need multiple instances, we could implement cloning
    return this.preloadedSystem;
  }

  /**
   * Clear preloaded system and free memory
   */
  static clearCache(): void {
    if (this.preloadedSystem) {
      // Dispose of geometries
      this.preloadedSystem.geometries.forEach((geometry) => {
        geometry.dispose();
      });

      // Dispose of materials
      this.preloadedSystem.materials.forEach((material) => {
        material.dispose();
      });

      // Dispose of textures
      this.preloadedSystem.textures.forEach((texture) => {
        if (texture) {
          texture.dispose();
        }
      });

      // Clear scene
      while (this.preloadedSystem.scene.children.length > 0) {
        this.preloadedSystem.scene.remove(
          this.preloadedSystem.scene.children[0]
        );
      }
    }

    // Clear texture cache too
    TexturePreloader.clearCache();

    this.preloadedSystem = null;
    this.isPreloaded = false;
    this.isPreloading = false;
    console.log("SolarSystemPreloader: Cache cleared");
  }
}
