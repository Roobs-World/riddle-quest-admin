import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Switch } from "react-native";
import ModalTogglePanel from "../ModalTogglePanel";

const mockDebug = jest.fn();
const mockWarn = jest.fn();
const mockGetModalComponent = jest.fn();

const expectedModalTypes = [
  "victory",
  "loss",
  "settings",
  "fullProfileDetails",
  "upgradeAccount",
  "achievements",
  "stats",
  "leaderboard",
  "changePassword",
  "updateUsername",
  "avatarOptions",
  "preloadedAvatars",
  "info",
  "hint",
  "skip",
  "welcome",
  "instructions",
  "credits",
  "coinShop",
  "coinPurchaseFanfare",
  "achievementUnlockFanfare",
  "streakIncreaseFanfare",
];

jest.mock("../../modals/ModalRegistry", () => ({
  modalRegistry: {
    victory: {},
    loss: {},
    settings: {},
    fullProfileDetails: {},
    upgradeAccount: {},
    achievements: {},
    stats: {},
    leaderboard: {},
    changePassword: {},
    updateUsername: {},
    avatarOptions: {},
    preloadedAvatars: {},
    info: {},
    hint: {},
    skip: {},
    welcome: {},
    instructions: {},
    credits: {},
    coinShop: {},
    coinPurchaseFanfare: {},
    achievementUnlockFanfare: {},
    streakIncreaseFanfare: {},
  },
  getModalComponent: (...args: any[]) => mockGetModalComponent(...args),
}));

jest.mock("react-native-iap", () => ({}));

jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    playerData: null,
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

    mockGetModalComponent.mockImplementation((modalType: string) => {
      return ({ onClose, ...props }: any) => {
        const React = require("react");
        const { TouchableOpacity, Text } = require("react-native");
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            TouchableOpacity,
            {
              testID: `active-${modalType}`,
              onPress: onClose,
            },
            React.createElement(Text, null, JSON.stringify(props).slice(0, 20))
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
            React.createElement(Text, null, "invoke")
          )
        );
      };
    });
  });

  it("does not render in production mode", () => {
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = false;

    const { toJSON } = render(<ModalTogglePanel />);

    expect(toJSON()).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      "ModalTogglePanel should not be used in production builds"
    );

    (global as any).__DEV__ = originalDev;
  });

  it("expands panel, toggles modals, and clears all", () => {
    const { getByText, UNSAFE_getAllByType, queryByTestId } = render(
      <ModalTogglePanel />
    );

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    expect(switches.length).toBe(expectedModalTypes.length);

    for (const item of switches) {
      fireEvent(item, "valueChange", true);
    }

    expect(queryByTestId("active-victory")).toBeTruthy();
    expect(queryByTestId("active-loss")).toBeTruthy();
    expect(queryByTestId("active-settings")).toBeTruthy();
    expect(queryByTestId("active-info")).toBeTruthy();
    expect(queryByTestId("active-coinShop")).toBeTruthy();
    expect(queryByTestId("active-coinPurchaseFanfare")).toBeTruthy();
    expect(queryByTestId("active-achievementUnlockFanfare")).toBeTruthy();

    fireEvent.press(getByText("Clear All"));

    expect(queryByTestId("active-victory")).toBeNull();
    expect(queryByTestId("active-loss")).toBeNull();
  });

  it("closes an active modal via onClose callback", () => {
    const { getByText, UNSAFE_getAllByType, getByTestId, queryByTestId } =
      render(<ModalTogglePanel />);

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    fireEvent(switches[0], "valueChange", true);

    const modal = getByTestId("active-victory");
    fireEvent.press(modal);

    expect(queryByTestId("active-victory")).toBeNull();
  });

  it("executes modal-specific mock actions without throwing", () => {
    const { getByText, UNSAFE_getAllByType, getByTestId } = render(
      <ModalTogglePanel />
    );

    fireEvent.press(getByText(/Modal Testing/));

    const switches = UNSAFE_getAllByType(Switch);
    for (const item of switches) {
      fireEvent(item, "valueChange", true);
    }

    fireEvent.press(getByTestId("invoke-settings"));
    fireEvent.press(getByTestId("invoke-victory"));
    fireEvent.press(getByTestId("invoke-updateUsername"));
    fireEvent.press(getByTestId("invoke-avatarOptions"));
    fireEvent.press(getByTestId("invoke-preloadedAvatars"));
    fireEvent.press(getByTestId("invoke-info"));
    fireEvent.press(getByTestId("invoke-hint"));
    fireEvent.press(getByTestId("invoke-skip"));
    fireEvent.press(getByTestId("invoke-welcome"));
    fireEvent.press(getByTestId("invoke-coinShop"));
    fireEvent.press(getByTestId("invoke-coinPurchaseFanfare"));
    fireEvent.press(getByTestId("invoke-achievementUnlockFanfare"));
    fireEvent.press(getByTestId("invoke-loss"));

    expect(mockGetModalComponent).toHaveBeenCalled();
  });

  it("handles __fetchServerData modal data updates and merges updated payload", async () => {
    const prototype = Object.prototype as Record<string, unknown>;
    const originalFetch = prototype.__fetchServerData;

    prototype.__fetchServerData = async (
      updateFn: (data: Record<string, unknown>) => void
    ) => {
      delete prototype.__fetchServerData;
      updateFn({ fetched: true, source: "server" });
    };

    try {
      const { getByText, UNSAFE_getAllByType, getByTestId } = render(
        <ModalTogglePanel />
      );

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
        expect.objectContaining({ fetched: true })
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
    const { getByText } = render(
      <ModalTogglePanel onCompleteRiddle={onCompleteRiddle} />
    );

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Complete Riddle"));

    expect(onCompleteRiddle).toHaveBeenCalledTimes(1);
  });

  it("invokes onGenerateDailyChallenge when debug action button is pressed", () => {
    const onGenerateDailyChallenge = jest.fn();
    const { getByText } = render(
      <ModalTogglePanel onGenerateDailyChallenge={onGenerateDailyChallenge} />
    );

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Generate Daily Challenge"));

    expect(onGenerateDailyChallenge).toHaveBeenCalledTimes(1);
  });

  it("invokes onClearLocalData when debug action button is pressed", () => {
    const onClearLocalData = jest.fn();
    const { getByText } = render(
      <ModalTogglePanel onClearLocalData={onClearLocalData} />
    );

    fireEvent.press(getByText(/Modal Testing/));
    fireEvent.press(getByText("Clear Local Data"));

    expect(onClearLocalData).toHaveBeenCalledTimes(1);
  });
});
