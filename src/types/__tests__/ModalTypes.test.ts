/**
 * @fileoverview Unit tests for ModalTypes.
 *
 * Tests type exports and interfaces for the modal system.
 */

import type {
  BaseModalProps,
  ModalData,
  ModalConfig,
  ModalInstance,
  ModalRegistry,
  ModalContextState,
  ModalOptions,
  GameModalTypes,
  ModalDataType,
  ModalAction,
} from "../ModalTypes";

describe("ModalTypes", () => {
  describe("BaseModalProps interface", () => {
    it("should define isVisible and onClose properties", () => {
      const props: BaseModalProps = {
        isVisible: true,
        onClose: jest.fn(),
      };

      expect(typeof props.isVisible).toBe("boolean");
      expect(typeof props.onClose).toBe("function");
    });

    it("should allow isVisible to be false", () => {
      const props: BaseModalProps = {
        isVisible: false,
        onClose: jest.fn(),
      };

      expect(props.isVisible).toBe(false);
    });

    it("should require onClose to be callable", () => {
      const mockOnClose = jest.fn();
      const props: BaseModalProps = {
        isVisible: true,
        onClose: mockOnClose,
      };

      props.onClose();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("ModalData interface", () => {
    it("should allow any key-value pairs", () => {
      const data: ModalData = {
        foo: "bar",
        count: 42,
        nested: {a: 1},
        array: [1, 2, 3],
      };

      expect(data.foo).toBe("bar");
      expect(data.count).toBe(42);
    });

    it("should allow empty object", () => {
      const data: ModalData = {};

      expect(Object.keys(data)).toHaveLength(0);
    });

    it("should allow unknown value types", () => {
      const data: ModalData = {
        nullValue: null,
        undefinedValue: undefined,
        boolValue: true,
        numberValue: 123,
        stringValue: "test",
      };

      expect(data.nullValue).toBeNull();
      expect(data.undefinedValue).toBeUndefined();
    });
  });

  describe("ModalConfig interface", () => {
    it("should define component and optional defaultProps", () => {
      const MockComponent = () => null;

      const config: ModalConfig = {
        component: MockComponent as any,
        defaultProps: {someDefault: true},
      };

      expect(config.component).toBe(MockComponent);
      expect(config.defaultProps).toEqual({someDefault: true});
    });

    it("should allow config without defaultProps", () => {
      const MockComponent = () => null;

      const config: ModalConfig = {
        component: MockComponent as any,
      };

      expect(config.component).toBe(MockComponent);
      expect(config.defaultProps).toBeUndefined();
    });

    it("should support generic type parameter for custom data", () => {
      interface CustomData extends ModalData {
        customField: string;
      }

      const MockComponent = () => null;

      const config: ModalConfig<CustomData> = {
        component: MockComponent as any,
        defaultProps: {customField: "default"},
      };

      expect(config.defaultProps?.customField).toBe("default");
    });
  });

  describe("ModalInstance interface", () => {
    it("should define all required properties", () => {
      const instance: ModalInstance = {
        id: "modal-123",
        type: "settings",
        data: {},
        priority: 1,
      };

      expect(instance.id).toBe("modal-123");
      expect(instance.type).toBe("settings");
      expect(instance.data).toEqual({});
      expect(instance.priority).toBe(1);
    });

    it("should support optional persistent property", () => {
      const instance: ModalInstance = {
        id: "modal-456",
        type: "victory",
        data: {},
        priority: 10,
        persistent: true,
      };

      expect(instance.persistent).toBe(true);
    });

    it("should allow persistent to be false", () => {
      const instance: ModalInstance = {
        id: "modal-789",
        type: "loss",
        data: {},
        priority: 5,
        persistent: false,
      };

      expect(instance.persistent).toBe(false);
    });

    it("should support generic type for data", () => {
      interface VictoryData extends ModalData {
        attempts: number;
        coinsEarned: number;
      }

      const instance: ModalInstance<VictoryData> = {
        id: "victory-1",
        type: "victory",
        data: {attempts: 3, coinsEarned: 50},
        priority: 100,
      };

      expect(instance.data.attempts).toBe(3);
      expect(instance.data.coinsEarned).toBe(50);
    });
  });

  describe("ModalRegistry type", () => {
    it("should be a record of string keys to ModalConfig values", () => {
      const MockComponent = () => null;

      const registry: ModalRegistry = {
        settings: {component: MockComponent as any},
        victory: {component: MockComponent as any},
        loss: {component: MockComponent as any},
      };

      expect(Object.keys(registry)).toContain("settings");
      expect(Object.keys(registry)).toContain("victory");
      expect(Object.keys(registry)).toContain("loss");
    });

    it("should allow empty registry", () => {
      const registry: ModalRegistry = {};

      expect(Object.keys(registry)).toHaveLength(0);
    });
  });

  describe("ModalContextState interface", () => {
    it("should define all required properties and methods", () => {
      const mockState: ModalContextState = {
        modals: [],
        openModal: jest.fn(() => "modal-id"),
        closeModal: jest.fn(),
        closeModalByType: jest.fn(),
        closeAllModals: jest.fn(),
        isModalOpen: jest.fn(() => false),
        getModalData: jest.fn(() => null),
        updateModalData: jest.fn(),
      };

      expect(Array.isArray(mockState.modals)).toBe(true);
      expect(typeof mockState.openModal).toBe("function");
      expect(typeof mockState.closeModal).toBe("function");
      expect(typeof mockState.closeModalByType).toBe("function");
      expect(typeof mockState.closeAllModals).toBe("function");
      expect(typeof mockState.isModalOpen).toBe("function");
      expect(typeof mockState.getModalData).toBe("function");
      expect(typeof mockState.updateModalData).toBe("function");
    });

    it("should allow calling openModal with type and data", () => {
      const openModal = jest.fn(() => "modal-123");

      const state: ModalContextState = {
        modals: [],
        openModal,
        closeModal: jest.fn(),
        closeModalByType: jest.fn(),
        closeAllModals: jest.fn(),
        isModalOpen: jest.fn(),
        getModalData: jest.fn(),
        updateModalData: jest.fn(),
      };

      const id = state.openModal("settings", {theme: "dark"});

      expect(openModal).toHaveBeenCalledWith("settings", {theme: "dark"});
      expect(id).toBe("modal-123");
    });

    it("should allow calling openModal with options", () => {
      const openModal = jest.fn(() => "modal-456");

      const state: ModalContextState = {
        modals: [],
        openModal,
        closeModal: jest.fn(),
        closeModalByType: jest.fn(),
        closeAllModals: jest.fn(),
        isModalOpen: jest.fn(),
        getModalData: jest.fn(),
        updateModalData: jest.fn(),
      };

      const options: ModalOptions = {
        priority: 10,
        persistent: true,
        replace: true,
      };

      state.openModal("victory", {}, options);

      expect(openModal).toHaveBeenCalledWith("victory", {}, options);
    });

    it("should allow modals array to contain ModalInstance objects", () => {
      const state: ModalContextState = {
        modals: [
          {id: "1", type: "settings", data: {}, priority: 1},
          {id: "2", type: "victory", data: {}, priority: 10},
        ],
        openModal: jest.fn(() => "id"),
        closeModal: jest.fn(),
        closeModalByType: jest.fn(),
        closeAllModals: jest.fn(),
        isModalOpen: jest.fn(),
        getModalData: jest.fn(),
        updateModalData: jest.fn(),
      };

      expect(state.modals).toHaveLength(2);
      expect(state.modals[0].type).toBe("settings");
      expect(state.modals[1].type).toBe("victory");
    });
  });

  describe("ModalOptions interface", () => {
    it("should define all optional properties", () => {
      const options: ModalOptions = {
        priority: 5,
        persistent: true,
        replace: false,
      };

      expect(options.priority).toBe(5);
      expect(options.persistent).toBe(true);
      expect(options.replace).toBe(false);
    });

    it("should allow empty options", () => {
      const options: ModalOptions = {};

      expect(options.priority).toBeUndefined();
      expect(options.persistent).toBeUndefined();
      expect(options.replace).toBeUndefined();
    });

    it("should allow partial options", () => {
      const options: ModalOptions = {
        priority: 100,
      };

      expect(options.priority).toBe(100);
      expect(options.persistent).toBeUndefined();
    });
  });

  describe("GameModalTypes interface", () => {
    it("should define victory modal type with required properties", () => {
      const victoryData: GameModalTypes["victory"] = {
        attempts: 3,
        coinsEarned: 50,
        guesses: [],
        onNext: jest.fn(),
      };

      expect(victoryData.attempts).toBe(3);
      expect(victoryData.coinsEarned).toBe(50);
      expect(Array.isArray(victoryData.guesses)).toBe(true);
      expect(typeof victoryData.onNext).toBe("function");
    });

    it("should allow optional unlockedAchievementNames in victory", () => {
      const victoryData: GameModalTypes["victory"] = {
        attempts: 1,
        coinsEarned: 100,
        guesses: [],
        unlockedAchievementNames: ["First Win", "Perfect Game"],
        onNext: jest.fn(),
      };

      expect(victoryData.unlockedAchievementNames).toContain("First Win");
    });

    it("should define loss modal type", () => {
      const lossData: GameModalTypes["loss"] = {
        correctAnswer: "HELLO",
        onNext: jest.fn(),
      };

      expect(lossData.correctAnswer).toBe("HELLO");
    });

    it("should allow optional continue options in loss modal", () => {
      const lossData: GameModalTypes["loss"] = {
        correctAnswer: "WORLD",
        onNext: jest.fn(),
        onWatchAdContinue: jest.fn(),
        onCoinContinue: jest.fn(),
        coinContinueCost: 50,
        canWatchAd: true,
        canUseCoin: true,
      };

      expect(lossData.onWatchAdContinue).toBeDefined();
      expect(lossData.coinContinueCost).toBe(50);
    });

    it("should define settings modal type", () => {
      const settingsData: GameModalTypes["settings"] = {
        isSoundEnabled: true,
        isHapticsEnabled: false,
        currentLanguage: "en",
        onToggleSound: jest.fn(),
        onToggleHaptics: jest.fn(),
        onChangeLanguage: jest.fn(),
        onPressLogout: jest.fn(),
        onPressHelp: jest.fn(),
        onPressAbout: jest.fn(),
        onPressCredits: jest.fn(),
      };

      expect(settingsData.isSoundEnabled).toBe(true);
    });

    it("should define hint modal type", () => {
      const hintData: GameModalTypes["hint"] = {
        hintCost: 10,
        userCoins: 100,
        onShowHint: jest.fn(),
      };

      expect(hintData.hintCost).toBe(10);
      expect(hintData.userCoins).toBe(100);
    });

    it("should define skip modal type", () => {
      const skipData: GameModalTypes["skip"] = {
        userCoins: 200,
        skipCost: 50,
        onSkipLevel: jest.fn(),
        onOpenShop: jest.fn(),
      };

      expect(skipData.skipCost).toBe(50);
    });

    it("should define instructions and credits as empty objects", () => {
      const instructions: GameModalTypes["instructions"] = {};
      const credits: GameModalTypes["credits"] = {};

      expect(Object.keys(instructions)).toHaveLength(0);
      expect(Object.keys(credits)).toHaveLength(0);
    });

    it("should define info modal type", () => {
      const infoData: GameModalTypes["info"] = {
        title: "Test Title",
        message: "Test message content",
        onConfirm: jest.fn(),
      };

      expect(infoData.title).toBe("Test Title");
      expect(infoData.message).toBe("Test message content");
    });

    it("should define coinShop modal type", () => {
      const coinShopData: GameModalTypes["coinShop"] = {
        products: [],
        firestoreProducts: [],
        currentCoins: 500,
        loading: false,
        error: null,
        onPurchaseProduct: jest.fn(),
        onWatchVideo: jest.fn(),
        onPayAndPlay: jest.fn(),
      };

      expect(coinShopData.currentCoins).toBe(500);
      expect(coinShopData.loading).toBe(false);
    });

    it("should define coinPurchaseFanfare modal type", () => {
      const fanfareData: GameModalTypes["coinPurchaseFanfare"] = {
        coinsPurchased: 1000,
        totalCoins: 3000,
      };

      expect(fanfareData.coinsPurchased).toBe(1000);
      expect(fanfareData.totalCoins).toBe(3000);
    });

    it("should define achievementUnlockFanfare modal type", () => {
      const achievementData: GameModalTypes["achievementUnlockFanfare"] = {
        coinsEarned: 50,
        totalCoins: 250,
        achievementNames: ["First Win"],
      };

      expect(achievementData.coinsEarned).toBe(50);
      expect(achievementData.totalCoins).toBe(250);
      expect(achievementData.achievementNames).toEqual(["First Win"]);
    });

    it("should define streakIncreaseFanfare modal type", () => {
      const streakData: GameModalTypes["streakIncreaseFanfare"] = {
        streakValue: 5,
        coinsAwarded: 50,
        totalCoins: 250,
        onContinue: jest.fn(),
      };

      expect(streakData.streakValue).toBe(5);
      expect(streakData.coinsAwarded).toBe(50);
      expect(streakData.totalCoins).toBe(250);
    });

    it("should define levelUpFanfare modal type", () => {
      const levelUpData: GameModalTypes["levelUpFanfare"] = {
        newLevel: 2,
        coinsAwarded: 50,
        totalCoins: 250,
        onContinue: jest.fn(),
      };

      expect(levelUpData.newLevel).toBe(2);
      expect(levelUpData.coinsAwarded).toBe(50);
      expect(levelUpData.totalCoins).toBe(250);
    });

    it("should define leaderboard modal type", () => {
      const leaderboardData: GameModalTypes["leaderboard"] = {
        currentUserId: "user-123",
      };

      expect(leaderboardData.currentUserId).toBe("user-123");
    });

    it("should define achievements modal type", () => {
      const achievementsData: GameModalTypes["achievements"] = {
        playerData: null,
      };

      expect(achievementsData.playerData).toBeNull();
    });

    it("should define stats modal type", () => {
      const statsData: GameModalTypes["stats"] = {
        playerData: null,
      };

      expect(statsData.playerData).toBeNull();
    });

    it("should define changePassword modal type", () => {
      const changePasswordData: GameModalTypes["changePassword"] = {
        onPasswordChanged: jest.fn(),
      };

      expect(typeof changePasswordData.onPasswordChanged).toBe("function");
    });

    it("should define updateUsername modal type", () => {
      const updateUsernameData: GameModalTypes["updateUsername"] = {
        currentUsername: "olduser",
        onUsernameUpdated: jest.fn(),
      };

      expect(updateUsernameData.currentUsername).toBe("olduser");
    });

    it("should define avatar modal types", () => {
      const avatarOptionsData: GameModalTypes["avatarOptions"] = {
        onAvatarSelected: jest.fn(),
      };

      const preloadedAvatarsData: GameModalTypes["preloadedAvatars"] = {
        onAvatarSelected: jest.fn(),
      };

      expect(typeof avatarOptionsData.onAvatarSelected).toBe("function");
      expect(typeof preloadedAvatarsData.onAvatarSelected).toBe("function");
    });

    it("should define fullProfileDetails modal type", () => {
      const profileData: GameModalTypes["fullProfileDetails"] = {
        playerData: {
          userId: "user-123",
          email: "test@example.com",
          username: "testuser",
          coins: 100,
          stats: {
            xp: 0,
            level: 10,
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            winRate: 0,
            averageGuesses: 0,
            totalScore: 0,
            highestLevelClassic: 0,
            gamesPlayed: 0,
            wins: 0,
            challengeWins: 0,
            winStreak: 0,
            totalWins: 0,
            totalGuessesInWins: 0,
            totalHintsUsed: 0,
          },
          progress: {
            classicIndex: 1,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          },
          unlockedAchievements: [],
          hasPurchasedApp: false,
        },
      };

      expect(profileData.playerData).toHaveProperty("username");
    });
  });

  describe("ModalDataType helper type", () => {
    it("should extract correct type for victory modal", () => {
      const victoryData: ModalDataType<"victory"> = {
        attempts: 2,
        coinsEarned: 75,
        guesses: [],
        onNext: jest.fn(),
      };

      expect(victoryData.attempts).toBe(2);
    });

    it("should extract correct type for settings modal", () => {
      const settingsData: ModalDataType<"settings"> = {
        isSoundEnabled: false,
        isHapticsEnabled: true,
        currentLanguage: "es",
        onToggleSound: jest.fn(),
        onToggleHaptics: jest.fn(),
        onChangeLanguage: jest.fn(),
        onPressLogout: jest.fn(),
        onPressHelp: jest.fn(),
        onPressAbout: jest.fn(),
        onPressCredits: jest.fn(),
      };

      expect(settingsData.currentLanguage).toBe("es");
    });
  });

  describe("ModalAction type", () => {
    it("should define OPEN_MODAL action", () => {
      const action: ModalAction = {
        type: "OPEN_MODAL",
        payload: {
          id: "test-1",
          type: "settings",
          data: {},
          priority: 1,
        },
      };

      expect(action.type).toBe("OPEN_MODAL");
      expect(action.payload.id).toBe("test-1");
    });

    it("should define CLOSE_MODAL action", () => {
      const action: ModalAction = {
        type: "CLOSE_MODAL",
        payload: "modal-to-close",
      };

      expect(action.type).toBe("CLOSE_MODAL");
      expect(action.payload).toBe("modal-to-close");
    });

    it("should define CLOSE_ALL_MODALS action", () => {
      const action: ModalAction = {
        type: "CLOSE_ALL_MODALS",
      };

      expect(action.type).toBe("CLOSE_ALL_MODALS");
    });

    it("should define UPDATE_MODAL_DATA action", () => {
      const action: ModalAction = {
        type: "UPDATE_MODAL_DATA",
        payload: {
          id: "modal-123",
          data: {newField: "value"},
        },
      };

      expect(action.type).toBe("UPDATE_MODAL_DATA");
      expect(action.payload.id).toBe("modal-123");
      expect(action.payload.data).toEqual({newField: "value"});
    });
  });

  describe("type compatibility", () => {
    it("should allow ModalInstance to be used in modals array", () => {
      const instances: ModalInstance[] = [
        {id: "1", type: "victory", data: {}, priority: 1},
        {id: "2", type: "loss", data: {}, priority: 2, persistent: true},
      ];

      expect(instances).toHaveLength(2);
    });

    it("should allow BaseModalProps to extend with custom props", () => {
      interface CustomModalProps extends BaseModalProps {
        customProp: string;
      }

      const props: CustomModalProps = {
        isVisible: true,
        onClose: jest.fn(),
        customProp: "custom value",
      };

      expect(props.customProp).toBe("custom value");
    });

    it("should allow ModalOptions to be passed to openModal", () => {
      const options: ModalOptions = {
        priority: 50,
        persistent: true,
        replace: false,
      };

      // Simulating the function signature
      const mockOpenModal = (type: string, data: ModalData, opts?: ModalOptions): string => {
        return `${type}-${opts?.priority || 0}`;
      };

      const result = mockOpenModal("test", {}, options);
      expect(result).toBe("test-50");
    });
  });
});
