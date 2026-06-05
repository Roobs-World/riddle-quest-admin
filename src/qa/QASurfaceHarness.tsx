import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Linking, StyleSheet, Text, View} from "react-native";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import StarryBackground from "../components/background/StarryBackground";
import GlobalMuteOverlay from "../components/overlays/GlobalMuteOverlay";
import TooltipOverlay from "../components/tooltips/TooltipOverlay";
import DeleteAccountConfirmationModal from "../components/modals/settings/DeleteAccountConfirmationModal";
import SettingsModal from "../components/modals/settings/SettingsModal";
import UpgradeAccountModal from "../components/modals/settings/UpgradeAccountModal";
import OfflineBlockingModal from "../components/modals/system/OfflineBlockingModal";
import {getModalComponent} from "../components/modals/ModalRegistry";
import {generateMockData} from "../components/development/ModalTogglePanel";
import {t, getLocale} from "../i18n";
import {HINT_COST_COINS} from "../constants/game";
import type {ModalData, ModalSequenceProgress} from "../types/ModalTypes";
import type {Player} from "../validation/firestoreSchemas";
import {styles as appStyles, SPACING, TYPOGRAPHY} from "../styles";
import {useModalContext} from "../contexts/ModalContext";
import {
  QA_MODAL_SURFACE_TO_REGISTRY_TYPE,
  QA_SURFACES,
  getQASurface,
  isQASurfaceId,
  type QASurfaceId,
} from "./qaSurfaces";
import {setQASurfaceRuntimeActive} from "./qaRuntime";

const SURFACE_QUERY_PATTERN = /[?&]surface=([^&]+)/;
const QA_PATH_PATTERN = /:\/\/qa\/?([^?]*)/;

const noop = () => {};
const noopBoolean = () => {};
const noopLanguage = () => {};

const authNavigation = {
  navigate: noop,
};

const qaPlayer: Player = {
  userId: "qa-user-123",
  username: "QATester",
  email: "qa@example.com",
  coins: 150,
  progress: {
    classicIndex: 7,
    dailyChallengeIndex: 2,
    dailyChallengeCurrentQuestion: 0,
  },
  stats: {
    xp: 240,
    level: 3,
    gamesPlayed: 11,
    wins: 7,
    totalScore: 240,
    bestStreak: 4,
    winStreak: 2,
    averageGuesses: 3.4,
    dailyPuzzlesCompleted: 3,
    totalWordsGuessed: 36,
    winRate: 64,
    highestLevelClassic: 7,
    challengeWins: 2,
    totalWins: 7,
    totalGuessesInWins: 24,
    totalHintsUsed: 5,
  },
  avatarUrl: "https://example.com/qa-avatar.jpg",
  createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  lastLogin: Date.now(),
  hasPurchasedApp: false,
  unlockedAchievements: [
    {achievementId: "first_win", unlockedAt: Date.now() - 3 * 24 * 60 * 60 * 1000},
    {achievementId: "streak_3", unlockedAt: Date.now() - 24 * 60 * 60 * 1000},
  ],
};

const extractSurfaceId = (url: string | null): QASurfaceId | null => {
  if (!url) {
    return null;
  }

  const queryMatch = url.match(SURFACE_QUERY_PATTERN);
  const querySurface = queryMatch ? decodeURIComponent(queryMatch[1]) : null;
  if (querySurface && isQASurfaceId(querySurface)) {
    return querySurface;
  }

  const pathMatch = url.match(QA_PATH_PATTERN);
  const pathSurface = pathMatch?.[1]?.replace(/^\/+|\/+$/g, "");
  if (pathSurface && isQASurfaceId(pathSurface)) {
    return pathSurface;
  }

  return null;
};

const SurfaceMarker = ({surfaceId}: {surfaceId: QASurfaceId}) => (
  <Text accessibilityLabel={`${t("TestStrings.QA_SURFACE_PREFIX")}:${surfaceId}`} style={qaStyles.surfaceMarker}>
    {`${t("TestStrings.QA_SURFACE_PREFIX")}:${surfaceId}`}
  </Text>
);

