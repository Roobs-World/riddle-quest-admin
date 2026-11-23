import type {PlanetConfig} from "./solarConfig";
import {REFERENCE_FRAMES_PER_SECOND, SOLAR_ORBIT_SPEED_SCALE} from "./solarMotion";

/** JPL DE440 gravitational parameters in cubic metres per square second. */
const PLANET_PARAMETERS = new Map([
  ["Mercury", 2.2031868551e13], ["Venus", 3.24858592e14], ["Earth", 3.98600435507e14],
  ["Mars", 4.2828375816e13], ["Jupiter", 1.267127641e17], ["Saturn", 3.79405848418e16],
  ["Uranus", 5.7945564e15],
]);
/** JPL's solar GM in the same SI units as the planets. */
export const SOLAR_GRAVITATIONAL_PARAMETER = 1.32712440041279419e20;
/** IAU astronomical unit in metres, as published by JPL. */
const ASTRONOMICAL_UNIT = 149_597_870_700;

/** A moving source of gravity in the displayed solar system. */
export type SolarGravityBody = {
  /** Matches the corresponding visible body. */
  name: string;
  /** Published SI gravitational parameter, before the shared unit conversion. */
  gravitationalParameter: number;
  /** Visible solid surface used for impact detection. */
  radius: number;
  /** Displayed heliocentric orbital radius. */
  distance: number;
  /** Initial angle in the scene's x/z plane. */
  startAngle: number;
  /** Clockwise angular velocity matching the rendered orbit. */
  angularSpeed: number;
  /** Height of the body's orbital plane. */
  height: number;
};

/** Builds gravity sources without changing the planet artwork or introducing provider dependencies. */
export function createSolarGravityBodies(planets: readonly PlanetConfig[]): readonly SolarGravityBody[] {
  return [
    {name: "Sun", gravitationalParameter: SOLAR_GRAVITATIONAL_PARAMETER, radius: 12,
      distance: 0, startAngle: 0, angularSpeed: 0, height: 30},
    ...planets.map(planet => {
      /** A missing constant is a configuration error, rather than a silently gravity-free planet. */
      const gravitationalParameter = PLANET_PARAMETERS.get(planet.name);
      if (gravitationalParameter === undefined) throw new Error(`Missing gravity parameter for ${planet.name}`);
      return {name: planet.name, gravitationalParameter, radius: planet.size, distance: planet.distance,
        startAngle: planet.startAngle, height: planet.yPosition,
        angularSpeed: planet.orbitSpeed * REFERENCE_FRAMES_PER_SECOND * SOLAR_ORBIT_SPEED_SCALE};
    }),
  ];
}

/** Samples the visible body's position and inherited inertial velocity at active scene time. */
export function sampleSolarBody(body: SolarGravityBody, seconds: number) {
  /** Positive rotation about Three's y axis decreases the x/z polar angle. */
  const angle = body.startAngle - body.angularSpeed * seconds;
  return {
    x: Math.cos(angle) * body.distance, y: body.height, z: Math.sin(angle) * body.distance,
    vx: Math.sin(angle) * body.distance * body.angularSpeed, vy: 0,
    vz: -Math.cos(angle) * body.distance * body.angularSpeed,
  };
}

/** Calibrates one uniform force conversion to Earth's displayed orbit, rather than a real ephemeris. */
export function solarPhysicsUnits(earth: SolarGravityBody) {
  /** One AU spans the displayed Earth/Sun separation. */
  const metresPerUnit = ASTRONOMICAL_UNIT / earth.distance;
  /** Earth's displayed angular speed defines orbital playback compression. */
  const secondsPerSecond = earth.angularSpeed * Math.sqrt(ASTRONOMICAL_UNIT ** 3 / SOLAR_GRAVITATIONAL_PARAMETER);
  return {gravity: secondsPerSecond ** 2 / metresPerUnit ** 3, velocity: secondsPerSecond / metresPerUnit};
}
