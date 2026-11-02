# Rocket flight motion sources

Research date: 17 October 2026. Scope: decorative rocket flybys in `packages/portal/src/play/solarSpacecraft.ts`. The recommended animation uses published physics and engine data. Its initial conditions and presentation remain illustrative.

## Current Earth departure implementation

Every rocket now begins beside the moving Earth. The nozzle starts at an illustrative 400 km altitude, mapped to Earth's exaggerated visible radius. The rocket inherits Earth's inertial orbital velocity. Later launches use Earth's position at their own departure time. Rockets are scene objects, so camera aspect ratio cannot move their origin to a screen edge.

The force calculation sums `GM * (bodyPosition - rocketPosition) / distance^3` for the Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, and Uranus. Source positions use the same circular orbital phase, angular speed, height, and active clock as the displayed planets. Published gravitational parameters come from [NASA/JPL's DE440 parameter table](https://ssd.jpl.nasa.gov/astro_par.html). Moving sources allow the direction and solar-frame speed changes described in [NASA's gravity-assist primer](https://science.nasa.gov/learn/basics-of-space-flight/primer/).

The simulation applies one uniform conversion to every gravitational parameter. One AU maps to the displayed Earth/Sun separation, and the displayed Earth angular speed defines orbital time compression. This preserves GM ratios and inverse-square attraction. Planet distances, radii, orbital periods, and launch injection speed remain illustrative. The model uses prescribed planet paths and neglects the rocket's negligible back-reaction on the planets. It is not a real ephemeris, SpaceX flight reconstruction, or mission-planning tool.

An illustrative prograde upper-stage burn uses the [SpaceX Falcon User's Guide](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf), table 2-1, for MVac's 981 kN thrust and permitted throttle range. The displayed burn uses 80% throttle, lasts three animation seconds, and represents sixty engine seconds. The assumed initial mass is 75,000 kg and full-throttle flow is 300 kg/s. Burn playback compression is separate from orbital playback compression, so this remains a visual approximation. Coast keeps gravity active, consumes no propellant, and extinguishes the plume. Velocity-aligned attitude represents idealized attitude control.

Integration uses fixed 1/120 animation-second kick-drift-kick steps with continuous Hermite sampling. Only the current interval is retained. Impact with a visible solid surface retires that flight. Pause and document visibility stop the shared active clock, so neither rockets nor gravity sources advance while the game is suspended.

The earlier Earth-only, screen-fitted segment described below is historical design context; it no longer places the displayed rockets.

## Published evidence

NASA Glenn gives rocket thrust as `T = q ve + Ae(pe - p0)`, where `q` is expelled propellant mass per second. Thrust works in a vacuum because the rocket carries its oxidizer. [NASA, Rocket thrust equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/).

NASA Technical Reports Server paper M15-4768 gives `deltaV = ve ln(mi / mf)` and `ve = Isp g0` in equation 1, printed page 2, PDF page 2. Propellant consumption therefore changes the mass used in the acceleration calculation. This is an ideal equation, with external forces omitted. [Kibbey, Rho-Isp revisited and basic stage mass estimating for launch vehicle conceptual sizing studies, 2015](https://ntrs.nasa.gov/api/citations/20150016561/downloads/20150016561.pdf#page=2).

NASA's mechanics reference describes uniform straight motion when no force acts, inverse-square gravity, and velocity changes in the direction of the applied force. Engine cutoff removes thrust, but gravity still affects an orbital trajectory. [NASA, Basics of space flight, chapter 3](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/).

NASA's Earth Fact Sheet reports these constants. Its last stated update is 15 November 2024. [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).

| Quantity | Published value | SI value for a simplified model |
| --- | --- | --- |
| Earth's gravitational parameter, `mu` | `0.39860 × 10^6 km^3/s^2` | `3.9860 × 10^14 m^3/s^2` |
| Volumetric mean radius | `6371.000 km` | `6371000 m` |
| Equatorial radius | `6378.137 km` | `6378137 m` |
| Standard gravity, `g0` | `9.80665 m/s^2` | Same |

SpaceX's 9 May 2025 guide supplies these data. Locations list printed and PDF pages. [SpaceX Falcon User's Guide](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf).

| Guide location | Published information |
| --- | --- |
| Table 2-1, pp. 9 / 20 | MVac vacuum thrust `981 kN`; throttle `220500` to `140679 lbf`; restart capability; nitrogen thrusters for coast attitude control. |
| Section 3.4, pp. 13 / 24 | Coast pointing control; longitudinal thermal roll up to `±1.5 degrees/s`, which is not a pitch or yaw limit. |
| Table 10-3, pp. 85 / 96 | Sample GTO engine events at mission seconds `158`, `484`, `1636`, `1696`: `326 s` burn, `1152 s` coast, `60 s` burn. |

The mission profiles are examples. Table 2-1 omits MVac specific impulse. Payload load envelopes describe structural limits. The minimum-to-maximum throttle ratio is approximately `0.638`.

NASA's published GOES-U mission schedule gives another burn/coast example: second-stage burns at `00:04:06–00:08:23`, `00:26:19–00:27:46`, and `04:21:18–04:21:51`. These are approximate planned times, not a sampled flight telemetry dataset. [NASA, GOES-U mission milestones, 25 June 2024](https://science.nasa.gov/blogs/goes/2024/06/25/key-countdown-ascent-landing-milestones-for-todays-goes-u-mission/).

## Recommended model

The following is an engineering recommendation based on those sources, not a SpaceX trajectory reconstruction.

Use a planar vacuum trajectory in metres and seconds, separate from the decorative scene's planet sizes. For position `r` measured from Earth's centre, velocity `v`, total mass `m`, commanded thrust direction `d`, and throttle `u`, integrate:

```text
dr/dt = v
dv/dt = -mu r / |r|^3 + (u T / m) d
dm/dt = -u q
```

`d` has unit length. Set `u = 0` during coast. During a burn, choose a throttle within the published range when using the MVac thrust reference. Keep the full thrust value at `981000 N`. If an illustrative mass flow `q` is chosen instead of a sourced `Isp`, describe it as an assumption. Its implied effective exhaust speed is `T / q`. NASA Glenn's approximately `350 s` specific-impulse example concerns hydrogen and oxygen, so it must not become an attributed MVac value. [NASA, Ideal rocket equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/).

A short prograde burn followed by a longer coast gives the intended visible behavior. Thrust changes velocity while propellant mass falls. Cutoff preserves velocity, gravity produces a gradual orbital curve, and the main plume disappears. A maintained prograde coast attitude represents active attitude control. It must not imply that the main engine turns the vehicle continuously. A fixed inertial coast attitude is another valid simplification.

Initial altitude, total mass, dry-mass floor, mass flow, burn timing, displayed duration, camera motion, and apparent size are visual assumptions unless separately sourced. Fit the simulated segment to the viewport with one uniform spatial scale and a rigid rotation. Separate horizontal and vertical scales distort its physical curve. Time compression is a presentation choice, not a change to the equations.

Sample a deterministic trajectory with a fixed integration step and interpolate for rendering. End steps exactly at burn boundaries. Reuse the existing scene clock for pause and visibility behavior. Repeat only after the rocket has left the viewport.

## Verification implications

Meaningful checks cover continuous position and velocity at cutoff, constant coast mass, no main plume during coast, positive mass, finite samples, and equivalent results at different render rates. A separate zero-thrust orbit can check conservation of orbital energy and angular momentum within numerical tolerance. Browser checks must confirm quiet flybys on both narrow and wide viewports. All six Web Target builds remain required.

## Implemented animation

`solarRocketMotion.ts` integrates Earth gravity and prograde thrust in SI units. It uses the fact sheet's `mu` and equatorial radius, plus the guide's `981000 N` MVac thrust. The following inputs are illustrative, not Falcon telemetry:

| Input | Animation value |
| --- | --- |
| Initial circular orbit altitude | 400 km |
| Initial vehicle mass | 75000 kg |
| Full-throttle propellant flow | 300 kg/s |
| Burn | Simulation seconds 60 through 120, at 80% throttle |
| Simulated segment | 480 seconds |
| Display duration | 24 or 28 seconds, followed by an 8-second gap |

The chosen flow implies an effective exhaust velocity of `3270 m/s`. It is an assumption, not an attributed MVac specification. This burn consumes `14400 kg`, leaving `60600 kg`; the model does not run long enough to exhaust its assumed propellant reserve. It omits atmosphere, Earth's oblateness, other bodies, staging, and ignition transients. No real mission trajectory or timing is reproduced.

A fixed 0.5-second integration step and Hermite interpolation preserve continuous displayed position and velocity. One isotropic scale and rigid rotation map each segment to the screen. The physical path is independent of the decorative planets' positions and scale. Prograde attitude tracking represents coast attitude control. The main plume appears only during the burn and remains attached to the nozzle. Each rocket repeats after leaving the viewport, with its previous half-size model retained.

Run the unit checks with `pnpm --filter @riddle-quest/portal exec jest --config jest.config.cjs --runInBand --runTestsByPath src/play/__tests__/solarRocketMotion.test.ts src/play/__tests__/solarMotion.test.ts`. Run the injected native-renderer checks with `pnpm --filter @riddle-quest/portal exec node scripts/verify-rocket-flight-browser.mjs`, and repeat with `ROCKET_REACT_MODE=development`. Browser observations and screenshots go under `artifacts/rocket-flight-2026-10-17/`.
