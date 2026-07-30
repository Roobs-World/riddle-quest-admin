export const MAX_FRAME_DELTA_SECONDS = 0.1;

export const getFrameDeltaSeconds = (frameAt: number, previousFrameAt: number) =>
  Math.min(Math.max(0, (frameAt - previousFrameAt) / 1000), MAX_FRAME_DELTA_SECONDS);

export const advanceAngle = (angle: number, radiansPerSecond: number, deltaSeconds: number) =>
  angle + radiansPerSecond * deltaSeconds;
