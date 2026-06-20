import React from "react";
import {render} from "@testing-library/react-native";
import OnboardingProgressBadge from "../OnboardingProgressBadge";

describe("OnboardingProgressBadge", () => {
  it("renders circle-only onboarding progress with an accessibility label", () => {
    const {getByLabelText, getByTestId, queryByText} = render(<OnboardingProgressBadge current={2} total={3} />);

    expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
    expect(queryByText("2/3")).toBeNull();
    expect(getByLabelText("Onboarding step 2 of 3")).toBeTruthy();
    expect(getByTestId("onboarding-progress-badge").props.style).toMatchObject({
      alignItems: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: expect.any(Number),
      zIndex: 20,
    });
    expect(getByTestId("onboarding-progress-badge").props.style.top).toBeLessThan(24);

    const previousCircle = getByTestId("onboarding-progress-breadcrumb-dot-1").props.style;
    const currentCircle = getByTestId("onboarding-progress-breadcrumb-dot-2").props.style;
    const futureCircle = getByTestId("onboarding-progress-breadcrumb-dot-3").props.style;

    expect(currentCircle.width).toBeGreaterThan(previousCircle.width);
    expect(currentCircle.height).toBeGreaterThan(futureCircle.height);
    expect(currentCircle.backgroundColor).toBe("#111111");
    expect(previousCircle.backgroundColor).toBe("#D1D5DB");
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
