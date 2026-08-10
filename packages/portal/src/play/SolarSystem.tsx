import {useEffect, useRef} from "react";
import * as THREE from "three/src/Three.js";
import sunTextureUrl from "../../../../assets/3d-web/tex_sun_spots_02.webp";
// Corona plate derived from NASA's 2017 total solar eclipse imagery.
import sunCoronaTextureUrl from "../../../../assets/3d-web/tex_sun_corona-v2.webp";
import {runWhenLayoutReady} from "./game/layoutReady";
import {SOLAR_SYSTEM_CONFIG, type MoonConfig, type PlanetConfig} from "./solarConfig";
import {
  advanceFrameBasedAngle,
  advanceSolarOrbitAngle,
  advanceSolarRotationAngle,
  getCoronaAnimationState,
  getFrameDeltaSeconds,
  getShootingStarProgress,
} from "./solarMotion";

/** Defines the atmosphere vertex shader value. */
const ATMOSPHERE_VERTEX_SHADER = `
  varying float viewFacing;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 viewDirection = normalize(-viewPosition.xyz);
    viewFacing = max(dot(viewNormal, viewDirection), 0.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/** Defines the atmosphere fragment shader value. */
const ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 atmosphereColour;
  uniform float atmosphereOpacity;
  uniform float atmosphereFalloff;
  uniform float surfaceHaze;
  varying float viewFacing;
  void main() {
    float rim = pow(1.0 - viewFacing, atmosphereFalloff);
    float haze = pow(viewFacing, 0.7) * surfaceHaze;
    float glow = clamp((smoothstep(0.03, 1.0, rim) + haze) * atmosphereOpacity, 0.0, 1.0);
    gl_FragColor = vec4(atmosphereColour, glow);
  }
`;

/** Describes planet runtime. */
type PlanetRuntime = {
  /** Stores config. */
  config: PlanetConfig;
  /** Stores orbit. */
  orbit: THREE.Group;
  /** Stores planet. */
  planet: THREE.Mesh;
  /** Stores moons. */
  moons: {config: MoonConfig; mesh: THREE.Mesh}[];
};

/** Defines the shooting star config value. */
const SHOOTING_STAR_CONFIG = [
  {phaseOffsetSeconds: 0, startX: -185, startY: 105, endX: 185, endY: 33, scale: 86},
  {phaseOffsetSeconds: 4, startX: 185, startY: 118, endX: -185, endY: 38, scale: 78},
  {phaseOffsetSeconds: 8, startX: -135, startY: 145, endX: 70, endY: -18, scale: 88},
  {phaseOffsetSeconds: 12, startX: 155, startY: -18, endX: -82, endY: 142, scale: 82},
  {phaseOffsetSeconds: 16, startX: -160, startY: -12, endX: 112, endY: 140, scale: 92},
  {phaseOffsetSeconds: 20, startX: 170, startY: 142, endX: -115, endY: -16, scale: 84},
] as const;

/** Defines the shooting star background depth value. */
const SHOOTING_STAR_BACKGROUND_DEPTH =
  -Math.max(
    ...SOLAR_SYSTEM_CONFIG.map((planet) =>
      Math.max(
        planet.distance + planet.size,
        ...planet.moons.map((moon) => planet.distance + moon.distance + moon.size),
      ),
    ),
  ) - 24;

