import {
  advanceFrameBasedAngle,
  getFrameDeltaSeconds,
  MAX_FRAME_DELTA_SECONDS,
  REFERENCE_FRAMES_PER_SECOND,
} from "../solarMotion";

describe("solar-system motion", () => {
  it("advances by elapsed time rather than rendered frame count", () => {
    const speed = 0.02;
    const at60Hz = Array.from({length: 60}).reduce<number>(
      (angle) => advanceFrameBasedAngle(angle, speed, 1 / 60),
      0,
    );
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
});
