import {expect, it} from "@jest/globals";
import {getOnboardingTotalSteps} from "../GuidanceOverlay";

it("keeps shared onboarding to welcome and instructions", () => {
  expect(getOnboardingTotalSteps()).toBe(2);
});
