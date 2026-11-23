/** Defines the max frame delta seconds value. */
export const MAX_FRAME_DELTA_SECONDS = 0.1;
/** Defines the reference frames per second value. */
export const REFERENCE_FRAMES_PER_SECOND = 60;
/** Defines the solar orbit speed scale value. */
export const SOLAR_ORBIT_SPEED_SCALE = 1.5;
/** Defines the solar rotation speed scale value. */
export const SOLAR_ROTATION_SPEED_SCALE = 1.5;
/** Defines the shooting star cycle seconds value. */
export const SHOOTING_STAR_CYCLE_SECONDS = 24;
/** Defines the shooting star duration seconds value. */
export const SHOOTING_STAR_DURATION_SECONDS = 1.15;

/** Describes corona animation state. */
export type CoronaAnimationState = {
  /** Stores scale x. */
  scaleX: number;
  /** Stores scale y. */
  scaleY: number;
  /** Stores rotation. */
  rotation: number;
  /** Stores opacity. */
  opacity: number;
  /** Stores limb glow strength. */
  limbGlowStrength: number;
};

/** Gets frame delta seconds. */
export const getFrameDeltaSeconds = (frameAt: number, previousFrameAt: number) =>
  Math.min(Math.max(0, (frameAt - previousFrameAt) / 1000), MAX_FRAME_DELTA_SECONDS);

/** Provides advance angle behavior. */
export const advanceAngle = (angle: number, radiansPerSecond: number, deltaSeconds: number) =>
  angle + radiansPerSecond * deltaSeconds;

/** Provides advance frame based angle behavior. */
export const advanceFrameBasedAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceAngle(angle, radiansPerFrame * REFERENCE_FRAMES_PER_SECOND, deltaSeconds);

/** Provides advance solar orbit angle behavior. */
export const advanceSolarOrbitAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceFrameBasedAngle(angle, radiansPerFrame * SOLAR_ORBIT_SPEED_SCALE, deltaSeconds);

/** Provides advance solar rotation angle behavior. */
export const advanceSolarRotationAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceFrameBasedAngle(angle, radiansPerFrame * SOLAR_ROTATION_SPEED_SCALE, deltaSeconds);

/** Gets corona animation state. */
export const getCoronaAnimationState = (elapsedSeconds: number): CoronaAnimationState => ({
  scaleX: 80 + Math.sin(elapsedSeconds * 0.9) * 3.2,
  scaleY: 80 + Math.cos(elapsedSeconds * 0.73) * 2.6,
  rotation: elapsedSeconds * 0.12,
  opacity: 0.86 + Math.sin(elapsedSeconds * 0.64) * 0.09,
  limbGlowStrength: 0.78 + Math.sin(elapsedSeconds * 0.82) * 0.12,
});

/** Gets shooting star progress. */
export const getShootingStarProgress = (elapsedSeconds: number, phaseOffsetSeconds: number): number | null => {
  /** Provides phase behavior. */
  const phase =
    (((elapsedSeconds + phaseOffsetSeconds) % SHOOTING_STAR_CYCLE_SECONDS) + SHOOTING_STAR_CYCLE_SECONDS) %
    SHOOTING_STAR_CYCLE_SECONDS;
  return phase <= SHOOTING_STAR_DURATION_SECONDS ? phase / SHOOTING_STAR_DURATION_SECONDS : null;
};
