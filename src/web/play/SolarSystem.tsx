import {useEffect, useRef} from "react";
import * as THREE from "three/src/Three.js";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {createDecorativeAnimation} from "./game/decorativeAnimation";
import {createDecorativeResources} from "./game/decorativeResources";
import {createDecorativeInitialization} from "./game/decorativeInitialization";
import {createDecorativeSizing} from "./game/decorativeSizing";
import {createDecorativeRestoration} from "./game/decorativeRestoration";
import {createDecorativeCanvas} from "./game/decorativeCanvas";
import sunTextureUrl from "../../../assets/3d-web/tex_sun_spots_02.webp";
// Corona plate derived from NASA's 2017 total solar eclipse imagery.
import sunCoronaTextureUrl from "../../../assets/3d-web/tex_sun_corona-v2.webp";
import {runWhenLayoutReady} from "./game/layoutReady";
import {SOLAR_SYSTEM_CONFIG, type MoonConfig, type PlanetConfig} from "./solarConfig";
import {createSolarSpacecraft} from "./solarSpacecraft";
import {createSolarGravityBodies} from "./solarGravity";
import {
  advanceFrameBasedAngle,
  advanceSolarOrbitAngle,
  advanceSolarRotationAngle,
  getCoronaAnimationState,
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
  moons: {
    /** Stores config. */
    config: MoonConfig; /** Stores mesh. */
    /** Stores mesh. */
    mesh: THREE.Mesh;
  }[];
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
export function SolarSystem({
  paused,
}: {
  /** Stores paused. */ /** Stores paused. */ /** Stores paused. */
  paused: boolean;
}) {
  /** Provides mount ref behavior. */
  const mountRef = useRef<HTMLDivElement>(null);
  /** Provides paused ref behavior. */
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  /** Controller for the currently mounted scene, refreshed by host pause changes. */
  const animationRef = useRef<ReturnType<typeof createDecorativeAnimation> | null>(null);

  /** Pending construction waits through a slow download, host pause or hidden document. */
  const initializationRef = useRef<ReturnType<typeof createDecorativeInitialization> | null>(null);

  /** Pending driver recovery refreshes before scheduling a resumed frame. */
  const restorationRef = useRef<ReturnType<typeof createDecorativeRestoration> | null>(null);

  /** Applies the latest eligible layout before scheduling resumed animation. */
  const sizingRef = useRef<ReturnType<typeof createDecorativeSizing> | null>(null);

  useEffect(() => { initializationRef.current?.refresh(); restorationRef.current?.refresh(); sizingRef.current?.refresh(); animationRef.current?.refresh(); }, [paused]);

  useEffect(() => {
    /** Provides mount behavior. */
    const mount = mountRef.current;
    if (!mount || typeof WebGLRenderingContext === "undefined") {
      return;
    }

    /** Whether the latest measured layout has positive dimensions. */
    let renderingReady = false;
    /** Last observer measurement, retained while host pause delays graphics construction. */
    let measuredLayout: DOMRectReadOnly | undefined;
    /** Layout setup is requested once without polling or repeated readiness frames. */
    let layoutPrepared = false;
    /** The resize implementation becomes available only after graphics construction. */
    let resizeScene: ((layout: DOMRectReadOnly) => void) | undefined;
    /** Whether Three can currently draw to its graphics context. */
    let contextAvailable = true;
    /** Retirement flag guarding retained browser callbacks. */
    let disposed = false;
    /** Owned layout subscription, disconnected on retirement. */
    let observer: ResizeObserver | null = null;
    /** Cancels deferred observer setup before it can touch a retired scene. */
    let stopWaitingForLayout: (() => void) | undefined;
    /** The one active frame chain owned by this scene. */
    let animation: ReturnType<typeof createDecorativeAnimation> | undefined;
    /** One-time resource construction gate owned by this mounted scene. */
    let initialization: ReturnType<typeof createDecorativeInitialization> | undefined;
    /** Buffers the latest dimensions and avoids redundant graphics resets. */
    let sizing: ReturnType<typeof createDecorativeSizing> | undefined;
    /** Defers restored-driver work while the owned scene is inactive. */
    let restoration: ReturnType<typeof createDecorativeRestoration> | undefined;
    /** Canvas context events retire before graphics disposal can trigger a loss event. */
    let contextCanvas: ReturnType<typeof createDecorativeCanvas> | undefined;
    /** Accumulated active time; suspended wall time does not advance the scene. */
    let animationElapsed = 0;

    /** Owns allocations even before the scene becomes reachable from its root. */
    const resources = createDecorativeResources(error => captureBrowserException(error, {component: "solar_system", operation: "dispose_scene"}));
    /** Stops browser work and releases partial or complete graphics setup exactly once. */
    const stopScene = () => {
      if (disposed) return;
      disposed = true;
      if (animationRef.current === animation) animationRef.current = null;
      if (initializationRef.current === initialization) initializationRef.current = null;
      if (restorationRef.current === restoration) restorationRef.current = null;
      restoration?.dispose();
      if (sizingRef.current === sizing) sizingRef.current = null;
      sizing?.dispose();
      contextCanvas?.dispose();
      resizeScene = undefined;
      measuredLayout = undefined;
      resources.dispose();
    };

    /** A broken optional renderer cannot repeatedly throw from browser callbacks. */
    const failScene = (error: unknown, operation: string) => {
      if (disposed) return;
      stopScene();
      captureBrowserException(error, {component: "solar_system", operation});
    };

    /** Measures layout before creating a renderer or requesting scene textures. */
    const prepareLayout = () => {
      if (layoutPrepared || disposed) return;
      layoutPrepared = true;
      stopWaitingForLayout = runWhenLayoutReady(() => {
        if (disposed) return;
        try {
          observer = new ResizeObserver(([entry]) => {
            if (disposed || !entry) return;
            measuredLayout = entry.contentRect;
            renderingReady = Number.isFinite(measuredLayout.width) && Number.isFinite(measuredLayout.height) &&
              measuredLayout.width > 0 && measuredLayout.height > 0;
            if (resizeScene) resizeScene(measuredLayout);
            else initialization?.refresh();
          });
          resources.defer(() => observer?.disconnect());
          observer.observe(mount);
        } catch (error) {
          failScene(error, "observe_scene");
        }
      });
      resources.defer(() => stopWaitingForLayout?.());
    };

    initialization = createDecorativeInitialization({
      canInitialize: () => {
        if (pausedRef.current) return false;
        prepareLayout();
        return renderingReady;
      },
      onError: (error) => failScene(error, "initialize_scene"),
      initialize: () => {
        try {
          /** Provides scene behavior. */
          const scene = new THREE.Scene();
          /** Provides camera behavior. */
          const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1700);
          camera.position.set(0, 45, 350);
          camera.lookAt(0, 0, 0);

          /** Renders er. */
          let renderer: THREE.WebGLRenderer;
          /** Three's internal context callbacks share this scene's failure and retirement owner. */
          contextCanvas = createDecorativeCanvas((error, eventType) => failScene(error,
            eventType === "webglcontextrestored" ? "restore_context" : "handle_context_event"));
          resources.defer(() => contextCanvas?.dispose());
          restoration = createDecorativeRestoration({
            canvas: contextCanvas.canvas,
            canRestore: () => !disposed && renderingReady && !pausedRef.current,
            onError: error => failScene(error, "restore_context"),
          });
          resources.defer(() => restoration?.dispose());
          restorationRef.current = restoration;
          try {
            renderer = new THREE.WebGLRenderer({
              canvas: contextCanvas.canvas,
              alpha: true,
              antialias: window.devicePixelRatio <= 1.5 && navigator.hardwareConcurrency > 4,
              // A decorative background must not wake a discrete GPU on dual-GPU devices.
              powerPreference: "low-power",
            });
          } catch {
            // The solar system is decorative. Context exhaustion, driver blocks, or
            // privacy modes must never prevent the puzzle itself from rendering.
            stopScene();
            return;
          }
          resources.defer(() => renderer.domElement.remove());
          resources.defer(() => renderer.forceContextLoss());
          resources.own(renderer);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          mount.append(renderer.domElement);

          /** Provides texture loader behavior. */
          const textureLoader = new THREE.TextureLoader();
          /** Loads texture. */
          const loadTexture = (url: string) => {
            /** Provides texture behavior. */
            const texture = resources.own(textureLoader.load(url, undefined, undefined, error => failScene(error, "load_texture")));
            if (disposed) throw new Error("Retired decorative texture setup");
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            return texture;
          };

          scene.add(new THREE.AmbientLight(0xb6c6ff, 1.1));
          scene.add(camera);
          /** Shares the solar scene's clock, pause state, and graphics resource lifetime. */
          const spacecraft = createSolarSpacecraft({camera, resources, scene,
            bodies: createSolarGravityBodies(SOLAR_SYSTEM_CONFIG)});
          /** Provides sunlight behavior. */
          const sunlight = new THREE.PointLight(0xffe0a6, 1100, 260);
          sunlight.position.set(0, 30, 0);
          scene.add(sunlight);

          /** Provides sun behavior. */
          const sun = new THREE.Mesh(
            resources.own(new THREE.SphereGeometry(12, 40, 28)),
            resources.own(new THREE.MeshBasicMaterial({map: loadTexture(sunTextureUrl), color: 0xfff2c6})),
          );
          sun.position.set(0, 30, 0);
          scene.add(sun);

          /** Provides sun limb uniforms behavior. */
          const sunLimbUniforms = {
            glowColour: {value: new THREE.Color(0xffd45a)},
            glowStrength: {value: 0.82},
          };
          /** Provides sun limb material behavior. */
          const sunLimbMaterial = resources.own(new THREE.ShaderMaterial({
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
          }));
          /** Provides sun limb behavior. */
          const sunLimb = new THREE.Mesh(resources.own(new THREE.SphereGeometry(13, 40, 28)), sunLimbMaterial);
          sunLimb.position.copy(sun.position);
          sunLimb.renderOrder = 1;
          scene.add(sunLimb);

          /** Provides corona texture behavior. */
          const coronaTexture = loadTexture(sunCoronaTextureUrl);
          /** Provides corona material behavior. */
          const coronaMaterial = resources.own(new THREE.SpriteMaterial({
            map: coronaTexture,
            color: 0xffcf4a,
            opacity: 0.92,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
          }));
          // The photographed corona has an opaque black background. Give dark pixels
          // proportionally less alpha while keeping their additive light unchanged.
          // Otherwise the transparent WebGL canvas composites as a black square.
          coronaMaterial.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <colorspace_fragment>",
              `#include <colorspace_fragment>
              float coronaCoverage = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
              gl_FragColor.rgb /= max(coronaCoverage, 0.0001);
              gl_FragColor.a *= coronaCoverage;`,
            );
          };
          /** Provides corona behavior. */
          const corona = new THREE.Sprite(coronaMaterial);
          // Pull the photographed limb more than two world units underneath the
          // sun's silhouette. That overlap prevents depth-buffer antialiasing from
          // exposing a dark seam while the corona remains behind orbiting bodies.
          corona.scale.set(80, 80, 1);
          corona.position.copy(sun.position);
          corona.position.z -= 0.5;
          corona.renderOrder = 0;
          scene.add(corona);

          /** Provides shooting star canvas behavior. */
          const shootingStarCanvas = document.createElement("canvas");
          shootingStarCanvas.width = 128;
          shootingStarCanvas.height = 16;
          /** Provides shooting star context behavior. */
          const shootingStarContext = shootingStarCanvas.getContext("2d");
          if (shootingStarContext) {
            /** Provides gradient behavior. */
            const gradient = shootingStarContext.createLinearGradient(0, 0, 128, 0);
            gradient.addColorStop(0, "rgba(185, 225, 255, 0)");
            gradient.addColorStop(0.72, "rgba(205, 235, 255, 0.5)");
            gradient.addColorStop(0.94, "rgba(255, 255, 255, 0.95)");
            gradient.addColorStop(1, "rgba(255, 255, 255, 0.28)");
            shootingStarContext.fillStyle = gradient;
            shootingStarContext.fillRect(0, 5, 124, 6);
            /** Provides head behavior. */
            const head = shootingStarContext.createRadialGradient(120, 8, 0, 120, 8, 8);
            head.addColorStop(0, "rgba(255, 255, 255, 1)");
            head.addColorStop(0.28, "rgba(225, 245, 255, 0.95)");
            head.addColorStop(1, "rgba(185, 225, 255, 0)");
            shootingStarContext.fillStyle = head;
            shootingStarContext.fillRect(112, 0, 16, 16);
          }
          /** Provides shooting star texture behavior. */
          const shootingStarTexture = resources.own(new THREE.CanvasTexture(shootingStarCanvas));
          shootingStarTexture.colorSpace = THREE.SRGBColorSpace;
          /** Provides shooting stars behavior. */
          const shootingStars = SHOOTING_STAR_CONFIG.map((config) => {
            /** Provides rotation behavior. */
            const rotation = Math.atan2(config.endY - config.startY, config.endX - config.startX);
            /** Provides material behavior. */
            const material = resources.own(new THREE.SpriteMaterial({
              map: shootingStarTexture,
              color: 0xe9f7ff,
              opacity: 0,
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthTest: true,
              depthWrite: false,
              rotation,
            }));
            /** Provides sprite behavior. */
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(config.scale, 5, 1);
            sprite.visible = false;
            scene.add(sprite);
            return {config, material, sprite};
          });

          /** Provides runtimes behavior. */
          const runtimes: PlanetRuntime[] = SOLAR_SYSTEM_CONFIG.map((config) => {
            /** Provides orbit behavior. */
            const orbit = new THREE.Group();
            scene.add(orbit);
            /** Provides planet behavior. */
            const planet = new THREE.Mesh(
              resources.own(new THREE.SphereGeometry(config.size, 28, 20)),
              resources.own(new THREE.MeshPhongMaterial({map: loadTexture(config.texture), shininess: 28})),
            );
            planet.position.set(
              Math.cos(config.startAngle) * config.distance,
              config.yPosition,
              Math.sin(config.startAngle) * config.distance,
            );
            planet.name = config.name;
            orbit.add(planet);
            if (config.name === "Earth") {
              spacecraft.orbitEarth({orbit, planet, radius: config.size});
            }

            /** Provides atmosphere behavior. */
            const atmosphere = new THREE.Mesh(
              resources.own(new THREE.SphereGeometry(config.size * config.atmosphere.scale, 28, 20)),
              resources.own(new THREE.ShaderMaterial({
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
              })),
            );
            atmosphere.name = `${config.name} atmosphere`;
            atmosphere.renderOrder = 1;
            planet.add(atmosphere);

            if (config.ring) {
              /** Provides ring behavior. */
              const ring = new THREE.Mesh(
                resources.own(new THREE.RingGeometry(config.ring.innerRadius, config.ring.outerRadius, 64)),
                resources.own(new THREE.MeshPhongMaterial({
                  map: loadTexture(config.ring.texture),
                  transparent: true,
                  opacity: 0.55,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                })),
              );
              ring.rotation.x = config.ring.tiltRadians;
              planet.add(ring);
            }

            /** Provides moons behavior. */
            const moons = config.moons.map((moonConfig) => {
              /** Provides mesh behavior. */
              const mesh = new THREE.Mesh(
                resources.own(new THREE.SphereGeometry(moonConfig.size, 20, 14)),
                resources.own(new THREE.MeshPhongMaterial({map: loadTexture(moonConfig.texture), shininess: 12})),
              );
              planet.add(mesh);
              return {config: moonConfig, mesh};
            });
            return {config, orbit, planet, moons};
          });

          /** Drawing buffer dimensions used to constrain Firefox viewport rounding. */
          const drawingBufferSize = new THREE.Vector2();

          sizing = createDecorativeSizing({
            canResize: () => !disposed && renderingReady && contextAvailable && !pausedRef.current,
            onError: error => failScene(error, "resize_scene"),
            apply: (renderWidth, renderHeight) => {
              renderer.setSize(renderWidth, renderHeight, false);
              renderer.getDrawingBufferSize(drawingBufferSize);
              /** Converts bounded buffer dimensions back to renderer CSS pixels. */
              const pixelRatio = renderer.getPixelRatio();
              renderer.setViewport(0, 0, drawingBufferSize.x / pixelRatio, drawingBufferSize.y / pixelRatio);
              camera.aspect = renderWidth / renderHeight;
              camera.updateProjectionMatrix();
            },
          });
          resources.defer(() => sizing?.dispose());
          sizingRef.current = sizing;

          /** Context restoration is owned by Three; scheduling follows its availability. */
          function contextLost() {
            if (disposed) return;
            contextAvailable = false;
            animation?.refresh();
          }
          /** Allows scheduling after Three restores a context, subject to pause and layout. */
          function contextRestored() {
            if (disposed) return;
            contextAvailable = true;
            sizing?.refresh();
            animation?.refresh();
          }
          resources.defer(() => renderer.domElement.removeEventListener("webglcontextlost", contextLost));
          resources.defer(() => renderer.domElement.removeEventListener("webglcontextrestored", contextRestored));
          renderer.domElement.addEventListener("webglcontextlost", contextLost);
          renderer.domElement.addEventListener("webglcontextrestored", contextRestored);

          animation = createDecorativeAnimation({
            canRender: () => !disposed && renderingReady && contextAvailable && !pausedRef.current,
            onError: (error) => failScene(error, "animate_scene"),
            render: (deltaSeconds) => {
              animationElapsed += deltaSeconds;
              sun.rotation.y = advanceSolarRotationAngle(sun.rotation.y, 0.0018, deltaSeconds);
              /** Provides corona animation behavior. */
              const coronaAnimation = getCoronaAnimationState(animationElapsed);
              corona.scale.set(coronaAnimation.scaleX, coronaAnimation.scaleY, 1);
              coronaMaterial.rotation = coronaAnimation.rotation;
              coronaMaterial.opacity = coronaAnimation.opacity;
              sunLimbUniforms.glowStrength.value = coronaAnimation.limbGlowStrength;
              for (const {config, material, sprite} of shootingStars) {
                /** Provides progress behavior. */
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
                  0,
                  runtime.config.orbitSpeed,
                  animationElapsed,
                );
                runtime.planet.rotation.y = advanceSolarRotationAngle(
                  runtime.planet.rotation.y,
                  runtime.config.rotationSpeed,
                  deltaSeconds,
                );
                runtime.moons.forEach(({config, mesh}) => {
                  /** Provides angle behavior. */
                  const angle = advanceFrameBasedAngle(config.startAngle, config.orbitSpeed, animationElapsed);
                  mesh.position.set(Math.cos(angle) * config.distance, 0, Math.sin(angle) * config.distance);
                });
              }
              spacecraft.animate(animationElapsed);
              renderer.render(scene, camera);
            },
          });
          resources.defer(() => animation?.dispose());
          if (!disposed) animationRef.current = animation;

          /** Stores the latest layout, restoring driver state before applying eligible dimensions. */
          resizeScene = ({width, height}: DOMRectReadOnly) => {
            if (disposed) return;
            renderingReady = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
            sizing?.update(width, height);
            restoration?.refresh();
            sizing?.refresh();
            animation?.refresh();
          };
          if (measuredLayout) resizeScene(measuredLayout);
        } catch (error) {
          failScene(error, "initialize_scene");
        }
      },
    });
    resources.defer(() => initialization?.dispose());
    if (!disposed) initializationRef.current = initialization;
    return stopScene;
  }, []);

  return <div ref={mountRef} className="solar-system" aria-hidden="true" data-testid="solar-system" />;
}
