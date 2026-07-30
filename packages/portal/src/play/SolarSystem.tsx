import {useEffect, useRef} from "react";
import * as THREE from "three";
import sunTextureUrl from "../../../../assets/3d-web/tex_sun_spots_02.webp";
import mercuryTextureUrl from "../../../../assets/3d-web/tex_planet_a.webp";
import venusTextureUrl from "../../../../assets/3d-web/tex_planet_d.webp";
import earthTextureUrl from "../../../../assets/3d-web/tex_planet_v.webp";
import marsTextureUrl from "../../../../assets/3d-web/tex_planet_r.webp";
import jupiterTextureUrl from "../../../../assets/3d-web/tex_planet_k.webp";
import saturnTextureUrl from "../../../../assets/3d-web/tex_planet_s.webp";
import uranusTextureUrl from "../../../../assets/3d-web/tex_planet_u.webp";
import moonCTextureUrl from "../../../../assets/3d-web/tex_moon_c.webp";
import moonDTextureUrl from "../../../../assets/3d-web/tex_moon_d.webp";
import moonFTextureUrl from "../../../../assets/3d-web/tex_moon_f.webp";
import moonGTextureUrl from "../../../../assets/3d-web/tex_moon_g.webp";
import moonHTextureUrl from "../../../../assets/3d-web/tex_moon_h.webp";
import ringATextureUrl from "../../../../assets/3d-web/tex_ring_a.webp";
import ringBTextureUrl from "../../../../assets/3d-web/tex_ring_b.webp";
import {advanceAngle, getFrameDeltaSeconds} from "./solarMotion";

type MoonConfig = {
  size: number;
  distance: number;
  orbitSpeed: number;
  texture: string;
  startAngle: number;
};

type PlanetConfig = {
  name: string;
  size: number;
  distance: number;
  orbitSpeed: number;
  rotationSpeed: number;
  texture: string;
  startAngle: number;
  yPosition: number;
  moons: MoonConfig[];
  ring?: {innerRadius: number; outerRadius: number; texture: string; tiltRadians: number};
};

export const SOLAR_SYSTEM_CONFIG: readonly PlanetConfig[] = [
  {
    name: "Mercury",
    size: 2.2,
    distance: 18,
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    texture: mercuryTextureUrl,
    startAngle: 0,
    yPosition: 30,
    moons: [],
  },
  {
    name: "Venus",
    size: 3,
    distance: 26,
    orbitSpeed: 0.018,
    rotationSpeed: 0.008,
    texture: venusTextureUrl,
    startAngle: Math.PI / 3,
    yPosition: 30,
    moons: [],
  },
  {
    name: "Earth",
    size: 3.5,
    distance: 30,
    orbitSpeed: 0.015,
    rotationSpeed: 0.02,
    texture: earthTextureUrl,
    startAngle: (Math.PI * 2) / 3,
    yPosition: 30,
    moons: [{size: 1, distance: 7, orbitSpeed: 0.06, texture: moonDTextureUrl, startAngle: 0}],
    ring: {innerRadius: 4.5, outerRadius: 6.1, texture: ringATextureUrl, tiltRadians: Math.PI / 2.45},
  },
  {
    name: "Mars",
    size: 2.6,
    distance: 35,
    orbitSpeed: 0.015,
    rotationSpeed: 0.015,
    texture: marsTextureUrl,
    startAngle: Math.PI,
    yPosition: 28,
    moons: [{size: 0.8, distance: 7, orbitSpeed: 0.08, texture: moonGTextureUrl, startAngle: 0}],
  },
  {
    name: "Jupiter",
    size: 10,
    distance: 70,
    orbitSpeed: 0.004,
    rotationSpeed: 0.025,
    texture: jupiterTextureUrl,
    startAngle: Math.PI * 1.2,
    yPosition: 30,
    moons: [
      {size: 1.3, distance: 13, orbitSpeed: 0.03, texture: moonHTextureUrl, startAngle: 0},
      {size: 1, distance: 11.5, orbitSpeed: 0.032, texture: moonCTextureUrl, startAngle: Math.PI / 3},
    ],
  },
  {
    name: "Saturn",
    size: 8.5,
    distance: 90,
    orbitSpeed: 0.005,
    rotationSpeed: 0.022,
    texture: saturnTextureUrl,
    startAngle: Math.PI * 1.7,
    yPosition: 30,
    moons: [
      {size: 2, distance: 12, orbitSpeed: 0.038, texture: moonFTextureUrl, startAngle: 0},
      {size: 1.6, distance: 12, orbitSpeed: 0.03, texture: moonDTextureUrl, startAngle: Math.PI / 2},
    ],
    ring: {innerRadius: 11.5, outerRadius: 16.5, texture: ringBTextureUrl, tiltRadians: Math.PI / 2.25},
  },
  {
    name: "Uranus",
    size: 7,
    distance: 150,
    orbitSpeed: 0.004,
    rotationSpeed: 0.018,
    texture: uranusTextureUrl,
    startAngle: Math.PI * 0.3,
    yPosition: 30,
    moons: [],
  },
] as const;

