export const MAX_FRAME_DELTA_SECONDS = 0.1;
export const REFERENCE_FRAMES_PER_SECOND = 60;
export const SOLAR_ORBIT_SPEED_SCALE = 1.5;
export const SOLAR_ROTATION_SPEED_SCALE = 1.5;
export const SHOOTING_STAR_CYCLE_SECONDS = 24;
export const SHOOTING_STAR_DURATION_SECONDS = 1.15;

export type CoronaAnimationState = {
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  limbGlowStrength: number;
};

export const getFrameDeltaSeconds = (frameAt: number, previousFrameAt: number) =>
  Math.min(Math.max(0, (frameAt - previousFrameAt) / 1000), MAX_FRAME_DELTA_SECONDS);

export const advanceAngle = (angle: number, radiansPerSecond: number, deltaSeconds: number) =>
  angle + radiansPerSecond * deltaSeconds;

export const advanceFrameBasedAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceAngle(angle, radiansPerFrame * REFERENCE_FRAMES_PER_SECOND, deltaSeconds);

export const advanceSolarOrbitAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceFrameBasedAngle(angle, radiansPerFrame * SOLAR_ORBIT_SPEED_SCALE, deltaSeconds);

export const advanceSolarRotationAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceFrameBasedAngle(angle, radiansPerFrame * SOLAR_ROTATION_SPEED_SCALE, deltaSeconds);

export const getCoronaAnimationState = (elapsedSeconds: number): CoronaAnimationState => ({
  scaleX: 80 + Math.sin(elapsedSeconds * 0.9) * 3.2,
  scaleY: 80 + Math.cos(elapsedSeconds * 0.73) * 2.6,
  rotation: elapsedSeconds * 0.12,
  opacity: 0.86 + Math.sin(elapsedSeconds * 0.64) * 0.09,
  limbGlowStrength: 0.78 + Math.sin(elapsedSeconds * 0.82) * 0.12,
});

export const getShootingStarProgress = (
  elapsedSeconds: number,
  phaseOffsetSeconds: number,
): number | null => {
  const phase = ((elapsedSeconds + phaseOffsetSeconds) % SHOOTING_STAR_CYCLE_SECONDS +
    SHOOTING_STAR_CYCLE_SECONDS) % SHOOTING_STAR_CYCLE_SECONDS;
  return phase <= SHOOTING_STAR_DURATION_SECONDS ? phase / SHOOTING_STAR_DURATION_SECONDS : null;
};