const wrapSurface = (surfaceId: QASurfaceId, content: React.ReactNode) => (
  <View collapsable={false} style={qaStyles.root} testID={`qa-surface-${surfaceId}`}>
    <SurfaceMarker surfaceId={surfaceId} />
    {content}
  </View>
);

const renderInitializationError = () => (
  <View style={appStyles.errorContainer}>
    <Text style={[appStyles.title, {color: "#FFFFFF", fontSize: TYPOGRAPHY.fontSize["2xl"], marginBottom: SPACING.md}]}>
      {t("GameScreenAlerts.QA_RIDDLE_DATABASE_UNAVAILABLE_TITLE")}
    </Text>
    <Text style={[appStyles.subtitle, {color: "#FFFFFF", textAlign: "center", marginBottom: SPACING.lg}]}>
      {t("GameScreenAlerts.QA_RIDDLE_DATABASE_UNAVAILABLE_MESSAGE")}
    </Text>
    <Text style={[appStyles.buttonText, {color: "#FFFFFF"}]}>{t("CommonButtons.RETRY")}</Text>
  </View>
);

const renderLoadingSurface = () => (
  <View style={qaStyles.centered}>
    <StarryBackground />
    <PulsingSpinner visible={true} size={120} opacity={0.8} />
  </View>
);

const renderGameSurface = () => (
  <GameScreen
    riddleId="qa-orchard"
    riddleText="I grow in rows and fill baskets when autumn arrives."
    answer="ORCHARD"
    answerLength={7}
    userCoins={qaPlayer.coins}
    hintCost={HINT_COST_COINS}
    onGameWin={noop}
    onGameLoss={noop}
    onHintUsed={() => ["A place where fruit trees grow."]}
    onSkipUsed={noop}
    onNextLevel={noop}
    gameMode="classic"
    suppressOnboarding={true}
  />
);

const qaSequenceProgress = (primaryActionText: string): ModalSequenceProgress => ({
  currentPopupIndex: 1,
  totalPopups: 4,
  hasNextPopup: true,
  primaryActionText,
});

const getModalSurfaceOverrides = (surfaceId: QASurfaceId): ModalData => {
  switch (surfaceId) {
    case "modal-welcome-onboarding-progress":
      return {
        onboardingProgress: {current: 1, total: 3},
      };
    case "modal-instructions-onboarding-progress":
      return {
        onboardingProgress: {current: 3, total: 3},
      };
    case "modal-info-onboarding-upgrade-action":
      return {
        title: t("GameScreenAlerts.GUEST_MODE_NOTICE_TITLE"),
        message: t("GameScreenAlerts.GUEST_MODE_SAVED_ON_DEVICE_MESSAGE"),
        actionButtonText: t("Profile.UPGRADE_ACCOUNT_BUTTON"),
        onAction: noop,
        onboardingProgress: {current: 2, total: 3},
      };
    case "modal-hint-insufficient-coins":
      return {
        userCoins: 5,
        hintCost: HINT_COST_COINS,
        onOpenShop: noop,
      };
    case "modal-skip-insufficient-coins":
      return {
        userCoins: 5,
        totalCoins: 5,
        skipCost: 50,
        onOpenShop: noop,
      };
    case "modal-loss-no-continue-options":
      return {
        correctAnswer: "HIDDEN",
        totalCoins: 0,
        canWatchAd: false,
        canUseCoin: false,
        onWatchAdContinue: undefined,
        onCoinContinue: undefined,
        onOpenShop: noop,
      };
    case "modal-loss-coin-continue":
      return {
        correctAnswer: "HIDDEN",
        totalCoins: 150,
        coinContinueCost: 25,
        canWatchAd: false,
        canUseCoin: true,
        onWatchAdContinue: undefined,
        onCoinContinue: noop,
        onOpenShop: noop,
      };
    case "modal-coin-shop-loading":
      return {
        products: [],
        firestoreProducts: [],
        currentCoins: qaPlayer.coins,
        loading: true,
        error: null,
      };
    case "modal-coin-shop-error":
      return {
        products: [],
        firestoreProducts: [],
        currentCoins: qaPlayer.coins,
        loading: false,
        error: t("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS"),
      };
    case "modal-coin-shop-empty":
      return {
        products: [],
        firestoreProducts: [],
        currentCoins: qaPlayer.coins,
        loading: false,
        error: null,
      };
    case "modal-victory-sequence":
      return {
        sequenceProgress: qaSequenceProgress(t("VictoryModal.NEXT_LEVEL_BUTTON")),
      };
    case "modal-achievement-unlock-fanfare-sequence":
      return {
        sequenceProgress: qaSequenceProgress(t("Achievements.NICE_BUTTON")),
      };
    case "modal-streak-increase-fanfare-sequence":
      return {
        sequenceProgress: qaSequenceProgress(t("StreakFanfare.CONTINUE_BUTTON")),
      };
    case "modal-level-up-fanfare-sequence":
      return {
        sequenceProgress: qaSequenceProgress(t("LevelUpFanfare.CONTINUE_BUTTON")),
      };
    default:
      return {};
  }
};

