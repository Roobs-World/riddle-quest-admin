import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Text } from "react-native";
import { GLView } from "expo-gl";
import { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import {
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
} from "three";
import { SolarSystemPreloader } from "../../services/SolarSystemPreloader";

const ThreeDSolarSystem: React.FC = () => {
  console.log("ThreeDSolarSystem component is mounting");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<string>("Initializing...");

  const rendererRef = useRef<Renderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const planetsGroupRef = useRef<Group | null>(null);

  // Create a simple fallback solar system if preloaded system fails
  const createFallbackSolarSystem = (scene: Scene) => {
    console.log("ThreeDSolarSystem: Creating fallback solar system");

    // Create a LARGE sun for guaranteed visibility
    const sunGeometry = new BoxGeometry(12, 12, 12);
    const sunMaterial = new MeshBasicMaterial({
      color: 0xffaa00,
      wireframe: false, // Solid for sun
    });
    const sun = new Mesh(sunGeometry, sunMaterial);
    sun.position.set(0, 0, 0);
    sun.userData = { isSun: true, isFallback: true };
    scene.add(sun);
    console.log(
      "ThreeDSolarSystem: LARGE fallback sun created at (0,0,0) with size 12x12x12"
    );

    // Create LARGE planets for guaranteed visibility
    const planets = [
      { color: 0x8c7853, radius: 6, orbit: 6, name: "planet_r" },
      { color: 0x6b93d6, radius: 7, orbit: 8, name: "planet_a" },
      { color: 0xcd5c5c, radius: 8, orbit: 10, name: "planet_d" },
      { color: 0xffc649, radius: 7, orbit: 12, name: "planet_v" },
      { color: 0xd8ca9d, radius: 9, orbit: 15, name: "planet_k" },
    ];

    const planetsGroup = new Group();
    scene.add(planetsGroup);

    planets.forEach((planetConfig, i) => {
      const planetGroup = new Group();
      planetGroup.userData = {
        config: {
          orbitRadius: planetConfig.orbit,
          orbitSpeed: 0.01 + i * 0.005,
        },
        orbitAngle: (i * Math.PI * 2) / planets.length,
      };

      const planetGeometry = new BoxGeometry(
        planetConfig.radius,
        planetConfig.radius,
        planetConfig.radius
      );
      const planetMaterial = new MeshBasicMaterial({
        color: planetConfig.color,
        wireframe: true, // Wireframe for planets to ensure visibility
      });
      const planet = new Mesh(planetGeometry, planetMaterial);
      planet.position.set(planetConfig.orbit, 0, 0);
      planet.userData = {
        isPlanet: true,
        isFallback: true,
        config: planetConfig,
      };
      planetGroup.add(planet);
      planetsGroup.add(planetGroup);

      console.log(
        `LARGE fallback planet ${planetConfig.name} created at orbit ${planetConfig.orbit} with size ${planetConfig.radius}x${planetConfig.radius}x${planetConfig.radius}`
      );
    });

    console.log(
      "ThreeDSolarSystem: LARGE fallback solar system created - objects should be VERY visible"
    );
    console.log(`Total scene children: ${scene.children.length}`);
    console.log(`Planets group children: ${planetsGroup.children.length}`);

    return {
      planetsGroup,
      meshes: [
        sun,
        ...planets.map((_, i) => planetsGroup.children[i].children[0]),
      ],
    };
  };

  // Initialize Three.js scene with preloaded solar system
  const initializeScene = async (gl: ExpoWebGLRenderingContext) => {
    console.log("ThreeDSolarSystem: initializeScene called");
    console.log(
      `GL context: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`
    );

    try {
      setSystemStatus("Checking for preloaded solar system...");

      // FORCE FRESH LOAD: Clear cache to use new camera/orbital settings
      SolarSystemPreloader.clearCache();
      console.log(
        "ThreeDSolarSystem: Cleared preloader cache to force fresh load with new settings"
      );

      // First, try to get the preloaded solar system
      let preloadedSystem = SolarSystemPreloader.getPreloadedSystem();

      if (!preloadedSystem) {
        console.log(
          "ThreeDSolarSystem: No preloaded system found, triggering preload..."
        );
        setSystemStatus("Loading solar system assets...");

        // Trigger preloading if not already done
        preloadedSystem = await SolarSystemPreloader.preloadSolarSystem(
          (progress) => {
            setSystemStatus(
              `Loading: ${progress.currentItem} (${progress.percentage}%)`
            );
          }
        );
      }

      if (!preloadedSystem) {
        throw new Error("Failed to load solar system");
      }

      console.log("ThreeDSolarSystem: Using preloaded solar system");
      console.log(`Solar system has ${preloadedSystem.meshes.length} meshes`);
      console.log(
        `Scene has ${preloadedSystem.scene.children.length} children`
      );
      console.log(`Textures loaded: ${preloadedSystem.textures.size}`);
      console.log(`Materials created: ${preloadedSystem.materials.size}`);

      // Debug: Log which textures were successfully loaded
      console.log("ThreeDSolarSystem: Texture loading status:");
      preloadedSystem.textures.forEach((texture, key) => {
        if (texture) {
          console.log(`  ✅ ${key}: loaded successfully`);
        } else {
          console.log(`  ❌ ${key}: failed to load`);
        }
      });

      // Debug: Log materials that use textures
      console.log("ThreeDSolarSystem: Material status:");
      preloadedSystem.materials.forEach((material, key) => {
        if (material.map) {
          console.log(`  ✅ ${key}: has texture map`);
        } else {
          console.log(`  ⚠️ ${key}: using fallback color`);
        }
      });

      setSystemStatus("Setting up 3D renderer...");

      // Initialize renderer using expo-three
      const renderer = new Renderer({ gl });
      console.log("ThreeDSolarSystem: Renderer created successfully");

      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x111122, 1); // Slightly lighter background for better contrast

      // CRITICAL: Enable depth testing for proper 3D rendering
      const glContext = renderer.getContext();
      glContext.enable(glContext.DEPTH_TEST);
      glContext.depthFunc(glContext.LEQUAL);

      console.log("ThreeDSolarSystem: Renderer configured with depth testing");

      rendererRef.current = renderer;

      // Use the preloaded scene and camera
      const scene = preloadedSystem.scene;
      const camera = preloadedSystem.camera;
      const planetsGroup = preloadedSystem.planetsGroup;

      // CRITICAL: Set up camera aspect ratio for current viewport
      camera.aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      camera.updateProjectionMatrix();

      console.log(`Camera aspect ratio: ${camera.aspect}`);
      console.log(
        `Camera position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`
      );
      console.log(`Camera looking at: (0, 0, 0)`);
      console.log(
        `Camera FOV: ${camera.fov}, Near: ${camera.near}, Far: ${camera.far}`
      );

      // Store references
      sceneRef.current = scene;
      cameraRef.current = camera;
      planetsGroupRef.current = planetsGroup;

      console.log("ThreeDSolarSystem: Camera and scene configured");

      setSystemStatus("Starting solar system animation...");

      // CRITICAL: Force multiple initial renders to ensure visibility
      console.log("ThreeDSolarSystem: Attempting initial renders...");
      for (let i = 0; i < 3; i++) {
        renderer.render(scene, camera);
        console.log(`ThreeDSolarSystem: Initial render ${i + 1} completed`);
      }

      // Debug: Log scene contents with detailed positioning
      console.log("ThreeDSolarSystem: Scene contents with positions:");
      scene.traverse((child) => {
        if (child instanceof Mesh) {
          const type = child.userData.isTestCube
            ? "TEST_CUBE"
            : child.userData.isSun
            ? "SUN"
            : child.userData.isPlanet
            ? "PLANET"
            : child.userData.isMoon
            ? "MOON"
            : "OTHER";
          console.log(
            `  ${type}: position(${child.position.x.toFixed(
              1
            )}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(
              1
            )}) scale(${child.scale.x.toFixed(1)}, ${child.scale.y.toFixed(
              1
            )}, ${child.scale.z.toFixed(1)})`
          );

          // Check if object is within camera view
          const distance = camera.position.distanceTo(child.position);
          console.log(`    Distance from camera: ${distance.toFixed(1)} units`);
        }
      });

      // Start animation loop with test cube rotation
      const animate = () => {
        if (
          !rendererRef.current ||
          !sceneRef.current ||
          !cameraRef.current ||
          !planetsGroupRef.current
        )
          return;

        // Animate planets orbital motion
        planetsGroupRef.current.children.forEach((planetGroup) => {
          if (planetGroup.userData.config) {
            const config = planetGroup.userData.config;

            // Update orbital position
            planetGroup.userData.orbitAngle += config.orbitSpeed * 0.5;
            const orbitAngle = planetGroup.userData.orbitAngle;

            planetGroup.position.set(
              Math.cos(orbitAngle) * config.orbitRadius,
              0,
              Math.sin(orbitAngle) * config.orbitRadius
            );

            // Animate planet rotation and moons
            planetGroup.children.forEach((child) => {
              if (child.userData.isPlanet && child instanceof Mesh) {
                child.rotation.y += config.rotationSpeed || 0.01;
              }

              // Animate moons
              if (child.userData.isMoon && child instanceof Mesh) {
                const moonConfig = child.userData.moonConfig;
                child.userData.orbitAngle += moonConfig.orbitSpeed * 0.5;

                const moonOrbitAngle = child.userData.orbitAngle;
                child.position.set(
                  config.orbitRadius +
                    Math.cos(moonOrbitAngle) * moonConfig.orbitRadius,
                  0,
                  Math.sin(moonOrbitAngle) * moonConfig.orbitRadius
                );

                child.rotation.y += 0.01; // Moon rotation
              }
            });
          }
        });

        // Animate sun rotation
        sceneRef.current.children.forEach((child) => {
          if (child.userData.isSun && child instanceof Mesh) {
            child.rotation.y += 0.005; // Slow sun rotation
          }
        });

        rendererRef.current.render(sceneRef.current, cameraRef.current);
        animationIdRef.current = requestAnimationFrame(animate);
      };

      animationIdRef.current = requestAnimationFrame(animate);
      console.log(
        "ThreeDSolarSystem: Animation loop started with preloaded solar system"
      );

      setSystemStatus("Solar system active!");
      setIsReady(true);

      // Log final status
      console.log("🌌 ThreeDSolarSystem: INITIALIZATION COMPLETE");
      console.log(
        `📊 Final stats: ${preloadedSystem.meshes.length} meshes, ${scene.children.length} scene objects`
      );
      console.log(
        "🎬 Animation loop running - solar system should be visible!"
      );
    } catch (error) {
      console.error("ThreeDSolarSystem: Error initializing scene:", error);
      setError(`Failed to initialize solar system: ${error}`);
      setSystemStatus("Error loading solar system");

      // Initialize basic scene and camera for fallback
      const scene = new Scene();
      const camera = new PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        500
      );
      camera.position.set(15, 10, 15); // Match the preloader camera position
      camera.lookAt(0, 0, 0);

      sceneRef.current = scene;
      cameraRef.current = camera;

      // Create a simple fallback solar system if preloaded system fails
      if (!sceneRef.current || !cameraRef.current) {
        console.error(
          "ThreeDSolarSystem: Scene or camera not initialized for fallback"
        );
        return;
      }

      const fallbackSystem = createFallbackSolarSystem(sceneRef.current);
      planetsGroupRef.current = fallbackSystem.planetsGroup;

      // Initialize renderer using expo-three
      const renderer = new Renderer({ gl });
      console.log("ThreeDSolarSystem: Renderer created successfully");

      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000011, 1); // Very dark blue background

      // CRITICAL: Enable depth testing for proper 3D rendering
      const glContext = renderer.getContext();
      glContext.enable(glContext.DEPTH_TEST);
      glContext.depthFunc(glContext.LEQUAL);

      console.log("ThreeDSolarSystem: Renderer configured with depth testing");

      rendererRef.current = renderer;

      // Start animation loop with test cube rotation
      const animate = () => {
        if (
          !rendererRef.current ||
          !sceneRef.current ||
          !cameraRef.current ||
          !planetsGroupRef.current
        )
          return;

        // Animate planets orbital motion
        planetsGroupRef.current.children.forEach((planetGroup) => {
          if (planetGroup.userData.config) {
            const config = planetGroup.userData.config;

            // Update orbital position
            planetGroup.userData.orbitAngle += config.orbitSpeed * 0.5;
            const orbitAngle = planetGroup.userData.orbitAngle;

            planetGroup.position.set(
              Math.cos(orbitAngle) * config.orbitRadius,
              0,
              Math.sin(orbitAngle) * config.orbitRadius
            );

            // Animate planet rotation and moons
            planetGroup.children.forEach((child) => {
              if (child.userData.isPlanet && child instanceof Mesh) {
                child.rotation.y += config.rotationSpeed || 0.01;
              }

              // Animate moons
              if (child.userData.isMoon && child instanceof Mesh) {
                const moonConfig = child.userData.moonConfig;
                child.userData.orbitAngle += moonConfig.orbitSpeed * 0.5;

                const moonOrbitAngle = child.userData.orbitAngle;
                child.position.set(
                  config.orbitRadius +
                    Math.cos(moonOrbitAngle) * moonConfig.orbitRadius,
                  0,
                  Math.sin(moonOrbitAngle) * moonConfig.orbitRadius
                );

                child.rotation.y += 0.01; // Moon rotation
              }
            });
          }
        });

        // Animate sun rotation
        if (sceneRef.current) {
          sceneRef.current.children.forEach((child) => {
            if (child.userData.isSun && child instanceof Mesh) {
              child.rotation.y += 0.005; // Slow sun rotation
            }
          });
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
        animationIdRef.current = requestAnimationFrame(animate);
      };

      animationIdRef.current = requestAnimationFrame(animate);
      console.log(
        "ThreeDSolarSystem: Animation loop started with fallback solar system"
      );

      setSystemStatus("Solar system active!");
      setIsReady(true);

      // Log final status
      console.log("🌌 ThreeDSolarSystem: INITIALIZATION COMPLETE");
      console.log(
        `📊 Final stats: ${fallbackSystem.meshes.length} meshes, ${sceneRef.current.children.length} scene objects`
      );
      console.log(
        "🎬 Animation loop running - solar system should be visible!"
      );
    }
  };

  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    console.log("ThreeDSolarSystem: GL context created");
    await initializeScene(gl);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("ThreeDSolarSystem: Cleaning up...");
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      // Clean up renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      // Clear references
      sceneRef.current = null;
      cameraRef.current = null;
      planetsGroupRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Solar System Error</Text>
          <Text style={styles.errorDetails}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status overlay for debugging */}
      {!isReady && (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>{systemStatus}</Text>
        </View>
      )}

      {/* Three.js GLView */}
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
        enableExperimentalWorkletSupport={false}
      />
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
    zIndex: 1, // Behind other UI elements
  },
  errorContainer: {
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    borderRadius: 8,
    left: 20,
    padding: 15,
    position: "absolute",
    right: 20,
    top: 50,
    zIndex: 10,
  },
  errorDetails: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  glView: {
    flex: 1,
  },
  statusOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    left: 20,
    padding: 15,
    position: "absolute",
    right: 20,
    top: 50,
    zIndex: 10,
  },
  statusText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
});

export default ThreeDSolarSystem;
