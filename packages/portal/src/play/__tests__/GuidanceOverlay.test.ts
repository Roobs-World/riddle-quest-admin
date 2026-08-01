import {describe, expect, it} from "@jest/globals";
import {getOnboardingTotalSteps} from "../GuidanceOverlay";

describe("onboarding progress", () => {
  it("keeps the guest registration page in a three-step flow after registration state refreshes", () => {
    expect(getOnboardingTotalSteps(2, true)).toBe(3);
  });

  it("uses two steps for an already registered player's initial flow", () => {
    expect(getOnboardingTotalSteps(0, true)).toBe(2);
    expect(getOnboardingTotalSteps(1, true)).toBe(2);
  });

  it("uses three steps throughout a guest player's initial flow", () => {
    expect(getOnboardingTotalSteps(0, false)).toBe(3);
    expect(getOnboardingTotalSteps(1, false)).toBe(3);
    expect(getOnboardingTotalSteps(2, false)).toBe(3);
  });
});
