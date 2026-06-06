import React, { useEffect, useState } from "react";
import { Linking, Text } from "react-native";
import { waitFor } from "@testing-library/react-native";
import { renderWithModalProvider } from "../../test-utils";
import { useModalContext } from "../../contexts/ModalContext";
import QASurfaceHarness, { QASurfaceGate, QA_SURFACE_RENDERERS } from "../QASurfaceHarness";
import { QA_SURFACE_IDS, type QASurfaceId } from "../qaSurfaces";

jest.mock("../../screens/LandingScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockLandingScreen() {
    return <Text>Landing QA Surface</Text>;
  };
});

jest.mock("../../screens/game/GameScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockGameScreen() {
    return <Text>Game QA Surface</Text>;
  };
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockPulsingSpinner() {
    return <Text>Loading QA Surface</Text>;
  };
});

jest.mock("../../components/background/StarryBackground", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockStarryBackground() {
    return <Text>Starry Background</Text>;
  };
});

jest.mock("../../components/overlays/GlobalMuteOverlay", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockGlobalMuteOverlay() {
    return <Text>Global Mute QA Surface</Text>;
  };
});

jest.mock("../../components/tooltips/TooltipOverlay", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockTooltipOverlay({ content }: { content: { title: string } }) {
    return <Text>{content.title}</Text>;
  };
});

jest.mock("../../components/modals/settings/DeleteAccountConfirmationModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockDeleteAccountConfirmationModal() {
    return <Text>Delete Account QA Surface</Text>;
  };
});

jest.mock("../../components/modals/settings/SettingsModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockSettingsModal({
    initialLanguagePickerOpen,
  }: {
    initialLanguagePickerOpen?: boolean;
  }) {
    return (
      <Text>
        {initialLanguagePickerOpen
          ? "Settings Language Picker QA Surface"
          : "Settings QA Surface"}
      </Text>
    );
  };
});

jest.mock("../../components/modals/settings/UpgradeAccountModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockUpgradeAccountModal({
    initialExistingAccountPromptVisible,
  }: {
    initialExistingAccountPromptVisible?: boolean;
  }) {
    return (
      <Text>
        {initialExistingAccountPromptVisible
          ? "Upgrade Existing Account QA Surface"
          : "Upgrade Account QA Surface"}
      </Text>
    );
  };
});

jest.mock("../../components/modals/system/OfflineBlockingModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockOfflineBlockingModal() {
    return <Text>Offline QA Surface</Text>;
  };
});

jest.mock("../../components/modals/ModalRegistry", () => ({
  getModalComponent: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return function MockRegistryModal() {
      return <Text>Registry Modal QA Surface</Text>;
    };
  },
}));

jest.mock("../../components/development/ModalTogglePanel", () => ({
  generateMockData: () => ({}),
}));

const surfaceIds = [...QA_SURFACE_IDS] as QASurfaceId[];
const addEventListenerMock = jest.fn(() => ({ remove: jest.fn() }));

const GateAfterExistingModal = () => {
  const modal = useModalContext();
  const [shouldRenderGate, setShouldRenderGate] = useState(false);

  useEffect(() => {
    modal.openModal("welcomeBack", { username: "Existing User" });
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

describe("QASurfaceHarness", () => {
  it("has an exhaustive renderer for every screenshot surface", () => {
    expect(Object.keys(QA_SURFACE_RENDERERS).sort()).toEqual(
      [...QA_SURFACE_IDS].sort()
    );
  });

  it("renders visible loading text for loading QA surfaces", () => {
    const screen = renderWithModalProvider(<QASurfaceHarness surfaceId="page-app-loading" />);

    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.getByText("qa-surface:page-app-loading")).toBeTruthy();
  });

  it.each(surfaceIds)("renders QA surface %s", (surfaceId) => {
    const screen = renderWithModalProvider(
      <QASurfaceHarness surfaceId={surfaceId} />
    );

    expect(screen.getByText(`qa-surface:${surfaceId}`)).toBeTruthy();
  });
});

describe("QASurfaceGate", () => {
  beforeEach(() => {
    jest
      .spyOn(Linking, "getInitialURL")
      .mockResolvedValue("exp+riddle-quest://qa?surface=page-landing");
    jest
      .spyOn(Linking, "addEventListener")
      .mockImplementation(addEventListenerMock as never);
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
