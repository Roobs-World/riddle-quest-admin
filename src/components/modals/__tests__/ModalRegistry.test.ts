import React from "react";

// Mock all modal components before requiring ModalRegistry
const MockModal = () => React.createElement("View", null);
MockModal.displayName = "MockModal";

jest.mock("../game/VictoryModal", () => MockModal);
jest.mock("../game/LossModal", () => MockModal);
jest.mock("../game/GameModeModal", () => MockModal);
jest.mock("../settings/SettingsModal", () => MockModal);
jest.mock("../settings/FullProfileDetailsModal", () => MockModal);
jest.mock("../settings/ChangePasswordModal", () => MockModal);
jest.mock("../settings/UpdateUsernameModal", () => MockModal);
jest.mock("../settings/AvatarOptionsModal", () => MockModal);
jest.mock("../settings/PreloadedAvatarsModal", () => MockModal);
jest.mock("../settings/AchievementsModal", () => MockModal);
jest.mock("../settings/StatsModal", () => MockModal);
jest.mock("../settings/LeaderboardModal", () => MockModal);
jest.mock("../help/HintModal", () => MockModal);
jest.mock("../help/InfoModal", () => MockModal);
jest.mock("../help/SkipModal", () => MockModal);
jest.mock("../help/WelcomeModal", () => MockModal);
jest.mock("../help/InstructionsModal", () => MockModal);
jest.mock("../help/CreditsModal", () => MockModal);
jest.mock("../../shop/CoinShopModal", () => MockModal);
jest.mock("../shop/CoinPurchaseFanfareModal", () => MockModal);

// Mock logger
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

const {
  modalRegistry,
  getModalComponent,
  isModalRegistered,
} = require("../ModalRegistry");

const { logger } = require("../../../utils/logger");

