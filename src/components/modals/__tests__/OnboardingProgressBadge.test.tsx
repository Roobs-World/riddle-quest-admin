import React from "react";
import {render} from "@testing-library/react-native";
import OnboardingProgressBadge from "../OnboardingProgressBadge";

describe("OnboardingProgressBadge", () => {
  it("renders the current step, total, and accessibility label", () => {
    const {getByLabelText, getByTestId, getByText} = render(<OnboardingProgressBadge current={2} total={3} />);

    expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
    expect(getByText("2/3")).toBeTruthy();
    expect(getByLabelText("Onboarding step 2 of 3")).toBeTruthy();
  });

  it.each([
    {current: 0, total: 3},
    {current: 4, total: 3},
    {current: 1, total: 0},
  ])("renders nothing for invalid progress %#", (props) => {
    const {queryByTestId} = render(<OnboardingProgressBadge {...props} />);

    expect(queryByTestId("onboarding-progress-badge")).toBeNull();
  });
});
