import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import ModalProvider from "../ModalProvider";

jest.mock("../../../contexts/ModalContext", () => ({
  useModalContext: jest.fn(),
}));

jest.mock("../ModalRegistry", () => ({
  getModalComponent: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const {useModalContext} = require("../../../contexts/ModalContext");
const {getModalComponent} = require("../ModalRegistry");
const {logger} = require("../../../utils/logger");

describe("ModalProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders mapped modals and wires close callback", () => {
    const closeModal = jest.fn();
    const modalComponentMock = jest.fn((props: any) => {
      const React = require("react");
      const {TouchableOpacity} = require("react-native");
      return React.createElement(TouchableOpacity, {
        testID: `modal-${props.title}`,
        onPress: props.onClose,
      });
    });

    useModalContext.mockReturnValue({
      modals: [
        {id: "1", type: "info", data: {title: "A"}},
        {id: "2", type: "victory", data: {title: "B"}},
      ],
      closeModal,
    });

    getModalComponent.mockImplementation((type: string) =>
      type === "info" || type === "victory" ? modalComponentMock : null,
    );

    const {getByTestId} = render(<ModalProvider />);

    fireEvent.press(getByTestId("modal-A"));
    expect(closeModal).toHaveBeenCalledWith("1");
    expect(modalComponentMock).toHaveBeenCalledTimes(2);
    expect(modalComponentMock.mock.calls[0][0]).toMatchObject({
      isVisible: true,
      title: "A",
    });
  });

  it("skips unknown modal types and logs warning", () => {
    useModalContext.mockReturnValue({
      modals: [{id: "unknown-id", type: "unknownType", data: {}}],
      closeModal: jest.fn(),
    });
    getModalComponent.mockReturnValue(null);

    const {toJSON} = render(<ModalProvider />);

    expect(toJSON()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('Skipping unknown modal type "unknownType"');
  });
});