describe("ModalRegistry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Modal Registration", () => {
    const requiredModalTypes = [
      "victory",
      "loss",
      "gameMode",
      "settings",
      "fullProfileDetails",
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
    ];

    it("should register all required modal types", () => {
      requiredModalTypes.forEach((type) => {
        expect(isModalRegistered(type)).toBe(true);
        expect(getModalComponent(type)).not.toBeNull();
      });
    });

    it("should have a component for each registered modal", () => {
      requiredModalTypes.forEach((type) => {
        const component = getModalComponent(type);
        expect(component).toBeDefined();
        expect(typeof component).toBe("function");
      });
    });

    it("should have displayName for each modal wrapper", () => {
      requiredModalTypes.forEach((type) => {
        const component = modalRegistry[type];
        expect(component.displayName).toBeDefined();
        expect(component.displayName).toContain("ModalWrapper");
      });
    });
  });

  describe("getModalComponent", () => {
    it("should return the modal component for valid type", () => {
      const victoryModal = getModalComponent("victory");
      expect(victoryModal).not.toBeNull();
      expect(typeof victoryModal).toBe("function");
    });

    it("should return null for unknown modal type", () => {
      const result = getModalComponent("does-not-exist");
      expect(result).toBeNull();
    });

    it("should log warning for unknown modal type", () => {
      getModalComponent("unknown-modal-type");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("unknown-modal-type")
      );
    });

    it("should not log warning for valid modal type", () => {
      getModalComponent("victory");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should return different components for different types", () => {
      const victoryModal = getModalComponent("victory");
      const lossModal = getModalComponent("loss");
      expect(victoryModal).not.toBe(lossModal);
    });
  });

  describe("isModalRegistered", () => {
    it("should return true for registered modal types", () => {
      expect(isModalRegistered("victory")).toBe(true);
      expect(isModalRegistered("loss")).toBe(true);
      expect(isModalRegistered("settings")).toBe(true);
      expect(isModalRegistered("coinShop")).toBe(true);
    });

    it("should return false for unregistered modal types", () => {
      expect(isModalRegistered("does-not-exist")).toBe(false);
      expect(isModalRegistered("")).toBe(false);
      expect(isModalRegistered("randomType")).toBe(false);
    });

    it("should handle edge cases for modal type names", () => {
      expect(isModalRegistered("VICTORY")).toBe(false); // case-sensitive
      expect(isModalRegistered(" victory")).toBe(false); // with space
      expect(isModalRegistered("victory ")).toBe(false); // trailing space
    });
  });

  describe("Modal Wrapper Props Mapping", () => {
    const createBaseProps = () => ({
      isVisible: true,
      onClose: jest.fn(),
    });

    describe("Victory Modal", () => {
      it("should map props correctly for victory modal", () => {
        const VictoryModal = getModalComponent("victory");
        const props = {
          ...createBaseProps(),
          attempts: 3,
          coinsEarned: 50,
          guesses: [],
          unlockedAchievementNames: ["First Win"],
          onNext: jest.fn(),
          onHome: jest.fn(),
        };

        expect(() => VictoryModal(props)).not.toThrow();
      });

      it("should handle missing optional props with defaults", () => {
        const VictoryModal = getModalComponent("victory");
        const props = createBaseProps();

        expect(() => VictoryModal(props)).not.toThrow();
      });
    });

    describe("Loss Modal", () => {
      it("should map props correctly for loss modal", () => {
        const LossModal = getModalComponent("loss");
        const props = {
          ...createBaseProps(),
          correctAnswer: "HELLO",
          onNext: jest.fn(),
          onHome: jest.fn(),
          onWatchAdContinue: jest.fn(),
          onCoinContinue: jest.fn(),
          coinContinueCost: 100,
          canWatchAd: true,
          canUseCoin: true,
        };

        expect(() => LossModal(props)).not.toThrow();
      });

      it("should handle undefined ad/coin continue options", () => {
        const LossModal = getModalComponent("loss");
        const props = {
          ...createBaseProps(),
          correctAnswer: "HELLO",
        };

        expect(() => LossModal(props)).not.toThrow();
      });
    });

    describe("GameMode Modal", () => {
      it("should map props correctly for gameMode modal", () => {
        const GameModeModal = getModalComponent("gameMode");
        const props = {
          ...createBaseProps(),
          onSelectMode: jest.fn(),
          currentLevel: 5,
        };

        expect(() => GameModeModal(props)).not.toThrow();
      });
    });

    describe("Settings Modal", () => {
      it("should map props correctly for settings modal", () => {
        const SettingsModal = getModalComponent("settings");
        const props = {
          ...createBaseProps(),
          isSoundEnabled: true,
          isHapticsEnabled: true,
          currentLanguage: "en",
          onToggleSound: jest.fn(),
          onToggleHaptics: jest.fn(),
          onChangeLanguage: jest.fn(),
          onPressLogout: jest.fn(),
          onPressHelp: jest.fn(),
          onPressCredits: jest.fn(),
          playerData: null,
        };

        expect(() => SettingsModal(props)).not.toThrow();
      });
    });

    describe("Hint Modal", () => {
      it("should map props correctly for hint modal", () => {
        const HintModal = getModalComponent("hint");
        const props = {
          ...createBaseProps(),
          userCoins: 100,
          hintCost: 25,
          onShowHint: jest.fn(),
        };

        expect(() => HintModal(props)).not.toThrow();
      });
    });

    describe("Skip Modal", () => {
      it("should map props correctly for skip modal", () => {
        const SkipModal = getModalComponent("skip");
        const props = {
          ...createBaseProps(),
          userCoins: 100,
          skipCost: 50,
          onSkipLevel: jest.fn(),
        };

        expect(() => SkipModal(props)).not.toThrow();
      });
    });

    describe("Info Modal", () => {
      it("should map props correctly for info modal with onConfirm", () => {
        const InfoModal = getModalComponent("info");
        const mockOnConfirm = jest.fn();
        const mockOnClose = jest.fn();
        const props = {
          isVisible: true,
          onClose: mockOnClose,
          title: "Test Title",
          message: "Test Message",
          onConfirm: mockOnConfirm,
        };

        expect(() => InfoModal(props)).not.toThrow();
      });
    });

    describe("CoinShop Modal", () => {
      it("should map props correctly for coinShop modal", () => {
        const CoinShopModal = getModalComponent("coinShop");
        const props = {
          ...createBaseProps(),
          products: [],
          firestoreProducts: [],
          currentCoins: 500,
          onPurchaseProduct: jest.fn(),
          loading: false,
          error: null,
          onWatchVideo: jest.fn(),
          onPayAndPlay: jest.fn(),
        };

        expect(() => CoinShopModal(props)).not.toThrow();
      });
    });

    describe("Profile and Avatar Modals", () => {
      it("should map props correctly for fullProfileDetails modal", () => {
        const FullProfileDetailsModal = getModalComponent("fullProfileDetails");
        const props = {
          ...createBaseProps(),
          playerData: { userId: "123", username: "test" },
        };

        expect(() => FullProfileDetailsModal(props)).not.toThrow();
      });

      it("should map props correctly for avatarOptions modal", () => {
        const AvatarOptionsModal = getModalComponent("avatarOptions");
        const props = {
          ...createBaseProps(),
          onAvatarSelected: jest.fn(),
          onOpenPreloadedAvatars: jest.fn(),
          userId: "test-user-id",
        };

        expect(() => AvatarOptionsModal(props)).not.toThrow();
      });

      it("should map props correctly for preloadedAvatars modal", () => {
        const PreloadedAvatarsModal = getModalComponent("preloadedAvatars");
        const props = {
          ...createBaseProps(),
          onAvatarSelected: jest.fn(),
        };

        expect(() => PreloadedAvatarsModal(props)).not.toThrow();
      });
    });

    describe("Stats and Achievements Modals", () => {
      it("should map props correctly for stats modal", () => {
        const StatsModal = getModalComponent("stats");
        const props = {
          ...createBaseProps(),
          playerData: { userId: "123", stats: { wins: 10 } },
        };

        expect(() => StatsModal(props)).not.toThrow();
      });

      it("should map props correctly for achievements modal", () => {
        const AchievementsModal = getModalComponent("achievements");
        const props = {
          ...createBaseProps(),
          playerData: { userId: "123", achievements: [] },
        };

        expect(() => AchievementsModal(props)).not.toThrow();
      });

      it("should map props correctly for leaderboard modal", () => {
        const LeaderboardModal = getModalComponent("leaderboard");
        const props = {
          ...createBaseProps(),
          currentUserId: "user-123",
        };

        expect(() => LeaderboardModal(props)).not.toThrow();
      });
    });

    describe("Account Management Modals", () => {
      it("should map props correctly for changePassword modal", () => {
        const ChangePasswordModal = getModalComponent("changePassword");
        const props = {
          ...createBaseProps(),
          onPasswordChanged: jest.fn(),
        };

        expect(() => ChangePasswordModal(props)).not.toThrow();
      });

      it("should map props correctly for updateUsername modal", () => {
        const UpdateUsernameModal = getModalComponent("updateUsername");
        const props = {
          ...createBaseProps(),
          currentUsername: "oldUsername",
          onUsernameUpdated: jest.fn(),
        };

        expect(() => UpdateUsernameModal(props)).not.toThrow();
      });
    });

    describe("Help Modals", () => {
      it("should map props correctly for welcome modal", () => {
        const WelcomeModal = getModalComponent("welcome");
        const props = {
          ...createBaseProps(),
        };

        expect(() => WelcomeModal(props)).not.toThrow();
      });

      it("should map props correctly for instructions modal", () => {
        const InstructionsModal = getModalComponent("instructions");
        const props = createBaseProps();

        expect(() => InstructionsModal(props)).not.toThrow();
      });

      it("should map props correctly for credits modal", () => {
        const CreditsModal = getModalComponent("credits");
        const props = createBaseProps();

        expect(() => CreditsModal(props)).not.toThrow();
      });
    });

    describe("Shop Modals", () => {
      it("should map props correctly for coinPurchaseFanfare modal", () => {
        const CoinPurchaseFanfareModal = getModalComponent("coinPurchaseFanfare");
        const props = {
          ...createBaseProps(),
          coinsPurchased: 100,
        };

        expect(() => CoinPurchaseFanfareModal(props)).not.toThrow();
      });
    });
  });

  describe("Modal Registry Structure", () => {
    it("should be a non-empty object", () => {
      expect(typeof modalRegistry).toBe("object");
      expect(Object.keys(modalRegistry).length).toBeGreaterThan(0);
    });

    it("should have all expected modal categories", () => {
      // Game modals
      expect(modalRegistry.victory).toBeDefined();
      expect(modalRegistry.loss).toBeDefined();
      expect(modalRegistry.gameMode).toBeDefined();

      // Settings modals
      expect(modalRegistry.settings).toBeDefined();
      expect(modalRegistry.fullProfileDetails).toBeDefined();
      expect(modalRegistry.changePassword).toBeDefined();
      expect(modalRegistry.updateUsername).toBeDefined();
      expect(modalRegistry.avatarOptions).toBeDefined();
      expect(modalRegistry.preloadedAvatars).toBeDefined();

      // Help modals
      expect(modalRegistry.hint).toBeDefined();
      expect(modalRegistry.skip).toBeDefined();
      expect(modalRegistry.welcome).toBeDefined();
      expect(modalRegistry.instructions).toBeDefined();
      expect(modalRegistry.credits).toBeDefined();

      // Shop modals
      expect(modalRegistry.coinShop).toBeDefined();
      expect(modalRegistry.coinPurchaseFanfare).toBeDefined();
    });

    it("should have display names for all modals", () => {
      const displayNames = Object.values(modalRegistry).map(
        (modal: any) => modal.displayName
      );
      // Each modal wrapper should have a displayName
      displayNames.forEach((name) => {
        expect(name).toBeDefined();
        expect(typeof name).toBe("string");
        expect(name).toContain("ModalWrapper");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle null props gracefully", () => {
      const VictoryModal = getModalComponent("victory");
      expect(() =>
        VictoryModal({ isVisible: false, onClose: () => {} })
      ).not.toThrow();
    });

    it("should handle undefined callbacks", () => {
      const LossModal = getModalComponent("loss");
      const props = {
        isVisible: true,
        onClose: jest.fn(),
        correctAnswer: "TEST",
        onNext: undefined,
        onHome: undefined,
      };
      expect(() => LossModal(props)).not.toThrow();
    });

    it("should handle empty arrays in props", () => {
      const VictoryModal = getModalComponent("victory");
      const props = {
        isVisible: true,
        onClose: jest.fn(),
        guesses: [],
        unlockedAchievementNames: [],
      };
      expect(() => VictoryModal(props)).not.toThrow();
    });
  });
});
