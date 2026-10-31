import {sampleSolarBody, type SolarGravityBody} from "../solarGravity";
import {createRocketFlight} from "../solarRocketMotion";

/** A moving Earth uses the same orbital frame as the decorative scene. */
const earth: SolarGravityBody = {name: "Earth", gravitationalParameter: 3.98600435507e14,
  radius: 3.5, distance: 30, startAngle: Math.PI * 2 / 3, angularSpeed: 1.35, height: 30};
/** Solar gravity is the dominant force after an Earth departure. */
const sun: SolarGravityBody = {name: "Sun", gravitationalParameter: 1.32712440041279419e20,
  radius: 12, distance: 0, startAngle: 0, angularSpeed: 0, height: 30};
/** A moving outer planet supplies a separate perturbation. */
const jupiter: SolarGravityBody = {name: "Jupiter", gravitationalParameter: 1.267127641e17,
  radius: 10, distance: 70, startAngle: Math.PI * 1.2, angularSpeed: 0.36, height: 30};
/** Default fixture includes moving planets and the Sun. */
const bodies = [sun, earth, jupiter];

describe("Earth rocket departures", () => {
  it("starts every flight beside the Earth position at that launch time", () => {
    for (const launchAt of [0, 24, 48]) {
      /** Sample the actual launch state rather than a camera projection. */
      const flight = createRocketFlight({bodies, launchAt, variant: -1})(0);
      /** Earth has moved between departures. */
      const origin = sampleSolarBody(earth, launchAt);
      expect(Math.hypot(flight.x - origin.x, flight.y - origin.y, flight.z - origin.z))
        .toBeCloseTo(earth.radius * (1 + 400_000 / 6_378_137), 8);
      expect(flight.kind).toBe("flying");
      expect(flight.throttle).toBe(0.8);
    }
  });

  it("changes course under both solar and moving-planet gravity", () => {
    /** Compare identical departures while removing one external force source. */
    const full = createRocketFlight({bodies, launchAt: 0, variant: -1})(8);
    /** Earth's initial position and velocity remain unchanged in both comparisons. */
    const withoutSun = createRocketFlight({bodies: [earth, jupiter], launchAt: 0, variant: -1})(8);
    /** A separate outer planet must also affect the trajectory. */
    const withoutJupiter = createRocketFlight({bodies: [sun, earth], launchAt: 0, variant: -1})(8);
    expect(Math.hypot(full.x - withoutSun.x, full.y - withoutSun.y, full.z - withoutSun.z)).toBeGreaterThan(1);
    expect(Math.hypot(full.x - withoutJupiter.x, full.y - withoutJupiter.y, full.z - withoutJupiter.z)).toBeGreaterThan(0.0001);
  });

  it("uses propellant during the departure burn and coasts after cutoff", () => {
    /** Calls use the same sampler as the renderer. */
    const sample = createRocketFlight({bodies, launchAt: 0, variant: -1});
    expect(sample(1).throttle).toBe(0.8);
    expect(sample(1).mass).toBeCloseTo(70_200, 5);
    expect(sample(3).throttle).toBe(0);
    expect(sample(3).mass).toBeCloseTo(60_600, 5);
    expect(sample(8).mass).toBeCloseTo(60_600, 5);
    expect(sample(8).x).not.toBe(sample(3).x);
  });

  it("reconstructs the same trajectory when seeking or sampling at another render rate", () => {
    /** Frequent queries must not introduce variable frame integration. */
    const frequent = createRocketFlight({bodies, launchAt: 24, variant: 1});
    /** A single seek runs exactly the same fixed integration steps. */
    const direct = createRocketFlight({bodies, launchAt: 24, variant: 1});
    for (let frame = 0; frame <= 120; frame++) frequent(frame / 60);
    expect(frequent(2)).toEqual(direct(2));
    frequent(8);
    expect(frequent(2)).toEqual(direct(2));
  });
});
