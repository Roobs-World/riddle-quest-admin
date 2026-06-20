import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import ModalSequenceBreadcrumb from "../../ModalSequenceBreadcrumb";

describe("ModalSequenceBreadcrumb", () => {
  it("stays hidden without sequence progress or with a single popup", () => {
    const withoutProgress = render(<ModalSequenceBreadcrumb />);
    expect(withoutProgress.queryByTestId("modal-sequence-breadcrumb")).toBeNull();

    const singlePopup = render(
      <ModalSequenceBreadcrumb
        sequenceProgress={{
          currentPopupIndex: 1,
          totalPopups: 1,
          hasNextPopup: false,
        }}
      />,
    );
    expect(singlePopup.queryByTestId("modal-sequence-breadcrumb")).toBeNull();
  });

  it("renders centered circles only for the sequence progress", () => {
    const {getByTestId, queryByTestId, queryByText} = render(
      <ModalSequenceBreadcrumb
        sequenceProgress={{
          currentPopupIndex: 2,
          totalPopups: 4,
          hasNextPopup: true,
        }}
      />,
    );

    const breadcrumb = getByTestId("modal-sequence-breadcrumb");

    expect(breadcrumb.props.accessibilityLabel).toBe("Popup 2 of 4");
    expect(queryByText("2/4")).toBeNull();
    expect(breadcrumb.props.style).toMatchObject({
      alignItems: "center",
      left: 0,
      position: "absolute",
      right: 0,
      zIndex: 20,
    });

    for (let step = 1; step <= 4; step += 1) {
      expect(getByTestId(`modal-sequence-breadcrumb-dot-${step}`)).toBeTruthy();
    }
    expect(queryByTestId("modal-sequence-breadcrumb-dot-5")).toBeNull();
  });

  it("makes the current circle larger than the surrounding circles", () => {
    const {getByTestId} = render(
      <ModalSequenceBreadcrumb
        sequenceProgress={{
          currentPopupIndex: 3,
          totalPopups: 5,
          hasNextPopup: true,
        }}
      />,
    );

    const previousCircle = getByTestId("modal-sequence-breadcrumb-dot-2").props.style;
    const currentCircle = getByTestId("modal-sequence-breadcrumb-dot-3").props.style;
    const futureCircle = getByTestId("modal-sequence-breadcrumb-dot-4").props.style;

    expect(previousCircle).toMatchObject({
      backgroundColor: "#D1D5DB",
    });
    expect(currentCircle).toMatchObject({
      backgroundColor: "#111111",
    });
    expect(futureCircle).toMatchObject({
      backgroundColor: "#D1D5DB",
    });

    expect(currentCircle.width).toBeGreaterThan(previousCircle.width);
    expect(currentCircle.height).toBeGreaterThan(futureCircle.height);
    expect(currentCircle.borderRadius).toBe(currentCircle.width / 2);
    expect(previousCircle.borderRadius).toBe(previousCircle.width / 2);
  });

  it("allows jumping back to previous popups", () => {
    const onSelectPopup = jest.fn();

    const {getByTestId} = render(
      <ModalSequenceBreadcrumb
        sequenceProgress={{
          currentPopupIndex: 4,
          totalPopups: 5,
          hasNextPopup: true,
          onSelectPopup,
        }}
      />,
    );

    fireEvent.press(getByTestId("modal-sequence-breadcrumb-dot-2"));

    expect(onSelectPopup).toHaveBeenCalledTimes(1);
    expect(onSelectPopup).toHaveBeenCalledWith(2);
    expect(getByTestId("modal-sequence-breadcrumb-dot-4").props.onPress).toBeUndefined();
    expect(getByTestId("modal-sequence-breadcrumb-dot-5").props.onPress).toBeUndefined();
  });
});