type PlanetRuntime = {
  config: PlanetConfig;
  orbit: THREE.Group;
  planet: THREE.Mesh;
  moons: {config: MoonConfig; mesh: THREE.Mesh}[];
};

export function SolarSystem({paused}: {paused: boolean}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || typeof WebGLRenderingContext === "undefined") {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1700);
    camera.position.set(0, 45, 350);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: "high-performance"});
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

    const coronaCanvas = document.createElement("canvas");
    coronaCanvas.width = 128;
    coronaCanvas.height = 128;
    const coronaContext = coronaCanvas.getContext("2d");
    if (coronaContext) {
      const gradient = coronaContext.createRadialGradient(64, 64, 8, 64, 64, 64);
      gradient.addColorStop(0, "rgba(255, 237, 169, 0.95)");
      gradient.addColorStop(0.3, "rgba(255, 174, 63, 0.6)");
      gradient.addColorStop(0.68, "rgba(255, 120, 35, 0.18)");
      gradient.addColorStop(1, "rgba(255, 120, 35, 0)");
      coronaContext.fillStyle = gradient;
      coronaContext.fillRect(0, 0, 128, 128);
    }
    const coronaTexture = new THREE.CanvasTexture(coronaCanvas);
    const coronaMaterial = new THREE.SpriteMaterial({
      map: coronaTexture,
      color: 0xff9d32,
      opacity: 0.5,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const corona = new THREE.Sprite(coronaMaterial);
    corona.scale.set(54, 54, 1);
    corona.position.copy(sun.position);
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

    const resize = () => {
      const {width, height} = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let lastFrameAt = performance.now();
    let animationElapsed = 0;
    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const frameAt = performance.now();
      const deltaSeconds = getFrameDeltaSeconds(frameAt, lastFrameAt);
      lastFrameAt = frameAt;
      if (!paused && !document.hidden) {
        animationElapsed += deltaSeconds;
        sun.rotation.y = advanceAngle(sun.rotation.y, 0.0018, deltaSeconds);
        coronaMaterial.opacity = 0.28 + Math.sin(animationElapsed * 0.85) * 0.08;
        const coronaScale = 53 + Math.sin(animationElapsed * 0.85) * 2.5;
        corona.scale.set(coronaScale, coronaScale, 1);
        stars.rotation.y = advanceAngle(stars.rotation.y, 0.00004, deltaSeconds);
        for (const runtime of runtimes) {
          runtime.orbit.rotation.y = advanceAngle(
            runtime.orbit.rotation.y,
            runtime.config.orbitSpeed,
            deltaSeconds,
          );
          runtime.planet.rotation.y = advanceAngle(
            runtime.planet.rotation.y,
            runtime.config.rotationSpeed,
            deltaSeconds,
          );
          runtime.moons.forEach(({config, mesh}) => {
            const angle = config.startAngle + animationElapsed * config.orbitSpeed;
            mesh.position.set(Math.cos(angle) * config.distance, 0, Math.sin(angle) * config.distance);
          });
        }
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
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
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [paused]);

  return <div ref={mountRef} className="solar-system" aria-hidden="true" data-testid="solar-system" />;
}
