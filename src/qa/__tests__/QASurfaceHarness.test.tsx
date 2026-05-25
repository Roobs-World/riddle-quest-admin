import React, {useEffect, useState} from "react";
import {Linking, Text} from "react-native";
import {waitFor} from "@testing-library/react-native";
import {renderWithModalProvider} from "../../test-utils";
import {useModalContext} from "../../contexts/ModalContext";
import {QASurfaceGate} from "../QASurfaceHarness";

jest.mock("../../screens/LandingScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockLandingScreen() {
    return <Text>Landing QA Surface</Text>;
  };
});

jest.mock("../../screens/auth/LoginScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockLoginScreen() {
    return <Text>Login QA Surface</Text>;
  };
});

jest.mock("../../screens/auth/SignUpScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockSignUpScreen() {
    return <Text>Sign Up QA Surface</Text>;
  };
});

jest.mock("../../screens/auth/ForgotPasswordScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockForgotPasswordScreen() {
    return <Text>Forgot Password QA Surface</Text>;
  };
});

jest.mock("../../screens/auth/NewPasswordScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockNewPasswordScreen() {
    return <Text>New Password QA Surface</Text>;
  };
});

jest.mock("../../screens/game/GameScreen", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockGameScreen() {
    return <Text>Game QA Surface</Text>;
  };
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockPulsingSpinner() {
    return <Text>Loading QA Surface</Text>;
  };
});

jest.mock("../../components/background/StarryBackground", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockStarryBackground() {
    return <Text>Starry Background</Text>;
  };
});

jest.mock("../../components/modals/settings/DeleteAccountConfirmationModal", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockDeleteAccountConfirmationModal() {
    return <Text>Delete Account QA Surface</Text>;
  };
});

jest.mock("../../components/modals/system/OfflineBlockingModal", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockOfflineBlockingModal() {
    return <Text>Offline QA Surface</Text>;
  };
});

jest.mock("../../components/modals/ModalRegistry", () => ({
  getModalComponent: () => {
    const React = require("react");
    const {Text} = require("react-native");
    return function MockRegistryModal() {
      return <Text>Registry Modal QA Surface</Text>;
    };
  },
}));

jest.mock("../../components/development/ModalTogglePanel", () => ({
  generateMockData: () => ({}),
}));

const addEventListenerMock = jest.fn(() => ({remove: jest.fn()}));

const GateAfterExistingModal = () => {
  const modal = useModalContext();
  const [shouldRenderGate, setShouldRenderGate] = useState(false);

  useEffect(() => {
    modal.openModal("welcomeBack", {username: "Existing User"});
  }, [modal.openModal]);

  useEffect(() => {
    if (modal.modals.length > 0) {
      setShouldRenderGate(true);
    }
  }, [modal.modals.length]);

  return (
    <>
      <Text testID="modal-count">{modal.modals.length}</Text>
      {shouldRenderGate ? (
        <QASurfaceGate>
          <Text>Real app child</Text>
        </QASurfaceGate>
      ) : null}
    </>
  );
};

describe("QASurfaceGate", () => {
  beforeEach(() => {
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue("exp+riddle-quest://qa?surface=page-landing");
    jest.spyOn(Linking, "addEventListener").mockImplementation(addEventListenerMock as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    addEventListenerMock.mockClear();
  });

  it("clears existing modal overlays before rendering a linked QA surface", async () => {
    const screen = renderWithModalProvider(<GateAfterExistingModal />);

    await waitFor(() => {
      expect(screen.getByTestId("modal-count").props.children).toBe(0);
      expect(screen.getByText("qa-surface:page-landing")).toBeTruthy();
    });

    expect(screen.queryByText("Real app child")).toBeNull();
    expect(screen.getByText("Landing QA Surface")).toBeTruthy();
  });
});
