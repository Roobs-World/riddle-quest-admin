import React from "react";
import { BaseModalProps, ModalData } from "../../types/ModalTypes";

// Import all modal components
import VictoryModal from "./game/VictoryModal";
import LossModal from "./game/LossModal";
import OutOfAttemptsModal from "./game/OutOfAttemptsModal";
import WatchAdForChanceModal from "./game/WatchAdForChanceModal";
import DailyChallengeCompletionModal from "./game/DailyChallengeCompletionModal";

import SettingsModal from "./settings/SettingsModal";
import FullProfileDetailsModal from "./settings/FullProfileDetailsModal";
import ChangePasswordModal from "./settings/ChangePasswordModal";
import UpdateUsernameModal from "./settings/UpdateUsernameModal";
import AvatarOptionsModal from "./settings/AvatarOptionsModal";
import PreloadedAvatarsModal from "./settings/PreloadedAvatarsModal";

import HintModal from "./help/HintModal";
import SkipModal from "./help/SkipModal";
import WelcomeModal from "./help/WelcomeModal";
import InstructionsModal from "./help/InstructionsModal";

import CoinShopModal from "../shop/CoinShopModal";

// Modal wrapper component that adapts existing modals to the new system
const createModalWrapper = (
  ModalComponent: React.ComponentType<Record<string, unknown>>,
  propsMapper: (props: BaseModalProps & ModalData) => Record<string, unknown>
) => {
  const ModalWrapper = (props: BaseModalProps & ModalData) => {
    const mappedProps = propsMapper(props);
    return <ModalComponent {...mappedProps} />;
  };
  ModalWrapper.displayName = `ModalWrapper(${
    ModalComponent.displayName || ModalComponent.name || "Component"
  })`;
  return ModalWrapper;
};

// Create the modal registry with wrapped components
export const modalRegistry = {
  // Game modals
  victory: createModalWrapper(VictoryModal, (props: BaseModalProps & any) => ({
    ...props,
    visible: props.isVisible,
    onClose: props.onClose,
    onNextLevel: props.onNext,
    onHome: props.onHome,
    guesses: [],
  })),

  loss: createModalWrapper(LossModal, (props: BaseModalProps & any) => ({
    ...props,
    visible: props.isVisible,
    onClose: props.onClose,
    onRetry: props.onNext,
    onHome: props.onHome,
  })),

  outOfAttempts: createModalWrapper(
    OutOfAttemptsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  watchAdForChance: createModalWrapper(
    WatchAdForChanceModal,
    (props: BaseModalProps & any) => ({
      ...props,
      visible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  dailyChallengeCompletion: createModalWrapper(
    DailyChallengeCompletionModal,
    (props: BaseModalProps & any) => ({
      ...props,
      visible: props.isVisible,
      onClose: props.onClose,
      totalCoinsEarned: props.coinsEarned,
      onContinue: props.onContinue,
      onHome: props.onHome,
    })
  ),

  // Settings modals
  settings: createModalWrapper(
    SettingsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  fullProfileDetails: createModalWrapper(
    FullProfileDetailsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  changePassword: createModalWrapper(
    ChangePasswordModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
      onPasswordChanged: props.onPasswordChanged,
    })
  ),

  updateUsername: createModalWrapper(
    UpdateUsernameModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
      onUsernameUpdated: props.onUsernameUpdated,
    })
  ),

  avatarOptions: createModalWrapper(
    AvatarOptionsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected: props.onAvatarSelected,
      onOpenPreloadedAvatars: () => {},
      userId: "",
    })
  ),

  preloadedAvatars: createModalWrapper(
    PreloadedAvatarsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected: props.onAvatarSelected,
      onCloseAvatarOptions: props.onClose,
    })
  ),

  // Help modals
  hint: createModalWrapper(HintModal, (props: BaseModalProps & any) => ({
    ...props,
    isVisible: props.isVisible,
    onClose: props.onClose,
    onShowHint: props.onShowHint,
  })),

  skip: createModalWrapper(SkipModal, (props: BaseModalProps & any) => ({
    ...props,
    isVisible: props.isVisible,
    onClose: props.onClose,
    onShowHint: props.onShowHint,
    skipCost: props.skipCost,
  })),

  welcome: createModalWrapper(WelcomeModal, (props: BaseModalProps & any) => ({
    ...props,
    isVisible: props.isVisible,
    onClose: props.onClose,
  })),

  instructions: createModalWrapper(
    InstructionsModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  // Shop modals
  coinShop: createModalWrapper(
    CoinShopModal,
    (props: BaseModalProps & any) => ({
      ...props,
      isVisible: props.isVisible,
      onClose: props.onClose,
      products: props.products || [],
      loading: props.loading || false,
      error: props.error || null,
      onPurchaseProduct: props.onPurchaseProduct,
    })
  ),
};

// Helper function to get modal component by type
export const getModalComponent = (type: string) => {
  const modalComponent = modalRegistry[type];
  if (!modalComponent) {
    console.warn(`Modal type "${type}" not found in registry`);
    return null;
  }
  return modalComponent;
};

// Helper function to check if modal type is registered
export const isModalRegistered = (type: string): boolean => {
  return type in modalRegistry;
};