const renderRegistryModalSurface = (surfaceId: QASurfaceId) => {
  const modalType = QA_MODAL_SURFACE_TO_REGISTRY_TYPE[surfaceId as keyof typeof QA_MODAL_SURFACE_TO_REGISTRY_TYPE];
  const ModalComponent = modalType ? getModalComponent(modalType) : null;
  if (!ModalComponent) {
    return renderInitializationError();
  }

  const mockModalData = {
    ...generateMockData(modalType, undefined, qaPlayer, () => false),
  } as ModalData & {
    __fetchServerData?: unknown;
  };
  delete mockModalData.__fetchServerData;
  const modalData = {
    ...mockModalData,
    ...getModalSurfaceOverrides(surfaceId),
  };

  return (
    <>
      <StarryBackground />
      <ModalComponent isVisible={true} onClose={noop} {...modalData} />
    </>
  );
};

const renderDeleteAccountConfirmationSurface = () => (
  <>
    <StarryBackground />
    <DeleteAccountConfirmationModal isVisible={true} isDeleting={false} onCancel={noop} onConfirm={noop} />
  </>
);

const renderOfflineBlockingSurface = () => (
  <>
    <StarryBackground />
    <OfflineBlockingModal isVisible={true} />
  </>
);

const renderSettingsLanguagePickerSurface = () => (
  <>
    <StarryBackground />
    <SettingsModal
      isVisible={true}
      onClose={noop}
      isSoundEnabled={true}
      onToggleSound={noopBoolean}
      isHapticsEnabled={false}
      onToggleHaptics={noopBoolean}
      currentLanguage={getLocale()}
      onChangeLanguage={noopLanguage}
      onPressHelp={noop}
      onPressAbout={noop}
      onPressLogout={noop}
      onPressCredits={noop}
      initialLanguagePickerOpen={true}
    />
  </>
);

const renderUpgradeExistingAccountSurface = () => (
  <>
    <StarryBackground />
    <UpgradeAccountModal isVisible={true} onClose={noop} initialExistingAccountPromptVisible={true} />
  </>
);

