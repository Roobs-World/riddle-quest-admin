import React from "react";
import { BaseModalProps, ModalData } from "../../types/ModalTypes";
import { SubmittedGuess } from "../../hooks/types";
import { Player } from "../../validation/firestoreSchemas";
import * as RNIap from "react-native-iap";

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

// Generic modal wrapper component that adapts existing modals to the new system
const createModalWrapper = <TProps extends Record<string, unknown>>(
  ModalComponent: React.ComponentType<TProps>,
  propsMapper: (props: BaseModalProps & ModalData) => TProps
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

// Define the type for modal registry entries
type ModalRegistryEntry = {
  (props: BaseModalProps & ModalData): React.JSX.Element;
  displayName: string;
};

// Create the modal registry with wrapped components
export const modalRegistry: Record<string, ModalRegistryEntry> = {
  // Game modals
  victory: createModalWrapper(
    VictoryModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      attempts: (props.attempts as number) || 0,
      coinsEarned: (props.coinsEarned as number) || 0,
      onNextLevel: (props.onNext as () => void) || (() => {}),
      onHome: (props.onHome as () => void) || (() => {}),
      guesses: (props.guesses as SubmittedGuess[]) || [],
    })
  ),

  loss: createModalWrapper(LossModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    correctAnswer: (props.correctAnswer as string) || "",
    onRetry: (props.onNext as () => void) || (() => {}),
    onHome: (props.onHome as () => void) || (() => {}),
  })),

  outOfAttempts: createModalWrapper(
    OutOfAttemptsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      userCoins: (props.userCoins as number) || 0,
      continueCost: (props.continueCost as number) || 0,
      onWatchAd: (props.onWatchAd as () => void) || (() => {}),
      onSpendCoins: (props.onSpendCoins as () => void) || (() => {}),
      onClose: props.onClose,
    })
  ),

  watchAdForChance: createModalWrapper(
    WatchAdForChanceModal,
    (props: BaseModalProps & ModalData) => ({
      visible: props.isVisible,
      onClose: props.onClose,
      onWatchAd: (props.onWatchAd as () => void) || (() => {}),
    })
  ),

  dailyChallengeCompletion: createModalWrapper(
    DailyChallengeCompletionModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      questionsCompleted: (props.questionsCompleted as number) || 0,
      totalQuestions: (props.totalQuestions as number) || 5,
      totalCoinsEarned: (props.coinsEarned as number) || 0,
      onContinue: (props.onContinue as () => void) || (() => {}),
      onHome: (props.onHome as () => void) || (() => {}),
      onClose: props.onClose,
    })
  ),

  // Settings modals
  settings: createModalWrapper(
    SettingsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      isSoundEnabled: (props.isSoundEnabled as boolean) || false,
      isHapticsEnabled: (props.isHapticsEnabled as boolean) || false,
      onToggleSound:
        (props.onToggleSound as (enabled: boolean) => void) || (() => {}),
      onToggleHaptics:
        (props.onToggleHaptics as (enabled: boolean) => void) || (() => {}),
      onPressLogout: (props.onPressLogout as () => void) || (() => {}),
      onPressHelp: (props.onPressHelp as () => void) || (() => {}),
      onPressCredits: (props.onPressCredits as () => void) || (() => {}),
    })
  ),

  fullProfileDetails: createModalWrapper(
    FullProfileDetailsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      playerData: (props.playerData as Player) || null,
    })
  ),

  changePassword: createModalWrapper(
    ChangePasswordModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onPasswordChanged: (props.onPasswordChanged as () => void) || (() => {}),
    })
  ),

  updateUsername: createModalWrapper(
    UpdateUsernameModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      currentUsername: (props.currentUsername as string) || "",
      onUsernameUpdated:
        (props.onUsernameUpdated as (username: string) => void) || (() => {}),
    })
  ),

  avatarOptions: createModalWrapper(
    AvatarOptionsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected:
        (props.onAvatarSelected as (url: string) => void) || (() => {}),
      onOpenPreloadedAvatars:
        (props.onOpenPreloadedAvatars as () => void) || (() => {}),
      userId: (props.userId as string) || "",
    })
  ),

  preloadedAvatars: createModalWrapper(
    PreloadedAvatarsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected:
        (props.onAvatarSelected as (url: string) => void) || (() => {}),
      onCloseAvatarOptions: props.onClose,
    })
  ),

  // Help modals
  hint: createModalWrapper(HintModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    onClose: props.onClose,
    userCoins: (props.userCoins as number) || 0,
    hintCost: (props.hintCost as number) || 0,
    onShowHint: (props.onShowHint as () => void) || (() => {}),
  })),

  skip: createModalWrapper(SkipModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    onClose: props.onClose,
    userCoins: (props.userCoins as number) || 0,
    skipCost: (props.skipCost as number) || 0,
    onSkipLevel: (props.onSkipLevel as () => void) || (() => {}),
  })),

  welcome: createModalWrapper(
    WelcomeModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  instructions: createModalWrapper(
    InstructionsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  // Shop modals
  coinShop: createModalWrapper(
    CoinShopModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      products: (props.products as RNIap.Product[]) || [],
      loading: (props.loading as boolean) || false,
      error: (props.error as string | null) || null,
      onPurchaseProduct:
        (props.onPurchaseProduct as (productId: string) => void) || (() => {}),
    })
  ),
};

// Helper function to get modal component by type
export const getModalComponent = (type: string): ModalRegistryEntry | null => {
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
