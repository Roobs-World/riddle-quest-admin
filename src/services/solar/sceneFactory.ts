/**
 * @fileoverview Scene-construction helpers for the solar-system background.
 */
import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  PointLight,
  RingGeometry,
  Scene,
  SphereGeometry,
  Texture,
} from "three";
import type {MeshPhongMaterialParameters} from "three";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

/** Result of base scene + camera initialization. */
export interface SceneSetup {
  scene: Scene;
  camera: PerspectiveCamera;
}

/**
 * Creates the base scene and camera configured for the compact solar layout.
 *
 * @returns Scene and camera pair.
 */
export const createSceneSetup = (): SceneSetup => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(90, 1, 0.1, 800);
  camera.position.set(90, 60, 90);
  camera.lookAt(0, 0, 0);

  logger.debug("Camera positioned at (90, 60, 90) looking at center (0, 0, 0) for compact solar system view");

  return {scene, camera};
};

/**
 * Attaches default lighting rig used by solar meshes.
 *
 * @param scene Scene to mutate.
 * @param lights Target list that collects created lights.
 */
export const addEnhancedLights = (scene: Scene, lights: (DirectionalLight | AmbientLight | PointLight)[]): void => {
  const ambientLight = new AmbientLight(0x404080, 1.2);
  scene.add(ambientLight);
  lights.push(ambientLight);

  const sunLight = new DirectionalLight(0xffffff, 4.0);
  sunLight.position.set(10, 5, 10);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = false;
  scene.add(sunLight);
  scene.add(sunLight.target);
  lights.push(sunLight);

  const sunPointLight = new PointLight(0xffffff, 5.0, 300);
  sunPointLight.position.set(0, 0, 0);
  sunPointLight.castShadow = false;
  scene.add(sunPointLight);
  lights.push(sunPointLight);

  const rimLight1 = new DirectionalLight(0x8888ff, 0.8);
  rimLight1.position.set(-20, 10, -20);
  rimLight1.target.position.set(0, 0, 0);
  scene.add(rimLight1);
  scene.add(rimLight1.target);
  lights.push(rimLight1);

  const rimLight2 = new DirectionalLight(0xff8888, 0.6);
  rimLight2.position.set(20, -10, 20);
  rimLight2.target.position.set(0, 0, 0);
  scene.add(rimLight2);
  scene.add(rimLight2.target);
  lights.push(rimLight2);

  logger.debug(
    "Enhanced lighting setup for MeshPhongMaterial: Ambient(1.2), Sun Directional(4.0), Sun Point(5.0), Rim Lights(0.8, 0.6)",
  );
};

/**
 * Adds layered sun meshes (or fallback sun) to the scene.
 *
 * @param scene Scene to mutate.
 * @param geometries Geometry lookup map.
 * @param textures Texture lookup map.
 * @param meshes Target collection to append created mesh references.
 */
export const addSunMeshes = (
  scene: Scene,
  geometries: Map<string, SphereGeometry | RingGeometry>,
  textures: Map<string, Texture | null>,
  meshes: Mesh[],
): void => {
  const sunGeometry = geometries.get("sun");
  const sunGlowTextures = [
    textures.get("sun"),
    textures.get("glow_sun"),
    textures.get("glow_sun_intense"),
    textures.get("glow_planet_intense"),
  ];

  const sunMeshes: Mesh[] = [];
  try {
    if (sunGeometry) {
      const sunScales = [1.0, 1.1, 1.2, 1.3];
      for (let i = 0; i < sunGlowTextures.length; i++) {
        const sunMaterialParameters: MeshPhongMaterialParameters = {
          color: 0xffff00,
          emissive: 0xffff00,
          emissiveIntensity: 1.5,
          shininess: 100,
          transparent: true,
          opacity: 0.7 - i * 0.15,
          depthWrite: false,
        };

        const sunGlowTexture = sunGlowTextures[i];
        if (sunGlowTexture) {
          sunMaterialParameters.map = sunGlowTexture;
        }

        const sunMaterial = new MeshPhongMaterial(sunMaterialParameters);
        const sunMesh = new Mesh(sunGeometry, sunMaterial);
        sunMesh.position.set(0, 0, 0);
        sunMesh.scale.setScalar(sunScales[i]);
        sunMesh.userData = {isSun: true, sunLayer: i};
        scene.add(sunMesh);
        meshes.push(sunMesh);
        sunMeshes.push(sunMesh);
      }
      logger.debug("Sun (multi-layered glow) added to scene.");
    } else {
      logger.error("Sun geometry missing! Using fallback sphere.");
      const fallbackSun = new Mesh(new SphereGeometry(20.0, 16, 16), new MeshBasicMaterial({color: 0xffff00}));
      fallbackSun.position.set(0, 0, 0);
      fallbackSun.userData = {isSun: true, isFallback: true};
      scene.add(fallbackSun);
      meshes.push(fallbackSun);
      sunMeshes.push(fallbackSun);
      logger.debug("Emergency fallback sun added to scene.");
    }
  } catch (err) {
    logger.error("Exception while creating sun mesh:", err);
    captureException(err);
    const fallbackSun = new Mesh(new SphereGeometry(20.0, 16, 16), new MeshBasicMaterial({color: 0xffff00}));
    fallbackSun.position.set(0, 0, 0);
    fallbackSun.userData = {isSun: true, isFallback: true};
    scene.add(fallbackSun);
    meshes.push(fallbackSun);
    sunMeshes.push(fallbackSun);
    logger.debug("Emergency fallback sun added to scene.");
  }

  if (!sunMeshes.length) {
    logger.error("No sun mesh present in scene after all attempts!");
  }
};
