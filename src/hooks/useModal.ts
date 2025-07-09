import { useCallback } from "react";
import { useModalContext } from "../contexts/ModalContext";
import {
  ModalData,
  ModalOptions,
  GameModalTypes,
  ModalDataType,
} from "../types/ModalTypes";

// Custom hook for modal management
export const useModal = () => {
  const context = useModalContext();

  // Type-safe modal opening for game modals
  const openGameModal = useCallback(
    <T extends keyof GameModalTypes>(
      type: T,
      data: ModalDataType<T>,
      options?: ModalOptions
    ): string => {
      return context.openModal(type, data, options);
    },
    [context]
  );

  // Generic modal opening
  const openModal = useCallback(
    <T extends ModalData>(
      type: string,
      data?: T,
      options?: ModalOptions
    ): string => {
      return context.openModal(type, data, options);
    },
    [context]
  );

  // Close modal by ID
  const closeModal = useCallback(
    (id: string): void => {
      context.closeModal(id);
    },
    [context]
  );

  // Close modal by type (closes the first modal of that type)
  const closeModalByType = useCallback(
    (type: string): void => {
      const modal = context.modals.find((m) => m.type === type);
      if (modal) {
        context.closeModal(modal.id);
      }
    },
    [context]
  );

  // Close all modals
  const closeAllModals = useCallback((): void => {
    context.closeAllModals();
  }, [context]);

  // Check if modal is open
  const isModalOpen = useCallback(
    (type: string): boolean => {
      return context.isModalOpen(type);
    },
    [context]
  );

  // Get modal data
  const getModalData = useCallback(
    <T extends ModalData>(type: string): T | null => {
      return context.getModalData<T>(type);
    },
    [context]
  );

  // Update modal data
  const updateModalData = useCallback(
    <T extends ModalData>(id: string, data: Partial<T>): void => {
      context.updateModalData(id, data);
    },
    [context]
  );

  // Convenience methods for common modal operations
  const showVictoryModal = useCallback(
    (data: ModalDataType<"victory">, options?: ModalOptions): string => {
      return openGameModal("victory", data, options);
    },
    [openGameModal]
  );

  const showLossModal = useCallback(
    (data: ModalDataType<"loss">, options?: ModalOptions): string => {
      return openGameModal("loss", data, options);
    },
    [openGameModal]
  );

  const showOutOfAttemptsModal = useCallback(
    (data: ModalDataType<"outOfAttempts">, options?: ModalOptions): string => {
      return openGameModal("outOfAttempts", data, options);
    },
    [openGameModal]
  );

  const showSettingsModal = useCallback(
    (data: ModalDataType<"settings">, options?: ModalOptions): string => {
      return openGameModal("settings", data, options);
    },
    [openGameModal]
  );

  const showHintModal = useCallback(
    (data: ModalDataType<"hint">, options?: ModalOptions): string => {
      return openGameModal("hint", data, options);
    },
    [openGameModal]
  );

  const showSkipModal = useCallback(
    (data: ModalDataType<"skip">, options?: ModalOptions): string => {
      return openGameModal("skip", data, options);
    },
    [openGameModal]
  );

  const showWelcomeModal = useCallback(
    (data: ModalDataType<"welcome"> = {}, options?: ModalOptions): string => {
      return openGameModal("welcome", data, options);
    },
    [openGameModal]
  );

  const showInstructionsModal = useCallback(
    (
      data: ModalDataType<"instructions"> = {},
      options?: ModalOptions
    ): string => {
      return openGameModal("instructions", data, options);
    },
    [openGameModal]
  );

  const showCreditsModal = useCallback(
    (data: ModalDataType<"credits"> = {}, options?: ModalOptions): string => {
      return openGameModal("credits", data, options);
    },
    [openGameModal]
  );

  const showCoinShopModal = useCallback(
    (data: ModalDataType<"coinShop">, options?: ModalOptions): string => {
      return openGameModal("coinShop", data, options);
    },
    [openGameModal]
  );

  const showFullProfileDetailsModal = useCallback(
    (
      data: ModalDataType<"fullProfileDetails">,
      options?: ModalOptions
    ): string => {
      return openGameModal("fullProfileDetails", data, options);
    },
    [openGameModal]
  );

  const showWatchAdForChanceModal = useCallback(
    (
      data: ModalDataType<"watchAdForChance">,
      options?: ModalOptions
    ): string => {
      return openGameModal("watchAdForChance", data, options);
    },
    [openGameModal]
  );

  const showDailyChallengeCompletionModal = useCallback(
    (
      data: ModalDataType<"dailyChallengeCompletion">,
      options?: ModalOptions
    ): string => {
      return openGameModal("dailyChallengeCompletion", data, options);
    },
    [openGameModal]
  );

  const showChangePasswordModal = useCallback(
    (data: ModalDataType<"changePassword">, options?: ModalOptions): string => {
      return openGameModal("changePassword", data, options);
    },
    [openGameModal]
  );

  const showUpdateUsernameModal = useCallback(
    (data: ModalDataType<"updateUsername">, options?: ModalOptions): string => {
      return openGameModal("updateUsername", data, options);
    },
    [openGameModal]
  );

  const showAvatarOptionsModal = useCallback(
    (data: ModalDataType<"avatarOptions">, options?: ModalOptions): string => {
      return openGameModal("avatarOptions", data, options);
    },
    [openGameModal]
  );

  const showPreloadedAvatarsModal = useCallback(
    (
      data: ModalDataType<"preloadedAvatars">,
      options?: ModalOptions
    ): string => {
      return openGameModal("preloadedAvatars", data, options);
    },
    [openGameModal]
  );

  return {
    // Core modal functions
    openModal,
    openGameModal,
    closeModal,
    closeModalByType,
    closeAllModals,
    isModalOpen,
    getModalData,
    updateModalData,

    // Current active modals
    modals: context.modals,

    // Convenience methods
    showVictoryModal,
    showLossModal,
    showOutOfAttemptsModal,
    showSettingsModal,
    showHintModal,
    showSkipModal,
    showWelcomeModal,
    showInstructionsModal,
    showCreditsModal,
    showCoinShopModal,
    showFullProfileDetailsModal,
    showWatchAdForChanceModal,
    showDailyChallengeCompletionModal,
    showChangePasswordModal,
    showUpdateUsernameModal,
    showAvatarOptionsModal,
    showPreloadedAvatarsModal,
  };
};

export default useModal;
