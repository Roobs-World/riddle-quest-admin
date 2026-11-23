import {expect, it} from "@jest/globals";
import {getOnboardingTotalSteps} from "../GuidanceOverlay";

it("ends onboarding after welcome and instructions without requesting signup", () => {
  expect(getOnboardingTotalSteps()).toBe(2);
});
