/**
 * @fileoverview Unit tests for useModal hook.
 *
 * Tests the modal management hook's functions for opening, closing,
 * and querying modal state.
 */

import { renderHook, act } from "@testing-library/react-native";
import React from "react";
import { useModal } from "../useModal";
import { ModalProvider } from "../../contexts/ModalContext";

// Create a wrapper component that provides the modal context
const createWrapper = () => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement(ModalProvider, null, children);
  };
  return Wrapper;
};

describe("useModal", () => {
  describe("openModal", () => {
    it("should return a modal ID when opening a modal", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test", {});
      });

      expect(typeof modalId!).toBe("string");
      expect(modalId!.length).toBeGreaterThan(0);
    });

    it("should add modal to the modals array", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modals).toHaveLength(0);

      act(() => {
        result.current.openModal("test", {});
      });

      expect(result.current.modals).toHaveLength(1);
    });

    it("should open multiple modals", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("modal1", {});
        result.current.openModal("modal2", {});
        result.current.openModal("modal3", {});
      });

      expect(result.current.modals).toHaveLength(3);
    });
  });

  describe("closeModal", () => {
    it("should close a modal by ID", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test", {});
      });

      expect(result.current.modals).toHaveLength(1);

      act(() => {
        result.current.closeModal(modalId!);
      });

      expect(result.current.modals).toHaveLength(0);
    });

    it("should not throw when closing non-existent modal", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.closeModal("non-existent-id");
        });
      }).not.toThrow();
    });

    it("should only close the specified modal", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId1: string;
      let modalId2: string;
      act(() => {
        modalId1 = result.current.openModal("modal1", {});
        modalId2 = result.current.openModal("modal2", {});
      });

      expect(result.current.modals).toHaveLength(2);

      act(() => {
        result.current.closeModal(modalId1!);
      });

      expect(result.current.modals).toHaveLength(1);
      expect(result.current.modals[0].id).toBe(modalId2!);
    });
  });

  describe("closeModalByType", () => {
    it("should close a modal by type", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("settings", {});
      });

      expect(result.current.modals).toHaveLength(1);

      act(() => {
        result.current.closeModalByType("settings");
      });

      expect(result.current.modals).toHaveLength(0);
    });

    it("should not throw when closing non-existent type", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.closeModalByType("non-existent");
        });
      }).not.toThrow();
    });

    it("should only close the first modal of the specified type", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("duplicate", { index: 1 });
        result.current.openModal("duplicate", { index: 2 });
      });

      expect(result.current.modals).toHaveLength(2);

      act(() => {
        result.current.closeModalByType("duplicate");
      });

      expect(result.current.modals).toHaveLength(1);
    });
  });

  describe("closeAllModals", () => {
    it("should close all open modals", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("modal1", {});
        result.current.openModal("modal2", {});
        result.current.openModal("modal3", {});
      });

      expect(result.current.modals).toHaveLength(3);

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.modals).toHaveLength(0);
    });

    it("should not throw when no modals are open", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.closeAllModals();
        });
      }).not.toThrow();
    });
  });

  describe("isModalOpen", () => {
    it("should return true when modal type is open", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("settings", {});
      });

      expect(result.current.isModalOpen("settings")).toBe(true);
    });

    it("should return false when modal type is not open", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isModalOpen("settings")).toBe(false);
    });

    it("should return false after modal is closed", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("settings", {});
      });

      expect(result.current.isModalOpen("settings")).toBe(true);

      act(() => {
        result.current.closeModal(modalId!);
      });

      expect(result.current.isModalOpen("settings")).toBe(false);
    });
  });

  describe("getModalData", () => {
    it("should return modal data when modal is open", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      const testData = { foo: "bar", count: 42 };
      act(() => {
        result.current.openModal("test", testData);
      });

      const data = result.current.getModalData<typeof testData>("test");
      expect(data).toEqual(testData);
    });

    it("should return null when modal is not open", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      const data = result.current.getModalData("non-existent");
      expect(data).toBeNull();
    });
  });

  describe("updateModalData", () => {
    it("should update modal data", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test", { count: 0 });
      });

      act(() => {
        result.current.updateModalData(modalId!, { count: 10 });
      });

      const data = result.current.getModalData<{ count: number }>("test");
      expect(data?.count).toBe(10);
    });

    it("should not throw when updating non-existent modal", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.updateModalData("non-existent", { foo: "bar" });
        });
      }).not.toThrow();
    });
  });

  describe("convenience methods", () => {
    it("should have showVictoryModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showVictoryModal).toBe("function");
    });

    it("should have showLossModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showLossModal).toBe("function");
    });

    it("should have showSettingsModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showSettingsModal).toBe("function");
    });

    it("should have showHintModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showHintModal).toBe("function");
    });

    it("should have showWelcomeModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showWelcomeModal).toBe("function");
    });

    it("should have showInstructionsModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showInstructionsModal).toBe("function");
    });

    it("should have showCreditsModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showCreditsModal).toBe("function");
    });

    it("should have showCoinShopModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showCoinShopModal).toBe("function");
    });

    it("should have showGameModeModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showGameModeModal).toBe("function");
    });

    it("should have showInfoModal method", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.showInfoModal).toBe("function");
    });

    it("should open modals through all convenience wrapper methods", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showVictoryModal({} as any);
        result.current.showLossModal({} as any);
        result.current.showSettingsModal({} as any);
        result.current.showHintModal({} as any);
        result.current.showSkipModal({} as any);
        result.current.showWelcomeModal();
        result.current.showInstructionsModal();
        result.current.showCreditsModal();
        result.current.showCoinShopModal({} as any);
        result.current.showCoinPurchaseFanfareModal({} as any);
        result.current.showFullProfileDetailsModal({} as any);
        result.current.showChangePasswordModal({} as any);
        result.current.showUpdateUsernameModal({} as any);
        result.current.showAvatarOptionsModal({} as any);
        result.current.showPreloadedAvatarsModal({} as any);
        result.current.showGameModeModal({} as any);
        result.current.showInfoModal({} as any);
      });

      expect(result.current.isModalOpen("victory")).toBe(true);
      expect(result.current.isModalOpen("loss")).toBe(true);
      expect(result.current.isModalOpen("settings")).toBe(true);
      expect(result.current.isModalOpen("hint")).toBe(true);
      expect(result.current.isModalOpen("skip")).toBe(true);
      expect(result.current.isModalOpen("welcome")).toBe(true);
      expect(result.current.isModalOpen("instructions")).toBe(true);
      expect(result.current.isModalOpen("credits")).toBe(true);
      expect(result.current.isModalOpen("coinShop")).toBe(true);
      expect(result.current.isModalOpen("coinPurchaseFanfare")).toBe(true);
      expect(result.current.isModalOpen("fullProfileDetails")).toBe(true);
      expect(result.current.isModalOpen("changePassword")).toBe(true);
      expect(result.current.isModalOpen("updateUsername")).toBe(true);
      expect(result.current.isModalOpen("avatarOptions")).toBe(true);
      expect(result.current.isModalOpen("preloadedAvatars")).toBe(true);
      expect(result.current.isModalOpen("gameMode")).toBe(true);
      expect(result.current.isModalOpen("info")).toBe(true);
    });
  });

  describe("openGameModal", () => {
    it("should open a game modal with correct type", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openGameModal("victory", {
          answer: "TEST",
          guessCount: 3,
          earnedCoins: 10,
        });
      });

      expect(result.current.isModalOpen("victory")).toBe(true);
    });

    it("should return a modal ID", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      let modalId: string;
      act(() => {
        modalId = result.current.openGameModal("settings", {});
      });

      expect(typeof modalId!).toBe("string");
      expect(modalId!.length).toBeGreaterThan(0);
    });
  });

  describe("modals array", () => {
    it("should be initially empty", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modals).toEqual([]);
    });

    it("should contain modal objects with id and type", () => {
      const { result } = renderHook(() => useModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.openModal("test", {});
      });

      expect(result.current.modals[0]).toHaveProperty("id");
      expect(result.current.modals[0]).toHaveProperty("type");
      expect(result.current.modals[0].type).toBe("test");
    });
  });
});
