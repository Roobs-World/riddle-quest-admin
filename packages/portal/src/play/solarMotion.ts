export const MAX_FRAME_DELTA_SECONDS = 0.1;
export const REFERENCE_FRAMES_PER_SECOND = 60;
export const SOLAR_ORBIT_SPEED_SCALE = 3;
export const SOLAR_ROTATION_SPEED_SCALE = 1.5;
export const SHOOTING_STAR_CYCLE_SECONDS = 7;
export const SHOOTING_STAR_DURATION_SECONDS = 1.35;

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

export const getShootingStarProgress = (
  elapsedSeconds: number,
  phaseOffsetSeconds: number,
): number | null => {
  const phase = ((elapsedSeconds + phaseOffsetSeconds) % SHOOTING_STAR_CYCLE_SECONDS +
    SHOOTING_STAR_CYCLE_SECONDS) % SHOOTING_STAR_CYCLE_SECONDS;
  return phase <= SHOOTING_STAR_DURATION_SECONDS ? phase / SHOOTING_STAR_DURATION_SECONDS : null;
};
