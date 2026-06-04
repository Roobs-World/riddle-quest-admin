import React from "react";
import {render, fireEvent, waitFor, act} from "@testing-library/react-native";
import {Switch} from "react-native";
import ModalTogglePanel from "../ModalTogglePanel";
import {MODAL_REGISTRY_TYPES} from "../../modals/modalTypes";

const mockDebug = jest.fn();
const mockWarn = jest.fn();
const mockGetModalComponent = jest.fn();
let mockPlayerData: Record<string, unknown> | null = null;

const expectedModalTypes = [...MODAL_REGISTRY_TYPES];

jest.mock("../../modals/ModalRegistry", () => {
  const {MODAL_REGISTRY_TYPES} = jest.requireActual("../../modals/modalTypes");
  return {
    modalRegistry: Object.fromEntries(MODAL_REGISTRY_TYPES.map((modalType: string) => [modalType, {}])),
    getModalComponent: (...args: any[]) => mockGetModalComponent(...args),
  };
});

jest.mock("react-native-iap", () => ({}));

jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    playerData: mockPlayerData,
  }),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: (...args: any[]) => mockDebug(...args),
    warn: (...args: any[]) => mockWarn(...args),
  },
}));

describe("ModalTogglePanel", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayerData = null;

    mockGetModalComponent.mockImplementation((modalType: string) => {
      return ({onClose, ...props}: any) => {
        const React = require("react");
        const {TouchableOpacity, Text} = require("react-native");
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            TouchableOpacity,
            {
              testID: `active-${modalType}`,
              onPress: onClose,
            },
            React.createElement(Text, null, JSON.stringify(props).slice(0, 20)),
          ),
          React.createElement(
            TouchableOpacity,
            {
              testID: `invoke-${modalType}`,
              onPress: () => {
                Object.values(props).forEach((value: unknown) => {
                  if (typeof value === "function") {
                    if ((value as (...args: unknown[]) => void).length > 0) {
                      (value as (...args: unknown[]) => void)("test");
                    } else {
                      (value as () => void)();
                    }
                  }
                });
              },
            },
            React.createElement(Text, null, "invoke"),
          ),
        );
      };
    });
  });

  it("does not render in production mode", () => {
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = false;

    const {toJSON} = render(<ModalTogglePanel />);

    expect(toJSON()).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith("ModalTogglePanel should not be used in production builds");

    (global as any).__DEV__ = originalDev;
  });

  it("expands panel, toggles modals, and clears all", () => {
    const {getByText, UNSAFE_getAllByType, queryByTestId} = render(<ModalTogglePanel />);

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    expect(switches.length).toBe(expectedModalTypes.length);

    for (const item of switches) {
      fireEvent(item, "valueChange", true);
    }

    for (const modalType of expectedModalTypes) {
      expect(queryByTestId(`active-${modalType}`)).toBeTruthy();
    }

    fireEvent.press(getByText("Clear All"));

    for (const modalType of expectedModalTypes) {
      expect(queryByTestId(`active-${modalType}`)).toBeNull();
    }
  });

  it("closes an active modal via onClose callback", () => {
    const {getByText, UNSAFE_getAllByType, getByTestId, queryByTestId} = render(<ModalTogglePanel />);

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    fireEvent(switches[0], "valueChange", true);

    const modal = getByTestId("active-victory");
    fireEvent.press(modal);

    expect(queryByTestId("active-victory")).toBeNull();
  });

  it("executes modal-specific mock actions without throwing", () => {
    const {getByText, UNSAFE_getAllByType, getByTestId} = render(<ModalTogglePanel />);

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    for (const item of switches) {
      fireEvent(item, "valueChange", true);
    }

    for (const modalType of expectedModalTypes) {
      fireEvent.press(getByTestId(`invoke-${modalType}`));
    }

    expect(mockGetModalComponent).toHaveBeenCalled();
  });

  it("opens the quick action modals from the debug shortcut row", () => {
    const {getByText, queryByTestId} = render(<ModalTogglePanel />);

    fireEvent.press(getByText("Profile"));
    expect(queryByTestId("active-fullProfileDetails")).toBeTruthy();

    fireEvent.press(getByText("Loss"));
    expect(queryByTestId("active-loss")).toBeTruthy();

    fireEvent.press(getByText("Coin Shop"));
    expect(queryByTestId("active-coinShop")).toBeTruthy();

    fireEvent.press(getByText("Settings"));
    expect(queryByTestId("active-settings")).toBeTruthy();
  });

  it("does not auto-open the profile modal when player data becomes available", async () => {
    mockPlayerData = {userId: "user-123"};

    const {queryByTestId} = render(<ModalTogglePanel />);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(queryByTestId("active-fullProfileDetails")).toBeNull();
  });

  it("handles __fetchServerData modal data updates and merges updated payload", async () => {
    const prototype = Object.prototype as Record<string, unknown>;
    const originalFetch = prototype.__fetchServerData;

    prototype.__fetchServerData = async (updateFn: (data: Record<string, unknown>) => void) => {
      delete prototype.__fetchServerData;
      updateFn({fetched: true, source: "server"});
    };

    try {
      const {getByText, UNSAFE_getAllByType, getByTestId} = render(<ModalTogglePanel />);

      fireEvent.press(getByText(/Modal Testing/));

      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[2], "valueChange", true); // settings

      await act(async () => {
        jest.advanceTimersByTime(120);
      });

      await waitFor(() => {
        expect(getByTestId("active-settings")).toBeTruthy();
      });
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining("Updating modal data for settings:"),
        expect.objectContaining({fetched: true}),
      );
    } finally {
      if (originalFetch === undefined) {
        delete prototype.__fetchServerData;
      } else {
        prototype.__fetchServerData = originalFetch;
      }
    }
  });

  it("invokes onCompleteRiddle when debug action button is pressed", () => {
    const onCompleteRiddle = jest.fn();
    const {getByText} = render(<ModalTogglePanel onCompleteRiddle={onCompleteRiddle} />);

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Complete Riddle"));

    expect(onCompleteRiddle).toHaveBeenCalledTimes(1);
  });

  it("invokes onGenerateDailyChallenge when debug action button is pressed", () => {
    const onGenerateDailyChallenge = jest.fn();
    const {getByText} = render(<ModalTogglePanel onGenerateDailyChallenge={onGenerateDailyChallenge} />);

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Generate Daily Challenge"));

    expect(onGenerateDailyChallenge).toHaveBeenCalledTimes(1);
  });

  it("invokes onClearLocalData when debug action button is pressed", () => {
    const onClearLocalData = jest.fn();
    const {getByText} = render(<ModalTogglePanel onClearLocalData={onClearLocalData} />);

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Clear Local Data"));

    expect(onClearLocalData).toHaveBeenCalledTimes(1);
  });
});
