import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Text } from "react-native";
import { ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { Renderer } from "expo-three";
import { Scene, PerspectiveCamera, Group } from "three";
import { SolarSystemPreloader } from "../../services/SolarSystemPreloader";
import { TextureDebugger } from "../../services/TextureDebugger";

const ThreeDSolarSystem: React.FC = () => {
  console.log("ThreeDSolarSystem component is mounting");
  const [error, setError] = useState<string | null>(null);

  const rendererRef = useRef<Renderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const planetsGroupRef = useRef<Group | null>(null);

  // Initialize Three.js scene with texture-based solar system
  const initializeScene = async (gl: ExpoWebGLRenderingContext) => {
    console.log("ThreeDSolarSystem: initializeScene called");
    console.log(
      `GL context: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`
    );

    try {
      // Initialize renderer first
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x111122, 1);
      const glContext = renderer.getContext();
      glContext.enable(glContext.DEPTH_TEST);
      glContext.depthFunc(glContext.LEQUAL);
      rendererRef.current = renderer;

      // Test texture loading first
      console.log("🔍 TESTING TEXTURE ASSETS...");
      await TextureDebugger.testAllAssets();

      // Use the preloaded solar system with correct textures/materials
      let preloadedSystem = SolarSystemPreloader.getPreloadedSystem();
      if (!preloadedSystem) {
        console.log("🚀 PRELOADING SOLAR SYSTEM...");

        // Clear cache to force fresh load
        SolarSystemPreloader.clearCache();
        console.log("🗑️ CLEARED PRELOADER CACHE - FORCING FRESH LOAD");

        preloadedSystem = await SolarSystemPreloader.preloadSolarSystem();
        console.log("✅ SOLAR SYSTEM PRELOADED SUCCESSFULLY");
      } else {
        console.log("✅ USING CACHED SOLAR SYSTEM");
      }

      if (!preloadedSystem) {
        console.error("❌ NO PRELOADED SYSTEM AVAILABLE");
        setError("Failed to load solar system - textures must load properly");
        return;
      }

      // DIAGNOSTIC: Check what we got from the preloader
      console.log("🔍 SOLAR SYSTEM DIAGNOSTIC:", {
        hasScene: !!preloadedSystem.scene,
        hasCamera: !!preloadedSystem.camera,
        hasPlanetsGroup: !!preloadedSystem.planetsGroup,
        planetGroupChildren: preloadedSystem.planetsGroup.children.length,
        totalMeshes: preloadedSystem.meshes.length,
        sceneChildren: preloadedSystem.scene.children.length,
      });

      // DIAGNOSTIC: Check planets group in detail
      console.log("🪐 PLANETS GROUP DETAIL:");
      preloadedSystem.planetsGroup.children.forEach((child, index) => {
        console.log(`  Planet Group ${index}:`, {
          type: child.type,
          hasUserData: !!child.userData,
          hasConfig: !!(child.userData && child.userData.config),
          childrenCount: child.children.length,
          position: `(${child.position.x}, ${child.position.y}, ${child.position.z})`,
          userData: child.userData,
        });

        // Check what's inside each planet group
        if (child.children.length > 0) {
          child.children.forEach((grandchild, gIndex) => {
            console.log(`    Child ${gIndex}:`, {
              type: grandchild.type,
              isPlanet: grandchild.userData?.isPlanet,
              isMoon: grandchild.userData?.isMoon,
              isRing: grandchild.userData?.isRing,
              position: `(${grandchild.position.x}, ${grandchild.position.y}, ${grandchild.position.z})`,
            });
          });
        }
      });

      // Use the preloaded scene, camera, and planets group
      const scene = preloadedSystem.scene;
      const camera = preloadedSystem.camera;
      const planetsGroup = preloadedSystem.planetsGroup;

      // Update camera aspect ratio for current viewport
      camera.aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      camera.updateProjectionMatrix();

      sceneRef.current = scene;
      cameraRef.current = camera;
      planetsGroupRef.current = planetsGroup;

      // Force multiple initial renders to ensure visibility
      for (let i = 0; i < 3; i++) {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      }

      // Start animation loop using configured planet speeds
      let animationCounter = 0;

      const animate = () => {
        if (
          !rendererRef.current ||
          !sceneRef.current ||
          !cameraRef.current ||
          !planetsGroupRef.current
        )
          return;

        animationCounter += 0.05; // Animation progression
        const time = Date.now() * 0.001;
        const dt = 0.016; // Fixed delta time for consistent animation

        // CRITICAL DEBUG: Verify animation loop is running
        if (Math.floor(animationCounter * 5) % 50 === 0) {
          console.log(
            `🎬 ANIMATION LOOP RUNNING - Counter: ${animationCounter.toFixed(
              2
            )}, Time: ${time.toFixed(1)}`
          );
        }

        // Debug: Check if we have planet groups
        if (planetsGroupRef.current.children.length === 0) {
          console.warn("⚠️ NO PLANETS in planetsGroup to animate!");
          return; // Exit if no planets
        }

        // Enhanced Debug: Track time progression and animation status
        if (Math.floor(animationCounter * 2) % 20 === 0) {
          console.log(
            `⏰ ANIMATION STATUS: Counter: ${animationCounter.toFixed(
              2
            )}, Planets: ${
              planetsGroupRef.current.children.length
            }, Animation Active: ${!!animationIdRef.current}`
          );

          // Force log first planet position to verify movement
          if (planetsGroupRef.current.children.length > 0) {
            const firstPlanet = planetsGroupRef.current.children[0];
            console.log(
              `🔍 FIRST PLANET POSITION: (${firstPlanet.position.x.toFixed(
                1
              )}, ${firstPlanet.position.y.toFixed(
                1
              )}, ${firstPlanet.position.z.toFixed(1)})`
            );
          }
        }

        // Debug: Log animation status every few seconds
        if (Math.floor(animationCounter) % 10 === 0) {
          console.log(
            `🌌 TEXTURE-BASED ANIMATION: ${
              planetsGroupRef.current.children.length
            } planets, counter: ${animationCounter.toFixed(2)}`
          );

          // Simple planet position check
          planetsGroupRef.current.children.forEach((planetGroup, idx) => {
            if (idx < 3) {
              // Only log first 3 planets
              const distance = Math.sqrt(
                planetGroup.position.x * planetGroup.position.x +
                  planetGroup.position.z * planetGroup.position.z
              );
              console.log(
                `🪐 Planet ${idx}: pos(${planetGroup.position.x.toFixed(
                  1
                )}, ${planetGroup.position.y.toFixed(
                  1
                )}, ${planetGroup.position.z.toFixed(
                  1
                )}) dist=${distance.toFixed(1)}`
              );
            }
          });
        }

        // Animate planet orbits using CONFIGURED speeds and radii (NO FALLBACKS)
        planetsGroupRef.current.children.forEach((planetGroup, index) => {
          // Use the planet's actual configuration speeds - NO HARDCODED OVERRIDES
          if (planetGroup.userData && planetGroup.userData.config) {
            const config = planetGroup.userData.config;
            // Use ONLY the configured speeds from the planet config
            const orbitSpeed = config.orbitSpeed; // NO fallback speeds
            const orbitRadius = config.orbitRadius; // NO fallback radii

            console.log(
              `🪐 Using CONFIGURED speed: ${orbitSpeed}, radius: ${orbitRadius}`
            );

            // ORBITAL CALCULATION using configured values
            const angle = animationCounter * orbitSpeed + index * Math.PI * 0.4; // Spread planets out
            const newX = Math.cos(angle) * orbitRadius;
            const newZ = Math.sin(angle) * orbitRadius;

            // Set orbital position
            planetGroup.position.set(newX, 0, newZ);

            // Debug: Track movement for first few planets
            if (index < 2 && Math.floor(animationCounter * 5) % 50 === 0) {
              console.log(
                `🚀 Planet ${index} position: (${newX.toFixed(
                  1
                )}, 0, ${newZ.toFixed(1)}) at speed ${orbitSpeed}`
              );
            }
          } else {
            console.error(
              `❌ Planet ${index} missing configuration - cannot animate without config`
            );
          }

          // Animate moons orbiting around their parent planet (only if planet group has children)
          if (planetGroup.children.length > 0) {
            planetGroup.children.forEach((child) => {
              if (child.userData && child.userData.isMoon) {
                const moonConfig = child.userData.moonConfig;
                const moonIndex = child.userData.moonIndex || 0;

                // Initialize orbit angle if not set
                if (child.userData.orbitAngle === undefined) {
                  child.userData.orbitAngle = moonIndex * Math.PI;
                }

                // Update moon's orbital angle using its specific orbit speed
                child.userData.orbitAngle += moonConfig.orbitSpeed * dt;

                // Position moon relative to its parent planet (at origin of planetGroup)
                const moonAngle = child.userData.orbitAngle;
                child.position.set(
                  Math.cos(moonAngle) * moonConfig.orbitRadius,
                  0,
                  Math.sin(moonAngle) * moonConfig.orbitRadius
                );
              }
            });
          }
        });

        renderer.render(sceneRef.current, cameraRef.current);
        gl.endFrameEXP();
        animationIdRef.current = requestAnimationFrame(animate);
      };
      animationIdRef.current = requestAnimationFrame(animate);
    } catch (error) {
      setError(`Failed to initialize solar system: ${error}`);
      console.error("❌ Critical error - no fallback available:", error);
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

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
        enableExperimentalWorkletSupport={false}
      />
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Solar System Error</Text>
          <Text style={styles.errorDetails}>{error}</Text>
        </View>
      )}
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
    zIndex: -1,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    borderRadius: 5,
    left: 20,
    padding: 10,
    position: "absolute",
    right: 20,
    top: 50,
  },
  errorDetails: {
    color: "white",
    fontSize: 12,
    marginTop: 5,
  },
  errorText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  glView: {
    flex: 1,
  },
});

export default ThreeDSolarSystem;
