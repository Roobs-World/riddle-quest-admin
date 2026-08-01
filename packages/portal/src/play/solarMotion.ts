export const MAX_FRAME_DELTA_SECONDS = 0.1;
export const REFERENCE_FRAMES_PER_SECOND = 60;

export const getFrameDeltaSeconds = (frameAt: number, previousFrameAt: number) =>
  Math.min(Math.max(0, (frameAt - previousFrameAt) / 1000), MAX_FRAME_DELTA_SECONDS);

export const advanceAngle = (angle: number, radiansPerSecond: number, deltaSeconds: number) =>
  angle + radiansPerSecond * deltaSeconds;

export const advanceFrameBasedAngle = (angle: number, radiansPerFrame: number, deltaSeconds: number) =>
  advanceAngle(angle, radiansPerFrame * REFERENCE_FRAMES_PER_SECOND, deltaSeconds);
