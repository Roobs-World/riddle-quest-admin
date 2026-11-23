import {sampleSolarBody, solarPhysicsUnits, type SolarGravityBody} from "./solarGravity";

/** SpaceX Falcon User's Guide, table 2-1: Merlin Vacuum thrust in newtons. */
const VACUUM_THRUST = 981_000;
/** Illustrative mass and propellant flow, rather than SpaceX flight telemetry. */
const INITIAL_MASS = 75_000, MASS_FLOW = 300;
/** Sixty physical burn seconds are shown over three active animation seconds. */
const BURN_SECONDS = 3, BURN_TIME_SCALE = 20;
/** Fixed integration intervals keep motion independent of display refresh rate. */
const STEP_SECONDS = 1 / 120;
/** Active lifetime of one Earth departure before its launch interval retires. */
export const ROCKET_FLIGHT_SECONDS = 36;

/** Position, inertial velocity, and remaining mass in the shared solar frame. */
type FlightState = {
  /** Scene position after a single uniform spatial conversion. */
  x: number;
  /** Vertical position in the solar frame. */
  y: number;
  /** Depth position in the solar frame. */
  z: number;
  /** Inertial velocity includes Earth's orbital velocity at departure. */
  vx: number;
  /** Vertical inertial velocity. */
  vy: number;
  /** Depth inertial velocity. */
  vz: number;
  /** Vehicle and remaining propellant mass in kilograms. */
  mass: number;
};

/** An impacting rocket cannot retain a firing main engine. */
type FlightSample = FlightState & ({
  /** A live flight may be under thrust or coasting. */
  kind: "flying";
  /** Main-engine throttle, zero after cutoff. */
  throttle: number;
} | {
  /** Surface contact retires the rocket. */
  kind: "impact";
  /** An impact always extinguishes the main engine. */
  throttle: 0;
});

