import * as THREE from "three/src/Three.js";
import type {createDecorativeResources} from "./game/decorativeResources";
import {createRocketFlight, ROCKET_FLIGHT_SECONDS} from "./solarRocketMotion";
import type {SolarGravityBody} from "./solarGravity";

/** Builds a small fleet using shared geometry and the solar scene's resource owner. */
export function createSolarSpacecraft({camera, resources, scene, bodies}: {
  /** Camera-relative saucers retain their existing screen placement. */
  camera: THREE.PerspectiveCamera;
  /** The solar scene owns every shared graphics allocation. */
  resources: ReturnType<typeof createDecorativeResources>;
  /** Rockets travel in the same world frame as Earth and the other planets. */
  scene: THREE.Scene;
  /** Moving gravity sources, synchronized with the scene's active clock. */
  bodies: readonly SolarGravityBody[];
}) {
  /** Camera-relative placement keeps the miniature craft visible on narrow screens. */
  const fleet = new THREE.Group();
  fleet.name = "spacecraft";
  camera.add(fleet);
  resources.defer(() => fleet.removeFromParent());

  /** All models share these low-detail shapes instead of downloading model files. */
  const shapes = {
    sphere: resources.own(new THREE.SphereGeometry(1, 16, 10)),
    cylinder: resources.own(new THREE.CylinderGeometry(1, 1, 1, 16)),
    cone: resources.own(new THREE.ConeGeometry(1, 1, 16)),
    box: resources.own(new THREE.BoxGeometry(1, 1, 1)),
  };
  /** A restrained palette leaves the puzzle brighter than the background craft. */
  const paints = {
    hull: resources.own(new THREE.MeshPhongMaterial({color: 0xa6b5c8, shininess: 65})),
    white: resources.own(new THREE.MeshPhongMaterial({color: 0xe2e8e5, shininess: 30})),
    dark: resources.own(new THREE.MeshPhongMaterial({color: 0x26374b, shininess: 45})),
    glass: resources.own(new THREE.MeshPhongMaterial({color: 0x59c7cd, emissive: 0x163e4b, shininess: 90})),
    solar: resources.own(new THREE.MeshPhongMaterial({color: 0x294d8e, emissive: 0x080f24, shininess: 60})),
    gold: resources.own(new THREE.MeshPhongMaterial({color: 0xb58e51, shininess: 40})),
    red: resources.own(new THREE.MeshPhongMaterial({color: 0xb95850, shininess: 30})),
    mint: resources.own(new THREE.MeshBasicMaterial({color: 0x87eacb})),
    exhaust: resources.own(new THREE.MeshBasicMaterial({color: 0xe9a15d})),
  };

  /** Adds a scaled part without allocating another geometry or material. */
  function part(
    parent: THREE.Group,
    shape: keyof typeof shapes,
    paint: keyof typeof paints,
    position: [number, number, number],
    scale: [number, number, number],
  ) {
    /** Each mesh owns only its transform; geometry and paint belong to the scene. */
    const mesh = new THREE.Mesh(shapes[shape], paints[paint]);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  /** A flattened silver saucer, a glass dome, and small navigation lights. */
  function saucer() {
    /** Each saucer has an independent flight path and bank angle. */
    const model = new THREE.Group();
    part(model, "sphere", "dark", [0, -0.4, 0], [5.5, 0.7, 4]);
    part(model, "sphere", "hull", [0, 0, 0], [6.5, 0.9, 4.7]);
    part(model, "sphere", "glass", [0, 0.85, 0], [2.6, 1.7, 2.3]);
    for (const x of [-3.8, 0, 3.8]) {
      part(model, "sphere", "mint", [x, -0.1, 3.9 - Math.abs(x) * 0.28], [0.4, 0.28, 0.32]);
    }
    model.rotation.x = 0.38;
    return model;
  }

  /** The ISS silhouette has a long truss, eight solar wings, and a central module cluster. */
  function station() {
    /** Individual panels share a gold backing and blue photovoltaic cells. */
    const model = new THREE.Group();
    part(model, "box", "hull", [0, 0, 0], [24, 0.5, 0.6]);
    for (const x of [-10, -6.5, 6.5, 10]) {
      for (const y of [-3.3, 3.3]) {
        part(model, "box", "gold", [x, y, 0], [2.8, 5.6, 0.2]);
        part(model, "box", "solar", [x, y, 0.15], [2.5, 5.3, 0.15]);
        part(model, "box", "gold", [x, y, 0.25], [0.1, 5.3, 0.08]);
        part(model, "box", "gold", [x, y, 0.25], [2.5, 0.1, 0.08]);
      }
    }
    part(model, "cylinder", "white", [0, 0, 0.8], [0.9, 9, 0.9]);
    part(model, "cylinder", "white", [-1.7, 0.2, 0.8], [0.7, 4.5, 0.7]).rotation.z = Math.PI / 2;
    part(model, "cylinder", "white", [0, -4.8, 0.8], [0.6, 1.2, 0.6]);
    part(model, "box", "white", [-3.5, -2, 0.8], [3.5, 2.1, 0.2]);
    part(model, "box", "white", [3.5, -2, 0.8], [3.5, 2.1, 0.2]);
    model.rotation.set(0.26, -0.24, -0.35);
    return model;
  }

  /** A white rocket with a red nose and fins, a porthole, and a short engine plume. */
  function rocket() {
    /** The plume stays part of the model, without another animation or particle system. */
    const model = new THREE.Group();
    part(model, "cylinder", "white", [0, 0, 0], [1.4, 6.8, 1.4]);
    part(model, "cone", "red", [0, 4.5, 0], [1.4, 2.3, 1.4]);
    part(model, "cylinder", "dark", [0, -3.5, 0], [1.15, 0.9, 1.15]);
    part(model, "sphere", "glass", [0, 1.4, 1.3], [0.62, 0.62, 0.22]);
    for (const x of [-1.5, 1.5]) {
      part(model, "cone", "red", [x, -2.2, 0], [1.1, 3, 0.55]);
    }
    /** Anchor the exhaust at the nozzle so throttle changes cannot detach it from the engine. */
    const exhaust = new THREE.Group();
    exhaust.name = "Rocket exhaust";
    exhaust.position.y = -3.8;
    exhaust.visible = false;
    model.add(exhaust);
    part(exhaust, "cone", "exhaust", [0, -1.8, 0], [0.85, 3.6, 0.85]).rotation.z = Math.PI;
    part(exhaust, "cone", "mint", [0, -1.1, 0], [0.4, 2.2, 0.4]).rotation.z = Math.PI;
    return {model, exhaust};
  }

  /** The station's inclined orbital plane follows Earth without inheriting its surface spin. */
  const stationPlane = new THREE.Group();
  stationPlane.name = "ISS Earth orbit";
  stationPlane.rotation.set(0.9, 0, 0.25);
  resources.defer(() => stationPlane.removeFromParent());
  /** Rotation within the tilted plane moves the station in front of and behind Earth. */
  const stationOrbit = new THREE.Group();
  stationPlane.add(stationOrbit);
  /** Keep the station smaller than Earth while retaining its solar-panel silhouette. */
  const iss = station();
  iss.name = "ISS";
  iss.scale.setScalar(0.11);
  stationOrbit.add(iss);

  /** Each visit uses one saucer, with an empty sky between passes. */
  const aliens = [
    {model: saucer(), y: 0.4, bank: -0.16},
    {model: saucer(), y: -0.25, bank: 0.2},
    {model: saucer(), y: -0.78, bank: -0.12},
  ];
  for (const [index, {model}] of aliens.entries()) {
    model.name = `Alien saucer ${index + 1}`;
    model.scale.setScalar(0.5);
    model.visible = false;
    fleet.add(model);
  }

  /** A world-space parent prevents the camera from relocating an Earth launch to a screen edge. */
  const departures = new THREE.Group();
  departures.name = "Earth rocket departures";
  scene.add(departures);
  resources.defer(() => departures.removeFromParent());
  /** The rocket model's nose points along its local positive y axis. */
  const rocketUp = new THREE.Vector3(0, 1, 0);
  /** Reuse the inertial heading vector without per-frame Three allocations. */
  const heading = new THREE.Vector3();

  /** Each slot owns one Earth launch and a bounded amount of integration state. */
  function departure({offset, variant}: {
    /** Delay before this slot's first Earth launch. */
    offset: number;
    /** Departure-plane inclination variant. */
    variant: number;
  }) {
    /** The nozzle, rather than the middle of the model, follows the physical departure point. */
    const {model, exhaust} = rocket();
    model.visible = false;
    model.scale.setScalar(0.5);
    departures.add(model);
    /** The cycle and its integrator are replaced together at the next Earth launch. */
    let current: {
      /** Launch generation belonging to this integrator. */
      cycle: number;
      /** Samples one departure from its fixed Earth origin. */
      sample: ReturnType<typeof createRocketFlight>;
    } | null = null;
    return {model,
      /** Advances only the departure belonging to the active scene clock. */
      animate(elapsedSeconds: number) {
      if (elapsedSeconds < offset) {model.visible = false; return;}
      /** Launch intervals have a quiet gap, and never begin partway along a flight. */
      const cycle = Math.floor((elapsedSeconds - offset) / (ROCKET_FLIGHT_SECONDS + 12));
      /** Active age excludes every paused or hidden interval. */
      const age = elapsedSeconds - offset - cycle * (ROCKET_FLIGHT_SECONDS + 12);
      if (age >= ROCKET_FLIGHT_SECONDS) {model.visible = false; return;}
      if (current?.cycle !== cycle) {
        current = {cycle, sample: createRocketFlight({bodies, variant,
          launchAt: offset + cycle * (ROCKET_FLIGHT_SECONDS + 12)})};
      }
      /** Gravity and thrust supply both the position and its consistent inertial heading. */
      const flight = current.sample(age);
      model.visible = flight.kind === "flying";
      if (!model.visible) return;
      heading.set(flight.vx, flight.vy, flight.vz).normalize();
      model.quaternion.setFromUnitVectors(rocketUp, heading);
      model.position.set(flight.x, flight.y, flight.z).addScaledVector(heading, 1.9);
      exhaust.visible = flight.throttle > 0;
      exhaust.scale.set(0.8 + 0.2 * flight.throttle, 0.6 + 0.4 * flight.throttle, 0.8 + 0.2 * flight.throttle);
    }};
  }

  /** Both flights start at the Earth position belonging to their own launch time. */
  const flights = [departure({offset: 0, variant: -1}), departure({offset: 24, variant: 1})];
  for (const [index, {model}] of flights.entries()) model.name = `Rocket ${index + 1}`;

  /** Uses the existing scene clock so pause, visibility, and retirement stop the whole fleet. */
  function animate(elapsedSeconds: number) {
    /** Position at a fixed camera depth with sizes proportional to viewport height. */
    const distance = 310;
    /** Perspective bounds change after the solar scene applies a resize. */
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    /** Eight-second flybys begin after twelve seconds, then repeat every thirty seconds. */
    const visitElapsed = elapsedSeconds - 12;
    /** Alternating visits cross the full viewport in opposite directions. */
    const visit = Math.floor(visitElapsed / 30);
    /** The rest of each interval remains free of aliens. */
    const progress = (visitElapsed % 30) / 8;
    /** Extra space puts the entire saucer outside the viewport at both ends of a pass. */
    const flightExtent = halfHeight * camera.aspect + 12;
    for (const [index, {model, y, bank}] of aliens.entries()) {
      model.visible = visitElapsed >= 0 && progress < 1 && index === visit % aliens.length;
      if (!model.visible) continue;
      model.position.set(
        (progress * 2 - 1) * flightExtent * (visit % 2 === 0 ? 1 : -1),
        (y + Math.sin(progress * Math.PI * 2) * 0.025) * halfHeight,
        -distance,
      );
      model.rotation.z = bank + Math.sin(progress * Math.PI * 2) * 0.08;
    }
    for (const flight of flights) flight.animate(elapsedSeconds);
    stationOrbit.rotation.y = elapsedSeconds * 0.35;
  }

  return {
    animate,
    /** Anchors the ISS to Earth's solar orbit, independently of the planet's axial rotation. */
    orbitEarth({orbit, planet, radius}: {
      /** Parent frame that carries Earth around the Sun. */
      orbit: THREE.Group;
      /** Earth's position within its solar orbital frame. */
      planet: THREE.Mesh;
      /** Radius of the Earth model, used to keep the station above its atmosphere. */
      radius: number;
    }) {
      stationPlane.position.copy(planet.position);
      iss.position.x = radius * 1.6;
      orbit.add(stationPlane);
    },
  };
}
