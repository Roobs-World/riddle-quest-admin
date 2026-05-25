import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import StarryBackground from "../components/background/StarryBackground";
import DeleteAccountConfirmationModal from "../components/modals/settings/DeleteAccountConfirmationModal";
import OfflineBlockingModal from "../components/modals/system/OfflineBlockingModal";
import { getModalComponent } from "../components/modals/ModalRegistry";
import { generateMockData } from "../components/development/ModalTogglePanel";
import { ModalData } from "../types/ModalTypes";
import type { Player } from "../validation/firestoreSchemas";
import { styles as appStyles, SPACING, TYPOGRAPHY } from "../styles";
import { HINT_COST_COINS } from "../constants/game";
import { useModalContext } from "../contexts/ModalContext";
import {
  QA_MODAL_SURFACE_TO_REGISTRY_TYPE,
  QA_SURFACES,
  getQASurface,
  isQASurfaceId,
  type QASurfaceId,
} from "./qaSurfaces";
import { setQASurfaceRuntimeActive } from "./qaRuntime";

type RootStackParamList = {
  Landing: object | undefined;
  Login: object | undefined;
  SignUp: object | undefined;
  ForgotPassword: object | undefined;
  NewPassword: object | undefined;
};

const SURFACE_QUERY_PATTERN = /[?&]surface=([^&]+)/;
const QA_PATH_PATTERN = /:\/\/qa\/?([^?]*)/;

const noop = () => {};

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
    { achievementId: "first_win", unlockedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    { achievementId: "streak_3", unlockedAt: Date.now() - 24 * 60 * 60 * 1000 },
  ],
};

const mockNavigation = {
  navigate: noop,
  goBack: noop,
  canGoBack: () => true,
  dispatch: noop,
  setOptions: noop,
  addListener: () => noop,
  removeListener: noop,
  isFocused: () => true,
  getId: () => undefined,
  getParent: () => undefined,
  getState: () => ({ key: "qa", index: 0, routeNames: [], routes: [] }),
  reset: noop,
  setParams: noop,
} as unknown as NativeStackNavigationProp<RootStackParamList>;

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

const SurfaceMarker = ({ surfaceId }: { surfaceId: QASurfaceId }) => (
  <Text
    accessibilityLabel={`qa-surface:${surfaceId}`}
    style={qaStyles.surfaceMarker}
  >
    {`qa-surface:${surfaceId}`}
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
    <Text
      style={[
        appStyles.title,
        { color: "#FFFFFF", fontSize: TYPOGRAPHY.fontSize["2xl"], marginBottom: SPACING.md },
      ]}
    >
      Riddle database unavailable
    </Text>
    <Text
      style={[
        appStyles.subtitle,
        { color: "#FFFFFF", textAlign: "center", marginBottom: SPACING.lg },
      ]}
    >
      The app could not finish loading its riddles. Please check your connection and try again.
    </Text>
    <Text style={[appStyles.buttonText, { color: "#FFFFFF" }]}>Retry</Text>
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

const renderModalSurface = (surfaceId: QASurfaceId) => {
  if (surfaceId === "modal-delete-account-confirmation") {
    return (
      <>
        <StarryBackground />
        <DeleteAccountConfirmationModal
          isVisible={true}
          isDeleting={false}
          onCancel={noop}
          onConfirm={noop}
        />
      </>
    );
  }

  if (surfaceId === "modal-offline-blocking") {
    return (
      <>
        <StarryBackground />
        <OfflineBlockingModal isVisible={true} />
      </>
    );
  }

  const modalType =
    QA_MODAL_SURFACE_TO_REGISTRY_TYPE[
      surfaceId as keyof typeof QA_MODAL_SURFACE_TO_REGISTRY_TYPE
    ];
  const ModalComponent = modalType ? getModalComponent(modalType) : null;
  if (!ModalComponent) {
    return renderInitializationError();
  }

  const modalData = generateMockData(modalType, undefined, qaPlayer, () => false);
  delete modalData.__fetchServerData;

  const lowCoinLossData: ModalData =
    modalType === "loss"
      ? {
          ...modalData,
          totalCoins: 10,
          canWatchAd: true,
          canUseCoin: false,
          onOpenShop: noop,
        }
      : modalData;

  return (
    <>
      <StarryBackground />
      <ModalComponent
        isVisible={true}
        onClose={noop}
        {...lowCoinLossData}
      />
    </>
  );
};

const QASurfaceHarness = ({ surfaceId }: { surfaceId: QASurfaceId }) => {
  const surface = getQASurface(surfaceId);
  const content = useMemo(() => {
    switch (surface.id) {
      case "page-app-loading":
      case "page-riddle-loading":
        return renderLoadingSurface();
      case "page-landing":
        return <LandingScreen />;
      case "page-login":
        return <LoginScreen navigation={mockNavigation as any} />;
      case "page-sign-up":
        return <SignUpScreen navigation={mockNavigation as any} />;
      case "page-forgot-password":
        return <ForgotPasswordScreen navigation={mockNavigation as any} />;
      case "page-new-password":
        return <NewPasswordScreen navigation={mockNavigation as any} />;
      case "page-initialization-error":
        return renderInitializationError();
      case "page-game":
        return renderGameSurface();
      default:
        return renderModalSurface(surface.id);
    }
  }, [surface.id]);

  return wrapSurface(surface.id, content);
};

export const QASurfaceGate = ({ children }: { children: React.ReactNode }) => {
  const { closeAllModals } = useModalContext();
  const [surfaceState, setSurfaceState] = useState<{
    id: QASurfaceId;
    nonce: number;
  } | null>(null);

  const setNextSurfaceId = useCallback((nextSurfaceId: QASurfaceId) => {
    closeAllModals();
    setQASurfaceRuntimeActive(true);
    setSurfaceState((currentSurfaceState) => ({
      id: nextSurfaceId,
      nonce: (currentSurfaceState?.nonce ?? 0) + 1,
    }));
  }, [closeAllModals]);

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

    const subscription = Linking.addEventListener("url", ({ url }) => {
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
    return (
      <QASurfaceHarness
        key={`${surfaceState.id}-${surfaceState.nonce}`}
        surfaceId={surfaceState.id}
      />
    );
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
});