/** Integrates an Earth departure under the moving Sun and every displayed planet. */
export function createRocketFlight({bodies, launchAt, variant}: {
  /** Gravity sources in the same frame as the visible planet meshes. */
  bodies: readonly SolarGravityBody[];
  /** Active scene time of this departure, preserved through host pause. */
  launchAt: number;
  /** Alternates the departure plane without changing the force law. */
  variant: number;
}) {
  /** Every departure requires Earth; configuration cannot invent a floating launch origin. */
  const earth = bodies.find(body => body.name === "Earth");
  if (!earth) throw new Error("Rocket departures require Earth");
  /** The same conversion preserves the published gravitational-parameter ratios. */
  const units = solarPhysicsUnits(earth);
  /** Earth supplies both position and inherited orbital velocity at launch. */
  const origin = sampleSolarBody(earth, launchAt);
  /** A predominantly prograde departure has a small radial and vertical inclination. */
  const direction = {x: origin.vx + variant * origin.x * 0.35,
    y: Math.hypot(origin.vx, origin.vz) * 0.45, z: origin.vz + variant * origin.z * 0.35};
  /** Normalize the initial attitude independently of the camera. */
  const directionLength = Math.hypot(direction.x, direction.y, direction.z);
  direction.x /= directionLength; direction.y /= directionLength; direction.z /= directionLength;
  /** The vacuum upper stage starts just above Earth's exaggerated surface at a scaled 400 km altitude. */
  const launchRadius = earth.radius * (1 + 400_000 / 6_378_137);
  /** Hyperbolic injection is a visual initial condition, not a claim about a particular Falcon mission. */
  const injectionSpeed = Math.sqrt(2 * earth.gravitationalParameter / 6_778_137) * 1.4 * units.velocity;
  /** No camera or viewport translation is applied to the departure. */
  const initial: FlightState = {
    x: origin.x + direction.x * launchRadius, y: origin.y + direction.y * launchRadius,
    z: origin.z + direction.z * launchRadius,
    vx: origin.vx + direction.x * injectionSpeed, vy: origin.vy + direction.y * injectionSpeed,
    vz: origin.vz + direction.z * injectionSpeed, mass: INITIAL_MASS,
  };

  /** Sums inverse-square gravity and the departure engine's impulse. */
  function acceleration(state: FlightState, age: number, powered: boolean) {
    /** Burn playback has its own explicit compression; orbital force conversion remains uniform. */
    const thrust = powered ? VACUUM_THRUST * 0.8 / state.mass * BURN_TIME_SCALE * units.velocity /
      Math.hypot(state.vx, state.vy, state.vz) : 0;
    /** Start with engine thrust, then accumulate all planetary contributions. */
    let x = state.vx * thrust, y = state.vy * thrust, z = state.vz * thrust;
    for (const body of bodies) {
      /** Source motion permits changes in heliocentric velocity during a flyby. */
      const source = sampleSolarBody(body, launchAt + age);
      /** The acceleration vector always points toward its attracting body. */
      const dx = source.x - state.x, dy = source.y - state.y, dz = source.z - state.z;
      /** A uniform-sphere interior field keeps an impact step finite; exterior gravity is inverse-square. */
      const pull = body.gravitationalParameter * units.gravity /
        Math.max(dx * dx + dy * dy + dz * dz, body.radius ** 2) ** 1.5;
      x += dx * pull; y += dy * pull; z += dz * pull;
    }
    return {x, y, z};
  }

  /** Advances one fixed kick-drift-kick interval with midpoint propellant mass. */
  function advance(state: FlightState, tick: number): FlightState {
    /** Ignition and cutoff align with fixed interval boundaries. */
    const powered = (tick + 0.5) * STEP_SECONDS < BURN_SECONDS;
    /** Propellant consumption stops with the main engine. */
    const consumed = powered ? MASS_FLOW * 0.8 * BURN_TIME_SCALE * STEP_SECONDS : 0;
    /** First kick samples the current positions of the moving gravity sources. */
    const start = acceleration({...state, mass: state.mass - consumed / 2}, tick * STEP_SECONDS, powered);
    /** Drift with the half-step velocity. */
    const next = {
      x: state.x + (state.vx + start.x * STEP_SECONDS / 2) * STEP_SECONDS,
      y: state.y + (state.vy + start.y * STEP_SECONDS / 2) * STEP_SECONDS,
      z: state.z + (state.vz + start.z * STEP_SECONDS / 2) * STEP_SECONDS,
      vx: state.vx + start.x * STEP_SECONDS / 2, vy: state.vy + start.y * STEP_SECONDS / 2,
      vz: state.vz + start.z * STEP_SECONDS / 2, mass: state.mass - consumed / 2,
    };
    /** The second kick includes the planets' motion during the interval. */
    const end = acceleration(next, (tick + 1) * STEP_SECONDS, powered);
    return {...next, vx: next.vx + end.x * STEP_SECONDS / 2, vy: next.vy + end.y * STEP_SECONDS / 2,
      vz: next.vz + end.z * STEP_SECONDS / 2, mass: state.mass - consumed};
  }

  /** Keep only the current interval, so long sessions cannot accumulate trajectory history. */
  let tick = 0, from = initial, to = advance(initial, 0);
  /** A solid-surface collision retires this flight until the next Earth departure. */
  let impact: FlightState | null = null;

  return (seconds: number): FlightSample => {
    /** Backward seeks reconstruct the same fixed-step motion. */
    const time = Math.max(0, Math.min(seconds, ROCKET_FLIGHT_SECONDS));
    /** Requested integration interval, with continuous interpolation inside its endpoints. */
    const target = Math.floor(time / STEP_SECONDS);
    if (target < tick) {tick = 0; from = initial; to = advance(initial, 0); impact = null;}
    while (tick < target && !impact) {
      tick++; from = to;
      for (const body of bodies) {
        /** Surface intersections stop the flight instead of allowing travel through a planet. */
        const source = sampleSolarBody(body, launchAt + tick * STEP_SECONDS);
        if (Math.hypot(from.x - source.x, from.y - source.y, from.z - source.z) <= body.radius) {impact = from; break;}
      }
      to = impact ?? advance(from, tick);
    }
    if (impact) return {...impact, kind: "impact", throttle: 0};
    /** Hermite interpolation keeps position and its velocity continuous between fixed steps. */
    const t = (time - tick * STEP_SECONDS) / STEP_SECONDS;
    /** Position basis functions for the first endpoint. */
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t;
    /** Position basis functions for the second endpoint. */
    const h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    /** Derivatives of the same position basis drive the rocket's heading. */
    const d00 = (6 * t ** 2 - 6 * t) / STEP_SECONDS, d10 = 3 * t ** 2 - 4 * t + 1;
    /** Derivatives for the second endpoint. */
    const d01 = (-6 * t ** 2 + 6 * t) / STEP_SECONDS, d11 = 3 * t ** 2 - 2 * t;
    return {
      kind: "flying", throttle: time < BURN_SECONDS ? 0.8 : 0,
      x: h00 * from.x + h10 * STEP_SECONDS * from.vx + h01 * to.x + h11 * STEP_SECONDS * to.vx,
      y: h00 * from.y + h10 * STEP_SECONDS * from.vy + h01 * to.y + h11 * STEP_SECONDS * to.vy,
      z: h00 * from.z + h10 * STEP_SECONDS * from.vz + h01 * to.z + h11 * STEP_SECONDS * to.vz,
      vx: d00 * from.x + d10 * from.vx + d01 * to.x + d11 * to.vx,
      vy: d00 * from.y + d10 * from.vy + d01 * to.y + d11 * to.vy,
      vz: d00 * from.z + d10 * from.vz + d01 * to.z + d11 * to.vz,
      mass: from.mass + (to.mass - from.mass) * t,
    };
  };
}