/** Provides solar system behavior. */
export function SolarSystem({paused}: {paused: boolean}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || typeof WebGLRenderingContext === "undefined") {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1700);
    camera.position.set(0, 45, 350);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: window.devicePixelRatio <= 1.5 && navigator.hardwareConcurrency > 4,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.append(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const loadTexture = (url: string) => {
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    };

    scene.add(new THREE.AmbientLight(0xb6c6ff, 1.1));
    const sunlight = new THREE.PointLight(0xffe0a6, 1100, 260);
    sunlight.position.set(0, 30, 0);
    scene.add(sunlight);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(12, 40, 28),
      new THREE.MeshBasicMaterial({map: loadTexture(sunTextureUrl), color: 0xfff2c6}),
    );
    sun.position.set(0, 30, 0);
    scene.add(sun);

    const sunLimbUniforms = {
      glowColour: {value: new THREE.Color(0xffd45a)},
      glowStrength: {value: 0.82},
    };
    const sunLimbMaterial = new THREE.ShaderMaterial({
      uniforms: sunLimbUniforms,
      vertexShader: `
        varying float limbIntensity;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 viewNormal = normalize(normalMatrix * normal);
          vec3 viewDirection = normalize(-viewPosition.xyz);
          limbIntensity = pow(1.0 - max(dot(viewNormal, viewDirection), 0.0), 2.1);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColour;
        uniform float glowStrength;
        varying float limbIntensity;
        void main() {
          float glow = smoothstep(0.12, 1.0, limbIntensity) * glowStrength;
          gl_FragColor = vec4(glowColour * glow, glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    const sunLimb = new THREE.Mesh(new THREE.SphereGeometry(13, 40, 28), sunLimbMaterial);
    sunLimb.position.copy(sun.position);
    sunLimb.renderOrder = 1;
    scene.add(sunLimb);

    const coronaTexture = loadTexture(sunCoronaTextureUrl);
    const coronaMaterial = new THREE.SpriteMaterial({
      map: coronaTexture,
      color: 0xffcf4a,
      opacity: 0.92,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    const corona = new THREE.Sprite(coronaMaterial);
    // Pull the photographed limb more than two world units underneath the
    // sun's silhouette. That overlap prevents depth-buffer antialiasing from
    // exposing a dark seam while the corona remains behind orbiting bodies.
    corona.scale.set(80, 80, 1);
    corona.position.copy(sun.position);
    corona.position.z -= 0.5;
    corona.renderOrder = 0;
    scene.add(corona);

    const starPositions = new Float32Array(900 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 340;
      starPositions[index + 1] = Math.random() * 170 - 20;
      starPositions[index + 2] = (Math.random() - 0.5) * 260;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({color: 0xffffff, size: 0.55, transparent: true, opacity: 0.75}),
    );
    scene.add(stars);

    const shootingStarCanvas = document.createElement("canvas");
    shootingStarCanvas.width = 128;
    shootingStarCanvas.height = 16;
    const shootingStarContext = shootingStarCanvas.getContext("2d");
    if (shootingStarContext) {
      const gradient = shootingStarContext.createLinearGradient(0, 0, 128, 0);
      gradient.addColorStop(0, "rgba(185, 225, 255, 0)");
      gradient.addColorStop(0.72, "rgba(205, 235, 255, 0.5)");
      gradient.addColorStop(0.94, "rgba(255, 255, 255, 0.95)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.28)");
      shootingStarContext.fillStyle = gradient;
      shootingStarContext.fillRect(0, 5, 124, 6);
      const head = shootingStarContext.createRadialGradient(120, 8, 0, 120, 8, 8);
      head.addColorStop(0, "rgba(255, 255, 255, 1)");
      head.addColorStop(0.28, "rgba(225, 245, 255, 0.95)");
      head.addColorStop(1, "rgba(185, 225, 255, 0)");
      shootingStarContext.fillStyle = head;
      shootingStarContext.fillRect(112, 0, 16, 16);
    }
    const shootingStarTexture = new THREE.CanvasTexture(shootingStarCanvas);
    shootingStarTexture.colorSpace = THREE.SRGBColorSpace;
    const shootingStars = SHOOTING_STAR_CONFIG.map((config) => {
      const rotation = Math.atan2(config.endY - config.startY, config.endX - config.startX);
      const material = new THREE.SpriteMaterial({
        map: shootingStarTexture,
        color: 0xe9f7ff,
        opacity: 0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        rotation,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(config.scale, 5, 1);
      sprite.visible = false;
      scene.add(sprite);
      return {config, material, sprite};
    });

    const runtimes: PlanetRuntime[] = SOLAR_SYSTEM_CONFIG.map((config) => {
      const orbit = new THREE.Group();
      scene.add(orbit);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(config.size, 28, 20),
        new THREE.MeshPhongMaterial({map: loadTexture(config.texture), shininess: 28}),
      );
      planet.position.set(
        Math.cos(config.startAngle) * config.distance,
        config.yPosition,
        Math.sin(config.startAngle) * config.distance,
      );
      planet.name = config.name;
      orbit.add(planet);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(config.size * config.atmosphere.scale, 28, 20),
        new THREE.ShaderMaterial({
          uniforms: {
            atmosphereColour: {value: new THREE.Color(config.atmosphere.color)},
            atmosphereOpacity: {value: config.atmosphere.opacity},
            atmosphereFalloff: {value: config.atmosphere.falloff},
            surfaceHaze: {value: config.atmosphere.surfaceHaze},
          },
          vertexShader: ATMOSPHERE_VERTEX_SHADER,
          fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthTest: true,
          depthWrite: false,
        }),
      );
      atmosphere.name = `${config.name} atmosphere`;
      atmosphere.renderOrder = 1;
      planet.add(atmosphere);

      if (config.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(config.ring.innerRadius, config.ring.outerRadius, 64),
          new THREE.MeshPhongMaterial({
            map: loadTexture(config.ring.texture),
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = config.ring.tiltRadians;
        planet.add(ring);
      }

      const moons = config.moons.map((moonConfig) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(moonConfig.size, 20, 14),
          new THREE.MeshPhongMaterial({map: loadTexture(moonConfig.texture), shininess: 12}),
        );
        planet.add(mesh);
        return {config: moonConfig, mesh};
      });
      return {config, orbit, planet, moons};
    });

    let renderingReady = false;
    let observer: ResizeObserver | null = null;
    const drawingBufferSize = new THREE.Vector2();
    const resize = ({width, height}: DOMRectReadOnly) => {
      // Keep the WebGL viewport within the integer-sized drawing buffer. Fractional
      // CSS pixels can otherwise make Firefox round the viewport up while the
      // canvas backing store is rounded down.
      const renderWidth = Math.max(1, Math.floor(width));
      const renderHeight = Math.max(1, Math.floor(height));
      renderer.setSize(renderWidth, renderHeight, false);
      renderer.getDrawingBufferSize(drawingBufferSize);
      const pixelRatio = renderer.getPixelRatio();
      renderer.setViewport(
        0,
        0,
        drawingBufferSize.x / pixelRatio,
        drawingBufferSize.y / pixelRatio,
      );
      camera.aspect = renderWidth / renderHeight;
      camera.updateProjectionMatrix();
      renderingReady = width > 0 && height > 0;
    };
    const stopWaitingForLayout = runWhenLayoutReady(() => {
      observer = new ResizeObserver(([entry]) => {
        if (entry) resize(entry.contentRect);
      });
      observer.observe(mount);
    });

    let lastFrameAt = performance.now();
    let animationElapsed = 0;
    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const frameAt = performance.now();
      const deltaSeconds = getFrameDeltaSeconds(frameAt, lastFrameAt);
      lastFrameAt = frameAt;
      if (renderingReady && !pausedRef.current && !document.hidden) {
        animationElapsed += deltaSeconds;
        sun.rotation.y = advanceSolarRotationAngle(sun.rotation.y, 0.0018, deltaSeconds);
        const coronaAnimation = getCoronaAnimationState(animationElapsed);
        corona.scale.set(coronaAnimation.scaleX, coronaAnimation.scaleY, 1);
        coronaMaterial.rotation = coronaAnimation.rotation;
        coronaMaterial.opacity = coronaAnimation.opacity;
        sunLimbUniforms.glowStrength.value = coronaAnimation.limbGlowStrength;
        for (const {config, material, sprite} of shootingStars) {
          const progress = getShootingStarProgress(animationElapsed, config.phaseOffsetSeconds);
          sprite.visible = progress !== null;
          if (progress === null) continue;
          sprite.position.set(
            config.startX + (config.endX - config.startX) * progress,
            config.startY + (config.endY - config.startY) * progress,
            SHOOTING_STAR_BACKGROUND_DEPTH,
          );
          material.opacity = Math.sin(progress * Math.PI) * 0.92;
        }
        for (const runtime of runtimes) {
          runtime.orbit.rotation.y = advanceSolarOrbitAngle(
            runtime.orbit.rotation.y,
            runtime.config.orbitSpeed,
            deltaSeconds,
          );
          runtime.planet.rotation.y = advanceSolarRotationAngle(
            runtime.planet.rotation.y,
            runtime.config.rotationSpeed,
            deltaSeconds,
          );
          runtime.moons.forEach(({config, mesh}) => {
            const angle = advanceFrameBasedAngle(config.startAngle, config.orbitSpeed, animationElapsed);
            mesh.position.set(Math.cos(angle) * config.distance, 0, Math.sin(angle) * config.distance);
          });
        }
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      stopWaitingForLayout();
      observer?.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map instanceof THREE.Texture) {
              material.map.dispose();
            }
            material.dispose();
          });
        }
      });
      coronaTexture.dispose();
      coronaMaterial.dispose();
      shootingStarTexture.dispose();
      shootingStars.forEach(({material}) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="solar-system" aria-hidden="true" data-testid="solar-system" />;
}
