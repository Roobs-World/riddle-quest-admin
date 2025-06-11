import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Text } from "react-native";
import { GLView } from "expo-gl";
import { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
// No imports needed for textures - using preloaded system

// Import the preloader to use preloaded system
import {
  SolarSystemPreloader,
  PreloadedSolarSystem,
  PlanetConfig,
  MoonConfig,
} from "../../services/SolarSystemPreloader";

// Interfaces moved to SolarSystemPreloader - using preloaded types

// Remove props interface - now uses preloaded system
const ThreeDSolarSystem: React.FC = () => {
  console.log("ThreeDSolarSystem component is mounting");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rendererRef = useRef<Renderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const preloadedSystemRef = useRef<PreloadedSolarSystem | null>(null);

  // Configuration is now handled by preloaded system

  // Component now uses preloaded system - no need for individual geometry/material creation

  // Initialize Three.js scene with preloaded solar system
  const initializeScene = async (gl: ExpoWebGLRenderingContext) => {
    console.log("ThreeDSolarSystem: initializeScene called");

    try {
      // Check if solar system is preloaded
      if (!SolarSystemPreloader.isSystemPreloaded()) {
        throw new Error(
          "Solar system not preloaded - should be loaded during app initialization"
        );
      }

      // Get preloaded system
      const preloadedSystem = SolarSystemPreloader.getPreloadedSystem();
      if (!preloadedSystem) {
        throw new Error("Failed to get preloaded solar system");
      }

      preloadedSystemRef.current = preloadedSystem;
      console.log("ThreeDSolarSystem: Using preloaded solar system");

      // Basic WebGL test
      gl.clearColor(0.0, 0.0, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.flush();
      console.log("ThreeDSolarSystem: Basic WebGL clear test completed");

      // Initialize renderer using expo-three
      const renderer = new Renderer({ gl });
      console.log("ThreeDSolarSystem: Renderer created successfully");

      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000011, 1); // Very dark blue space background
      renderer.shadowMap.enabled = false; // Disable shadows for better performance

      // Enable depth testing and face culling
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      rendererRef.current = renderer;
      console.log("ThreeDSolarSystem: Renderer configured");

      // Update camera aspect ratio for current viewport
      preloadedSystem.camera.aspect =
        gl.drawingBufferWidth / gl.drawingBufferHeight;
      preloadedSystem.camera.updateProjectionMatrix();
      console.log("ThreeDSolarSystem: Camera aspect ratio updated");

      // Adjust camera for better solar system visibility
      preloadedSystem.camera.fov = 75; // Wider field of view
      preloadedSystem.camera.position.set(15, 10, 15); // Good overview position
      preloadedSystem.camera.lookAt(0, 0, 0); // Look at sun/center
      preloadedSystem.camera.aspect =
        gl.drawingBufferWidth / gl.drawingBufferHeight;
      preloadedSystem.camera.updateProjectionMatrix();

      console.log("ThreeDSolarSystem: Camera configured for solar system view");
      console.log(
        "ThreeDSolarSystem: Scene children count:",
        preloadedSystem.scene.children.length
      );

      // Force an initial render to test
      console.log("ThreeDSolarSystem: Forcing initial render test...");
      renderer.render(preloadedSystem.scene, preloadedSystem.camera);
      console.log("ThreeDSolarSystem: Initial render completed");

      // Start animation
      startAnimationLoop();
      console.log("ThreeDSolarSystem: Animation loop started");

      setIsReady(true);
      console.log(
        "ThreeDSolarSystem: Scene initialized successfully using preloaded system"
      );
    } catch (error) {
      console.error("ThreeDSolarSystem: Error initializing scene:", error);
      setError(
        error instanceof Error ? error.message : "Unknown initialization error"
      );
      setIsReady(false);
    }
  };

  // All creation functions handled by preloaded system

  // Optimized animation loop using preloaded scene
  const startAnimationLoop = () => {
    let lastFrameTime = 0;
    let frameCount = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (!rendererRef.current || !preloadedSystemRef.current) {
        return;
      }

      const { scene, camera, clock, planetsGroup } = preloadedSystemRef.current;

      // Frame rate limiting
      if (currentTime - lastFrameTime < frameInterval) {
        animationIdRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;

      frameCount++;
      if (frameCount % 240 === 0) {
        // Log every 4 seconds at 60fps
        console.log(
          "ThreeDSolarSystem: Animation frame",
          frameCount,
          "- Scene children:",
          scene.children.length
        );
      }

      const deltaTime = clock.getDelta();

      // Animate sun rotation
      scene.children.forEach((child) => {
        if (child.userData.isSun) {
          child.rotation.y += 0.01;
        }
      });

      // Animate planets using preloaded planet groups
      if (planetsGroup) {
        planetsGroup.children.forEach((planetGroup) => {
          const config = planetGroup.userData.config as PlanetConfig;

          // Update orbital position
          planetGroup.userData.orbitAngle += config.orbitSpeed * deltaTime;
          planetGroup.position.set(
            Math.cos(planetGroup.userData.orbitAngle) * config.orbitRadius,
            0,
            Math.sin(planetGroup.userData.orbitAngle) * config.orbitRadius
          );

          // Rotate planets and animate moons
          planetGroup.children.forEach((child) => {
            if (child.userData.isPlanet) {
              child.rotation.y += config.rotationSpeed * deltaTime;
            } else if (child.userData.isMoon) {
              const moonConfig = child.userData.moonConfig as MoonConfig;
              child.userData.orbitAngle += moonConfig.orbitSpeed * deltaTime;

              const moonX =
                Math.cos(child.userData.orbitAngle) * moonConfig.orbitRadius;
              const moonZ =
                Math.sin(child.userData.orbitAngle) * moonConfig.orbitRadius;

              child.position.set(config.orbitRadius + moonX, 0, moonZ);
            }
          });
        });
      }

      // Render
      rendererRef.current.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);
  };

  // Simplified cleanup function for preloaded system
  const cleanup = useCallback(() => {
    console.log("Starting Three.js cleanup...");

    // Cancel animation frame
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    // Dispose renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Clear reference to preloaded system (don't dispose - other components may use it)
    preloadedSystemRef.current = null;

    console.log("Three.js cleanup completed");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <View style={styles.container}>
      <GLView style={styles.glView} onContextCreate={initializeScene} />
      {!isReady && !error && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <Text style={styles.loadingText}>Initializing solar system...</Text>
          </View>
        </View>
      )}
      {error && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
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
    zIndex: 1, // Visible within game view but behind UI elements
  },
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  glView: {
    flex: 1,
  },
  loadingContent: {
    alignItems: "center",
    padding: 20,
  },
  loadingOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  loadingText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default ThreeDSolarSystem;