const renderSubmitTooltipSurface = () => (
  <View style={qaStyles.centered}>
    <StarryBackground />
    <View style={qaStyles.tooltipTarget}>
      <Text style={qaStyles.tooltipTargetText}>{t("GameScreenAlerts.SUBMIT_BUTTON")}</Text>
    </View>
    <TooltipOverlay
      visible={true}
      targetRect={{x: 120, y: 420, width: 140, height: 48}}
      content={{
        title: t("Tooltips.SUBMIT_ANSWER_TITLE"),
        body: t("Tooltips.SUBMIT_ANSWER_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      }}
      onDismiss={noop}
    />
  </View>
);

const renderGlobalMuteOverlaySurface = () => (
  <View style={qaStyles.centered}>
    <StarryBackground />
    <GlobalMuteOverlay isSoundEnabled={true} onToggleSound={noopBoolean} />
  </View>
);

export const QA_SURFACE_RENDERERS: Record<QASurfaceId, () => React.ReactNode> = {
  "page-app-loading": renderLoadingSurface,
  "page-landing": () => <LandingScreen />,
  "page-login": () => <LoginScreen navigation={authNavigation} />,
  "page-sign-up": () => <SignUpScreen navigation={authNavigation} />,
  "page-forgot-password": () => <ForgotPasswordScreen navigation={authNavigation} />,
  "page-new-password": () => <NewPasswordScreen />,
  "page-riddle-loading": renderLoadingSurface,
  "page-initialization-error": renderInitializationError,
  "page-game": renderGameSurface,
  "modal-welcome": () => renderRegistryModalSurface("modal-welcome"),
  "modal-welcome-back": () => renderRegistryModalSurface("modal-welcome-back"),
  "modal-instructions": () => renderRegistryModalSurface("modal-instructions"),
  "modal-info": () => renderRegistryModalSurface("modal-info"),
  "modal-hint": () => renderRegistryModalSurface("modal-hint"),
  "modal-skip": () => renderRegistryModalSurface("modal-skip"),
  "modal-victory": () => renderRegistryModalSurface("modal-victory"),
  "modal-loss": () => renderRegistryModalSurface("modal-loss"),
  "modal-coin-shop": () => renderRegistryModalSurface("modal-coin-shop"),
  "modal-coin-purchase-fanfare": () => renderRegistryModalSurface("modal-coin-purchase-fanfare"),
  "modal-achievement-unlock-fanfare": () => renderRegistryModalSurface("modal-achievement-unlock-fanfare"),
  "modal-streak-increase-fanfare": () => renderRegistryModalSurface("modal-streak-increase-fanfare"),
  "modal-level-up-fanfare": () => renderRegistryModalSurface("modal-level-up-fanfare"),
  "modal-settings": () => renderRegistryModalSurface("modal-settings"),
  "modal-full-profile-details": () => renderRegistryModalSurface("modal-full-profile-details"),
  "modal-upgrade-account": () => renderRegistryModalSurface("modal-upgrade-account"),
  "modal-update-username": () => renderRegistryModalSurface("modal-update-username"),
  "modal-achievements": () => renderRegistryModalSurface("modal-achievements"),
  "modal-stats": () => renderRegistryModalSurface("modal-stats"),
  "modal-leaderboard": () => renderRegistryModalSurface("modal-leaderboard"),
  "modal-credits": () => renderRegistryModalSurface("modal-credits"),
  "modal-about-legal": () => renderRegistryModalSurface("modal-about-legal"),
  "modal-welcome-onboarding-progress": () => renderRegistryModalSurface("modal-welcome-onboarding-progress"),
  "modal-instructions-onboarding-progress": () => renderRegistryModalSurface("modal-instructions-onboarding-progress"),
  "modal-info-onboarding-upgrade-action": () => renderRegistryModalSurface("modal-info-onboarding-upgrade-action"),
  "modal-hint-insufficient-coins": () => renderRegistryModalSurface("modal-hint-insufficient-coins"),
  "modal-skip-insufficient-coins": () => renderRegistryModalSurface("modal-skip-insufficient-coins"),
  "modal-loss-no-continue-options": () => renderRegistryModalSurface("modal-loss-no-continue-options"),
  "modal-loss-coin-continue": () => renderRegistryModalSurface("modal-loss-coin-continue"),
  "modal-coin-shop-loading": () => renderRegistryModalSurface("modal-coin-shop-loading"),
  "modal-coin-shop-error": () => renderRegistryModalSurface("modal-coin-shop-error"),
  "modal-coin-shop-empty": () => renderRegistryModalSurface("modal-coin-shop-empty"),
  "modal-victory-sequence": () => renderRegistryModalSurface("modal-victory-sequence"),
  "modal-achievement-unlock-fanfare-sequence": () =>
    renderRegistryModalSurface("modal-achievement-unlock-fanfare-sequence"),
  "modal-streak-increase-fanfare-sequence": () => renderRegistryModalSurface("modal-streak-increase-fanfare-sequence"),
  "modal-level-up-fanfare-sequence": () => renderRegistryModalSurface("modal-level-up-fanfare-sequence"),
  "modal-settings-language-picker": renderSettingsLanguagePickerSurface,
  "modal-upgrade-account-existing-account": renderUpgradeExistingAccountSurface,
  "modal-delete-account-confirmation": renderDeleteAccountConfirmationSurface,
  "modal-offline-blocking": renderOfflineBlockingSurface,
  "popup-tooltip-submit-answer": renderSubmitTooltipSurface,
  "popup-global-mute-overlay": renderGlobalMuteOverlaySurface,
};

const QASurfaceHarness = ({surfaceId}: {surfaceId: QASurfaceId}) => {
  const surface = getQASurface(surfaceId);
  const content = useMemo(() => QA_SURFACE_RENDERERS[surface.id](), [surface.id]);

  return wrapSurface(surface.id, content);
};

export const QASurfaceGate = ({children}: {children: React.ReactNode}) => {
  const {closeAllModals} = useModalContext();
  const [surfaceState, setSurfaceState] = useState<{
    id: QASurfaceId;
    nonce: number;
  } | null>(null);

  const setNextSurfaceId = useCallback(
    (nextSurfaceId: QASurfaceId) => {
      closeAllModals();
      setQASurfaceRuntimeActive(true);
      setSurfaceState((currentSurfaceState) => ({
        id: nextSurfaceId,
        nonce: (currentSurfaceState?.nonce ?? 0) + 1,
      }));
    },
    [closeAllModals],
  );

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    let isMounted = true;
    void Linking.getInitialURL().then((initialUrl) => {
      if (!isMounted) {
        return;
      }
      const nextSurfaceId = extractSurfaceId(initialUrl);
      if (nextSurfaceId) {
        setNextSurfaceId(nextSurfaceId);
      }
    });

    const subscription = Linking.addEventListener("url", ({url}) => {
      const nextSurfaceId = extractSurfaceId(url);
      if (nextSurfaceId) {
        setNextSurfaceId(nextSurfaceId);
      }
    });

    return () => {
      isMounted = false;
      setQASurfaceRuntimeActive(false);
      subscription.remove();
    };
  }, [setNextSurfaceId]);

  if (__DEV__ && surfaceState) {
    return <QASurfaceHarness key={`${surfaceState.id}-${surfaceState.nonce}`} surfaceId={surfaceState.id} />;
  }

  return <>{children}</>;
};

export const QA_SURFACE_COUNT = QA_SURFACES.length;

export default QASurfaceHarness;

const qaStyles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: "#080A1A",
    flex: 1,
    justifyContent: "center",
  },
  root: {
    flex: 1,
  },
  surfaceMarker: {
    color: "transparent",
    fontSize: 1,
    height: 1,
    left: 0,
    opacity: 0.01,
    position: "absolute",
    top: 0,
    width: 1,
    zIndex: 9999,
  },
  tooltipTarget: {
    alignItems: "center",
    backgroundColor: "#FCFAF4",
    borderColor: "#F4C542",
    borderRadius: 12,
    borderWidth: 2,
    height: 48,
    justifyContent: "center",
    width: 140,
  },
  tooltipTargetText: {
    color: "#1A1A1A",
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
});
