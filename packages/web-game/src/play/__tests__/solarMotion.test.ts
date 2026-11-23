import {
  advanceFrameBasedAngle,
  advanceSolarOrbitAngle,
  advanceSolarRotationAngle,
  getCoronaAnimationState,
  getFrameDeltaSeconds,
  getShootingStarProgress,
  MAX_FRAME_DELTA_SECONDS,
  REFERENCE_FRAMES_PER_SECOND,
  SOLAR_ORBIT_SPEED_SCALE,
  SOLAR_ROTATION_SPEED_SCALE,
  SHOOTING_STAR_DURATION_SECONDS,
} from "../solarMotion";

describe("solar-system motion", () => {
  it("advances by elapsed time rather than rendered frame count", () => {
    /** Provides speed behavior. */
    const speed = 0.02;
    /** Provides at60 hz behavior. */
    const at60Hz = Array.from({length: 60}).reduce<number>((angle) => advanceFrameBasedAngle(angle, speed, 1 / 60), 0);
    /** Provides at120 hz behavior. */
    const at120Hz = Array.from({length: 120}).reduce<number>(
      (angle) => advanceFrameBasedAngle(angle, speed, 1 / 120),
      0,
    );

    expect(at60Hz).toBeCloseTo(speed * REFERENCE_FRAMES_PER_SECOND);
    expect(at120Hz).toBeCloseTo(speed * REFERENCE_FRAMES_PER_SECOND);
  });

  it("caps long frame gaps so returning from the background cannot jump an orbit", () => {
    expect(getFrameDeltaSeconds(2_000, 1_000)).toBe(MAX_FRAME_DELTA_SECONDS);
    expect(getFrameDeltaSeconds(900, 1_000)).toBe(0);
  });

  it("keeps decorative movement clearly visible without depending on refresh rate", () => {
    /** Provides speed behavior. */
    const speed = 0.004;

    expect(advanceSolarOrbitAngle(0, speed, 1)).toBeCloseTo(
      speed * REFERENCE_FRAMES_PER_SECOND * SOLAR_ORBIT_SPEED_SCALE,
    );
    expect(advanceSolarRotationAngle(0, speed, 1)).toBeCloseTo(
      speed * REFERENCE_FRAMES_PER_SECOND * SOLAR_ROTATION_SPEED_SCALE,
    );
  });

  it("gives the corona visible rotation, scale, opacity, and limb-glow movement", () => {
    /** Provides initial behavior. */
    const initial = getCoronaAnimationState(0);
    /** Provides later behavior. */
    const later = getCoronaAnimationState(2);

    expect(later.rotation - initial.rotation).toBeCloseTo(0.24);
    expect(Math.abs(later.scaleX - initial.scaleX)).toBeGreaterThan(3);
    expect(Math.abs(later.scaleY - initial.scaleY)).toBeGreaterThan(2);
    expect(Math.abs(later.opacity - initial.opacity)).toBeGreaterThan(0.08);
    expect(Math.abs(later.limbGlowStrength - initial.limbGlowStrength)).toBeGreaterThan(0.11);
  });

  it("stages shooting stars with a visible flight followed by an idle interval", () => {
    expect(getShootingStarProgress(0, 0)).toBe(0);
    expect(getShootingStarProgress(SHOOTING_STAR_DURATION_SECONDS / 2, 0)).toBeCloseTo(0.5);
    expect(getShootingStarProgress(SHOOTING_STAR_DURATION_SECONDS + 0.01, 0)).toBeNull();
    expect(getShootingStarProgress(0, 2.35)).toBeNull();
  });
});
