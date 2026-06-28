/**
 * @fileoverview
 * Main gameplay screen for Riddle Quest.
 *
 * `GameScreen` composes the core game UI (header, board, controls, bottom
 * navigation) and wires it to `useGameLogic`, ads, IAP, hints, and the
 * modal system. It is responsible for coordinating audio, haptics, riddle
 * progression across modes, and user settings such as sound and haptics.
 */
import React, {useState, useEffect, useCallback, useMemo, useRef} from "react";
import {KeyboardAvoidingView, Platform, View, Linking} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as RNIap from "react-native-iap";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import useRewardedAds from "../../hooks/useRewardedAds";
import useInterstitialAds from "../../hooks/useInterstitialAds";

import Header from "../../components/game/Header";
import Controls from "../../components/game/Controls";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import GameBoard from "../../components/game/GameBoard";
import useGameLogic from "../../hooks/useGameLogic";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {GameMode} from "../../contexts/AuthContext";

import {useAuthSession, usePlayer} from "../../contexts/AuthContext";
import {
  SupportedLanguage,
  useLocale,
  t,
} from "../../i18n";
import {isTablet, isLargeTablet, isDesktop} from "../../utils/responsive";
import {safeDelay} from "../../utils/timing";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import {
  SKIP_COST_CLASSIC,
  SKIP_COST_DAILY,
  CONTINUE_COST_COINS,
  CONTINUE_REWARDED_AD_COIN_REWARD,
  LEVEL_UP_COIN_BONUS,
  getStreakRewardBonus,
  MODAL_CLOSE_DELAY_MS,
  getXpLevel,
} from "../../constants/game";
import {getRankForLevel} from "../../constants/ranks";
import {LOADING_SPINNER_OPACITY, LOADING_SPINNER_SIZE} from "../../constants/loading";
import {styles} from "../../styles";
import {GameInput} from "../../components/game/GameInput";
import {useModal} from "../../hooks/useModal";
import {ModalProvider} from "../../components/modals/ModalProvider";
import {FANFARE_SEQUENCE_BACKGROUND_MODAL_TYPE} from "../../components/modals/modalTypes";
import {IapService} from "../../services/IapService";
import {ProductPricing, ProductPricingService} from "../../services/ProductPricingService";
import ModalTogglePanel from "../../components/development/ModalTogglePanel";
import StarryBackground from "../../components/background/StarryBackground";
import GuestOnboardingModal from "../../components/modals/help/GuestOnboardingModal";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";
import {computeLetterStates} from "../../utils/letterStates";
import {ACHIEVEMENT_DEFINITIONS} from "../../constants/achievements";
import {useGameSessionController} from "../../features/game-session/useGameSessionController";
import {createGameModalActions} from "../../features/game-session/gameModalActions";
import {isGuestPlayer} from "../../features/auth/sessionBootstrap";
import {loadUserProgressFromFirestore} from "../../services/FirestoreService";
import UpgradeAccountModal from "../../components/modals/settings/UpgradeAccountModal";
import type {Player} from "../../validation/firestoreSchemas";
import type {Feedback} from "../../hooks/types";
import type {ModalSequenceProgress} from "../../types/ModalTypes";
import {runModalFanfareSequence, type ModalSequenceStep} from "../../application/modals/ModalFanfareSequence";
import OfflineBlockingModal from "../../components/modals/system/OfflineBlockingModal";
import {useTooltip} from "../../contexts/TooltipContext";
import type {TooltipId, TooltipTargetRef} from "../../components/tooltips/types";
import {resolveBackspaceGuessSlot, resolveEditableGuessSlot, resolveNextActiveGuessSlot} from "../../utils/guessSlots";
import {resolvePlayableRiddleText} from "../../utils/riddleClues";
import {persistLocale} from "../../utils/localeStorage";
import {callValidatedFunction} from "../../utils/firebaseFunctions";
import {graphemeLength, splitGraphemes} from "@qwordly/core/game";
import {analyticsService} from "../../services/AnalyticsService";
import {useAppSettings} from "../../contexts/SettingsContext";
import {
  gameEventBus,
  type HintRequestedEvent,
  type LetterAddedEvent,
  type LetterRemovedEvent,
} from "../../services/GameEventBus";
import {
  GenerateTodaysDailyChallengeInputSchema,
  GenerateTodaysDailyChallengeOutputSchema,
  SpendCoinsInputSchema,
  SpendCoinsOutputSchema,
  GetHintInputSchema,
  GetHintOutputSchema,
} from "../../validation/cloudFunctionsSchemas";

interface GuessResult {
  outcome: "win" | "loss" | "continue" | "attemptLimitReached";
  feedback?: ("green" | "yellow" | "red")[];
  correctAnswer?: string;
  coinsEarned?: number;
  scoreEarned?: number;
  rewardBreakdown?: {
    baseWinCoins?: number;
    levelUpBonus?: number;
    dailyStreakBonus?: number;
    achievementBonus?: number;
    totalAwarded?: number;
    newBalance?: number;
  };
  canOfferRewardedAd?: boolean;
  canOfferCoinContinue?: boolean;
  attemptsRemaining?: number;
  newlyUnlockedAchievementIds?: string[];
  newWinStreak?: number;
}

interface GameScreenProps {
  riddleId: string;
  riddleText: string;
  answer: string;
  answerLength: number;
  userCoins: number;
  hintCost: number;
  onGameWin: (
    attempts: number,
    coinsEarned: number,
    scoreEarned: number,
    dailyStreakAfterWin?: number,
    bonusCoinsAwarded?: number,
    bonusCoinsPersistedByServer?: boolean,
  ) => void;
  onGameLoss: (correctAnswer: string, attempts: number) => void;
  onHintUsed: (cost: number) => void | string[] | Promise<void | string[]>;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
  suppressOnboarding?: boolean;
  qaAccessibilityLabel?: string;
}

type LockedGuessState = {
  guess: string[];
  indices: number[];
};

const EMPTY_LOCKED_GUESS_STATE: LockedGuessState = {
  guess: [],
  indices: [],
};

const buildLockedGuessState = (
  submittedGuess: readonly string[],
  feedback: GuessResult["feedback"],
  answerLength: number,
): LockedGuessState => {
  if (!feedback || answerLength <= 0) {
    return EMPTY_LOCKED_GUESS_STATE;
  }

  const nextGuess = Array<string>(answerLength).fill("");
  const indices: number[] = [];

  feedback.slice(0, answerLength).forEach((status, index) => {
    const letter = submittedGuess[index];
    if (status !== "green" || typeof letter !== "string" || letter.length === 0) {
      return;
    }

    nextGuess[index] = letter;
    indices.push(index);
  });

  return indices.length > 0 ? {guess: nextGuess, indices} : EMPTY_LOCKED_GUESS_STATE;
};

const ONBOARDING_SEEN_STORAGE_KEY_PREFIX = "gameScreenOnboardingSeen";
const RESULT_MODAL_REVEAL_DELAY_MS = 850;
const FIFTH_CORRECT_ANSWER_COUNT = 5;
const SUBMIT_TOOLTIP_BACKDROP_LAYER = {
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.45)",
  elevation: 20,
  left: 0,
  position: "absolute" as const,
  right: 0,
  top: 0,
  zIndex: 20,
} as const;

const getOnboardingSeenStorageKey = (userId?: string): string => {
  if (userId) {
    return `${ONBOARDING_SEEN_STORAGE_KEY_PREFIX}:${userId}`;
  }

  return `${ONBOARDING_SEEN_STORAGE_KEY_PREFIX}:anonymous`;
};

const getTooltipContent = (id: TooltipId) => {
  switch (id) {
    case "submitAnswer":
      return {
        title: t("Tooltips.SUBMIT_ANSWER_TITLE"),
        body: t("Tooltips.SUBMIT_ANSWER_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "hintAfterWrongGuess":
      return {
        title: t("Tooltips.HINT_AFTER_WRONG_TITLE"),
        body: t("Tooltips.HINT_AFTER_WRONG_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "shopOutOfCoins":
      return {
        title: t("Tooltips.SHOP_OUT_OF_COINS_TITLE"),
        body: t("Tooltips.SHOP_OUT_OF_COINS_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "achievementEarned":
      return {
        title: t("Tooltips.ACHIEVEMENT_EARNED_TITLE"),
        body: t("Tooltips.ACHIEVEMENT_EARNED_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "leaderboardFifthCorrectAnswer":
      return {
        title: t("Tooltips.LEADERBOARD_FIFTH_CORRECT_TITLE"),
        body: t("Tooltips.LEADERBOARD_FIFTH_CORRECT_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "classicFromDaily":
      return {
        title: t("Tooltips.CLASSIC_FROM_DAILY_TITLE"),
        body: t("Tooltips.CLASSIC_FROM_DAILY_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    default:
      return {
        title: t("CommonAlerts.INFO_TITLE"),
        body: "",
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
  }
};

const parseCoinBalance = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    const directParsed = Number(normalized);
    if (Number.isFinite(directParsed)) {
      return Math.max(0, directParsed);
    }

    const numericMatch = normalized.match(/-?\d+(\.\d+)?/);
    if (numericMatch) {
      const parsedMatch = Number(numericMatch[0]);
      if (Number.isFinite(parsedMatch)) {
        return Math.max(0, parsedMatch);
      }
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeValueOf = (value as {valueOf?: () => unknown}).valueOf;
    if (typeof maybeValueOf === "function") {
      const fromValueOf = maybeValueOf.call(value);
      if (fromValueOf !== value) {
        const parsedFromValueOf = parseCoinBalance(fromValueOf);
        if (parsedFromValueOf !== null) {
          return parsedFromValueOf;
        }
      }
    }

    const maybeToString = (value as {toString?: () => string}).toString;
    if (typeof maybeToString === "function") {
      const asString = maybeToString.call(value);
      if (typeof asString === "string" && asString !== "[object Object]") {
        const parsedFromString = parseCoinBalance(asString);
        if (parsedFromString !== null) {
          return parsedFromString;
        }
      }
    }
  }

  return null;
};

const toNonNegativeStatValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const LETTER_STATE_PRIORITY: Record<Feedback, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const mergeLetterStates = (
  existing: Record<string, Feedback>,
  incoming: Record<string, Feedback>,
): Record<string, Feedback> => {
  if (Object.keys(existing).length === 0) {
    return {...incoming};
  }
  if (Object.keys(incoming).length === 0) {
    return {...existing};
  }

  const merged = {...existing};
  for (const [letter, feedback] of Object.entries(incoming)) {
    const currentFeedback = merged[letter];
    if (!currentFeedback || LETTER_STATE_PRIORITY[feedback] > LETTER_STATE_PRIORITY[currentFeedback]) {
      merged[letter] = feedback;
    }
  }
  return merged;
};

const resolveProfileSnapshot = (localPlayer: Player | null, refreshedPlayer: Player): Player => {
  if (!localPlayer) {
    return refreshedPlayer;
  }

  const localHighestLevelClassic = Math.max(
    toNonNegativeStatValue(localPlayer.stats?.highestLevelClassic),
    toNonNegativeStatValue(localPlayer.progress?.classicIndex),
  );
  const refreshedHighestLevelClassic = Math.max(
    toNonNegativeStatValue(refreshedPlayer.stats?.highestLevelClassic),
    toNonNegativeStatValue(refreshedPlayer.progress?.classicIndex),
  );
  const mergedHighestLevelClassic = Math.max(localHighestLevelClassic, refreshedHighestLevelClassic);

  const localGamesPlayed = toNonNegativeStatValue(localPlayer.stats?.gamesPlayed);
  const refreshedGamesPlayed = toNonNegativeStatValue(refreshedPlayer.stats?.gamesPlayed);

  // Prefer in-session local stats when they are ahead of a stale server refresh.
  if (localGamesPlayed > refreshedGamesPlayed) {
    return {
      ...refreshedPlayer,
      stats: {
        ...(refreshedPlayer.stats ?? {}),
        ...(localPlayer.stats ?? {}),
        highestLevelClassic: mergedHighestLevelClassic,
      },
    };
  }

  return {
    ...refreshedPlayer,
    stats: {
      ...(refreshedPlayer.stats ?? {}),
      highestLevelClassic: mergedHighestLevelClassic,
    },
  };
};

const GameScreenInner: React.FC<GameScreenProps> = ({
  riddleId,
  riddleText,
  answer,
  userCoins,
  hintCost,
  onGameWin,
  onGameLoss,
  onHintUsed,
  onSkipUsed,
  onNextLevel,
  gameMode,
  suppressOnboarding = false,
}) => {
  const {logout} = useAuthSession();
  const {playerData, updatePlayerData, updatePlayerDataLocally, pendingStreakBreak, consumePendingStreakBreak} =
    usePlayer();
  const modal = useModal();
  const tooltip = useTooltip();
  const showTooltipRequestOnce = tooltip.showTooltipOnce;
  const {showWelcomeBackModal, showInfoModal} = modal;
  const isGuestMode = isGuestPlayer(playerData);
  const {
    isSoundEnabled,
    isHapticsEnabled,
    toggleSoundEnabled: toggleSoundEnabledSetting,
    toggleHapticsEnabled: toggleHapticsEnabledSetting,
  } = useAppSettings();

  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const sharedLocale = useLocale();
  const currentLanguage: SupportedLanguage = sharedLocale;
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const activeSlotIndexRef = useRef(0);
  const {isLoading, runWithServerLoading} = useGameSessionController();
  const modalActions = useMemo(() => createGameModalActions(modal), [modal]);
  const [isProfileModalLoading, setIsProfileModalLoading] = useState(false);
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
  const [isGuestOnboardingModalVisible, setIsGuestOnboardingModalVisible] = useState(false);
  const [isTransitioningToNextLevel, setIsTransitioningToNextLevel] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(suppressOnboarding);
  const isRunningUnderJest = typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);
  const shouldUseFullFirestoreCatalog = !isRunningUnderJest;
  const currentTooltipUserId = playerData?.userId ?? null;
  const playableAnswer = useMemo(() => answer.trim(), [answer]);
  const playableAnswerLength = graphemeLength(playableAnswer, currentLanguage);
  const playableRiddleText = useMemo(
    () => resolvePlayableRiddleText(riddleText, playableAnswer),
    [riddleText, playableAnswer],
  );

  const showTooltipOnce = useCallback(
    (id: TooltipId, targetRef?: TooltipTargetRef | null, highlightElement?: React.ReactNode) => {
      if (!isOnboardingComplete || isUpgradeModalVisible) {
        logger.debug("[GameScreen] showTooltipOnce skipped until intro prompts complete", {
          id,
          userId: currentTooltipUserId,
          riddleId,
          gameMode,
          isOnboardingComplete,
          isUpgradeModalVisible,
        });
        return Promise.resolve(false);
      }

      logger.debug("[GameScreen] showTooltipOnce requested", {
        id,
        hasTargetRef: Boolean(targetRef?.current),
        userId: currentTooltipUserId,
        riddleId,
        gameMode,
      });

      return showTooltipRequestOnce({
        id,
        targetRef,
        highlightElement,
        content: getTooltipContent(id),
        userId: currentTooltipUserId,
      });
    },
    [currentTooltipUserId, gameMode, isOnboardingComplete, isUpgradeModalVisible, riddleId, showTooltipRequestOnce],
  );

  const gameOverHandledRef = useRef(false);
  const isMountedRef = useRef(true);
  const latestResultRef = useRef<GuessResult | null>(null);
  const lastSubmittedAttemptRef = useRef<number | null>(null);
  const submitButtonRef = useRef<View>(null);
  const hintButtonRef = useRef<View>(null);
  const nextButtonRef = useRef<View>(null);
  const coinsButtonRef = useRef<View>(null);
  const profileButtonRef = useRef<View>(null);
  const previousGameModeRef = useRef<GameMode>(gameMode);
  const openShopFromLossRef = useRef<() => void>(() => {});
  const coinAnimationSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasQueuedSubmitTooltipRef = useRef(false);

  const completeGuestOnboarding = useCallback(() => {
    setIsGuestOnboardingModalVisible(false);
    setIsOnboardingComplete(true);
  }, []);

  const handleGuestOnboardingUpgrade = useCallback(() => {
    completeGuestOnboarding();
    setIsUpgradeModalVisible(true);
  }, [completeGuestOnboarding]);

  useEffect(() => {
    if (suppressOnboarding) {
      setIsOnboardingComplete(true);
    }
  }, [suppressOnboarding]);

  useEffect(() => {
    const previousGameMode = previousGameModeRef.current;
    previousGameModeRef.current = gameMode;
    if (previousGameMode === "daily" && gameMode === "classic") {
      void safeDelay(650).then(() => {
        void showTooltipOnce("classicFromDaily", nextButtonRef);
      });
    }
  }, [gameMode, showTooltipOnce]);
  const hasLoadedShopCatalogRef = useRef(false);

  const [iapProducts, setIapProducts] = useState<RNIap.Product[]>([]);
  const [iapLoading, setIapLoading] = useState(false);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [firestoreProducts, setFirestoreProducts] = useState<ProductPricing[]>([]);
  const [productPricingLoading, setProductPricingLoading] = useState(false);
  const [productPricingError, setProductPricingError] = useState<string | null>(null);
  const [preservedLetterStates, setPreservedLetterStates] = useState<Record<string, Feedback>>({});
  const {isRewardedAdReady, loadRewardedAd, showRewardedAd, recordRewardedAdCompletion} = useRewardedAds();
  const {loadInterstitialAd, showInterstitialAd} = useInterstitialAds();
  const setActiveSlotIndexSynced = useCallback((value: React.SetStateAction<number>) => {
    if (typeof value !== "function") {
      activeSlotIndexRef.current = value;
      setActiveSlotIndex(value);
      return;
    }

    setActiveSlotIndex((prev) => {
      const resolved = typeof value === "function" ? (value as (previous: number) => number)(prev) : value;
      activeSlotIndexRef.current = resolved;
      return resolved;
    });
  }, []);

  const {guesses, currentGuess, gameOver, setCurrentGuess, processGuess, continueGame, resetGame} = useGameLogic({
    riddleId,
    answer: playableAnswer,
    gameMode: gameMode === "daily" ? "challenge" : "classic",
    isGuestMode,
  });

  useEffect(() => {
    void analyticsService.logGameStart({
      gameMode: gameMode === "classic" ? "classic" : "daily",
      riddleId,
    });
  }, [gameMode, riddleId]);

  const currentUserCoins = useMemo(() => {
    const authCoins = parseCoinBalance(playerData?.coins);
    if (authCoins !== null) {
      return authCoins;
    }

    const propCoins = parseCoinBalance(userCoins);
    if (propCoins !== null) {
      return propCoins;
    }

    return 0;
  }, [playerData?.coins, userCoins]);

  const [hintRevealedIndices, setHintRevealedIndices] = useState<number[]>([]);
  const hintRevealedIndicesRef = useRef<number[]>([]);
  const pendingLockedGuessStateRef = useRef<LockedGuessState | null>(null);
  const setHintRevealedIndicesSynced = useCallback((value: React.SetStateAction<number[]>) => {
    if (typeof value !== "function") {
      hintRevealedIndicesRef.current = value;
      setHintRevealedIndices(value);
      return;
    }

    setHintRevealedIndices((previous) => {
      const resolved = typeof value === "function" ? (value as (currentValue: number[]) => number[])(previous) : value;
      hintRevealedIndicesRef.current = resolved;
      return resolved;
    });
  }, []);
  const applyLockedGuessState = useCallback(
    (lockedGuessState: LockedGuessState) => {
      setHintRevealedIndicesSynced(lockedGuessState.indices);
      setCurrentGuess(lockedGuessState.guess);
      setActiveSlotIndexSynced(
        resolveEditableGuessSlot(0, playableAnswerLength, lockedGuessState.indices) ??
          Math.max(0, Math.min(playableAnswerLength - 1, activeSlotIndexRef.current)),
      );
    },
    [playableAnswerLength, setActiveSlotIndexSynced, setCurrentGuess, setHintRevealedIndicesSynced],
  );
  const applyPendingLockedGuessState = useCallback(() => {
    const lockedGuessState = pendingLockedGuessStateRef.current ?? EMPTY_LOCKED_GUESS_STATE;
    pendingLockedGuessStateRef.current = null;
    applyLockedGuessState(lockedGuessState);
  }, [applyLockedGuessState]);
  const preserveKeyboardLetterStates = useCallback(() => {
    setPreservedLetterStates((existing) => mergeLetterStates(existing, computeLetterStates(guesses)));
  }, [guesses]);
  const resetRoundState = useCallback(() => {
    pendingLockedGuessStateRef.current = null;
    setPreservedLetterStates({});
    setHintRevealedIndicesSynced([]);
    resetGame();
  }, [resetGame, setHintRevealedIndicesSynced]);

  useEffect(() => {
    const updateConnectivity = (nextState: {isConnected: boolean | null; isInternetReachable: boolean | null}) => {
      const disconnected = nextState.isConnected === false;
      const internetUnavailable = nextState.isInternetReachable === false;
      setIsOffline(disconnected || internetUnavailable);
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      updateConnectivity(state);
    });

    void NetInfo.fetch()
      .then(updateConnectivity)
      .catch(() => {
        // If initial reachability check fails, treat as offline to protect game state.
        setIsOffline(true);
      });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadRewardedAd();
  }, [loadRewardedAd]);

  useEffect(() => {
    if (playerData?.hasPurchasedApp === true) {
      return;
    }

    loadInterstitialAd();
  }, [loadInterstitialAd, playerData?.hasPurchasedApp]);

  useEffect(() => {
    logger.debug(`Game session context changed (mode=${gameMode}, riddleId=${riddleId}). Resetting local game state.`);
    resetRoundState();
  }, [gameMode, riddleId, answer, resetRoundState]);

  const isAnyModalVisible = modal.modals.length > 0;
  const isInteractionBlocked = isAnyModalVisible || isOffline;
  const [canAnimateCoinIncreases, setCanAnimateCoinIncreases] = useState(!isAnyModalVisible);
  const [isAwaitingPostSubmitModalClose, setIsAwaitingPostSubmitModalClose] = useState(false);
  const currentRoundLetterStates = useMemo(() => computeLetterStates(guesses), [guesses]);
  const letterStates = useMemo(
    () => mergeLetterStates(preservedLetterStates, currentRoundLetterStates),
    [preservedLetterStates, currentRoundLetterStates],
  );

  useEffect(() => {
    logger.debug("[GameScreen] overlay state changed", {
      isAnyModalVisible,
      modalTypes: modal.modals.map((activeModal) => activeModal.type),
      isOffline,
      isInteractionBlocked,
      isLoading,
      isProfileModalLoading,
      isPurchaseInProgress,
      isTransitioningToNextLevel,
      activeTooltipId: tooltip.activeTooltipId,
    });
  }, [
    isAnyModalVisible,
    isOffline,
    isInteractionBlocked,
    isLoading,
    isProfileModalLoading,
    isPurchaseInProgress,
    isTransitioningToNextLevel,
    modal.modals,
    tooltip.activeTooltipId,
  ]);

  useEffect(() => {
    return () => {
      if (coinAnimationSettleTimeoutRef.current) {
        clearTimeout(coinAnimationSettleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (coinAnimationSettleTimeoutRef.current) {
      clearTimeout(coinAnimationSettleTimeoutRef.current);
      coinAnimationSettleTimeoutRef.current = null;
    }

    if (isAwaitingPostSubmitModalClose) {
      setCanAnimateCoinIncreases((previous) => (previous ? false : previous));

      if (isAnyModalVisible) {
        return undefined;
      }

      coinAnimationSettleTimeoutRef.current = setTimeout(() => {
        setCanAnimateCoinIncreases((previous) => (previous ? previous : true));
        setIsAwaitingPostSubmitModalClose((previous) => (previous ? false : previous));
        coinAnimationSettleTimeoutRef.current = null;
      }, MODAL_CLOSE_DELAY_MS);
      return undefined;
    }

    if (isAnyModalVisible) {
      setCanAnimateCoinIncreases((previous) => (previous ? false : previous));
      return undefined;
    }

    // Wait for modal transitions/next queued modal to settle before allowing
    // deferred coin count-up animations to start.
    coinAnimationSettleTimeoutRef.current = setTimeout(() => {
      setCanAnimateCoinIncreases((previous) => (previous ? previous : true));
      coinAnimationSettleTimeoutRef.current = null;
    }, MODAL_CLOSE_DELAY_MS);

    return () => {
      if (coinAnimationSettleTimeoutRef.current) {
        clearTimeout(coinAnimationSettleTimeoutRef.current);
        coinAnimationSettleTimeoutRef.current = null;
      }
    };
  }, [isAnyModalVisible, isAwaitingPostSubmitModalClose]);

  const loadIapProducts = useCallback(async () => {
    if (shouldUseFullFirestoreCatalog) {
      setIapProducts([]);
      setIapError(null);
      setIapLoading(false);
      return {
        products: [] as RNIap.Product[],
        error: null as string | null,
      };
    }

    setIapLoading(true);
    setIapError(null);

    try {
      const products = await IapService.getProducts();
      setIapProducts(products);
      return {
        products,
        error: null as string | null,
      };
    } catch (error) {
      logger.error("Error loading IAP products:", error);
      captureException(error);
      setIapError(t("ErrorMessages.FAILED_TO_LOAD_PRODUCTS"));
      return {
        products: [] as RNIap.Product[],
        error: t("ErrorMessages.FAILED_TO_LOAD_PRODUCTS"),
      };
    } finally {
      setIapLoading(false);
    }
  }, [shouldUseFullFirestoreCatalog]);

  const loadFirestoreProducts = useCallback(async () => {
    setProductPricingLoading(true);
    setProductPricingError(null);

    try {
      const products = await ProductPricingService.getActiveProducts();
      setFirestoreProducts(products);
      return {
        products,
        error: null as string | null,
      };
    } catch (error) {
      logger.error("Error loading Firestore product pricing:", error);
      captureException(error);
      setProductPricingError(t("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS"));
      return {
        products: [] as ProductPricing[],
        error: t("ErrorMessages.FAILED_TO_LOAD_SHOP_PRODUCTS"),
      };
    } finally {
      setProductPricingLoading(false);
    }
  }, []);

  const ensureShopCatalogLoaded = useCallback(async () => {
    if (hasLoadedShopCatalogRef.current) {
      return {
        iapResult: {
          products: iapProducts,
          error: iapError,
        },
        firestoreResult: {
          products: firestoreProducts,
          error: productPricingError,
        },
      };
    }

    const [iapResult, firestoreResult] = await Promise.all([loadIapProducts(), loadFirestoreProducts()]);

    if (!iapResult.error && !firestoreResult.error) {
      hasLoadedShopCatalogRef.current = true;
    }

    return {iapResult, firestoreResult};
  }, [iapProducts, iapError, firestoreProducts, productPricingError, loadIapProducts, loadFirestoreProducts]);

  const firstTimeCheckDone = useRef(false);
  const streakBreakModalShownRef = useRef(false);

  const deriveDailyStreakAfterWin = useCallback((): number => {
    const currentStreak = playerData?.stats?.winStreak ?? 0;
    const lastCompletedAt = playerData?.lastDailyChallengeCompletedAt;
    if (!lastCompletedAt) return 1;

    const lastCompletedDate = new Date(lastCompletedAt);
    if (Number.isNaN(lastCompletedDate.getTime())) return 1;
    lastCompletedDate.setUTCHours(0, 0, 0, 0);

    const yesterdayUtc = new Date();
    yesterdayUtc.setUTCHours(0, 0, 0, 0);
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);

    return lastCompletedDate.getTime() === yesterdayUtc.getTime() ? currentStreak + 1 : 1;
  }, [playerData]);

  useEffect(() => {
    if (suppressOnboarding || firstTimeCheckDone.current || !playerData) return;
    firstTimeCheckDone.current = true;
    let isCancelled = false;

    const runOnboardingFlow = async () => {
      try {
        if (isCancelled) {
          return;
        }

        // Provider-authenticated users should always see a lightweight welcome-back
        // modal when they enter the game.
        if (!isGuestMode) {
          const username = playerData?.username?.trim() || "";
          showWelcomeBackModal({
            username,
            onDismiss: () => {
              setIsOnboardingComplete(true);
            },
          });
          return;
        }

        const onboardingSeenStorageKey = getOnboardingSeenStorageKey(playerData?.userId);
        const hasSeenOnboarding = (await AsyncStorage.getItem(onboardingSeenStorageKey)) === "true";
        if (isCancelled || hasSeenOnboarding) {
          setIsOnboardingComplete(true);
          return;
        }

        setIsGuestOnboardingModalVisible(true);

        AsyncStorage.setItem(onboardingSeenStorageKey, "true").catch((error: unknown) => {
          logger.error("Error saving onboarding seen state:", error);
          captureException(error);
        });
      } catch (error) {
        setIsOnboardingComplete(true);
        logger.error("Error running onboarding flow:", error);
        captureException(error);
      }
    };

    void runOnboardingFlow();

    return () => {
      isCancelled = true;
    };
  }, [
    isGuestMode,
    playerData,
    playerData?.userId,
    showWelcomeBackModal,
    showInfoModal,
    suppressOnboarding,
  ]);

  useEffect(() => {
    if (suppressOnboarding || !pendingStreakBreak || streakBreakModalShownRef.current || isAnyModalVisible) {
      return;
    }

    let isCancelled = false;
    safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
      if (isCancelled || streakBreakModalShownRef.current || modal.modals.length > 0) {
        return;
      }

      streakBreakModalShownRef.current = true;
      showInfoModal({
        title: t("GameScreenAlerts.STREAK_BROKEN_TITLE"),
        message: t("GameScreenAlerts.STREAK_BROKEN_MESSAGE", {
          previousStreak: pendingStreakBreak.previousStreak,
          daySuffix: pendingStreakBreak.previousStreak === 1 ? "" : "s",
        }),
        onConfirm: consumePendingStreakBreak,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [
    pendingStreakBreak,
    isAnyModalVisible,
    modal.modals.length,
    showInfoModal,
    consumePendingStreakBreak,
    suppressOnboarding,
  ]);

  useEffect(() => {
    if (!gameOver) {
      gameOverHandledRef.current = false;
    }
  }, [gameOver]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestResultRef.current = lastGuessResult;
  }, [lastGuessResult]);

  useEffect(() => {
    if (currentGuess.length <= playableAnswerLength) {
      return;
    }

    setCurrentGuess((prev: string[]) => {
      return prev.slice(0, playableAnswerLength);
    });
  }, [currentGuess.length, playableAnswerLength, setCurrentGuess]);

  useEffect(() => {
    if (playableAnswerLength <= 0) {
      setActiveSlotIndexSynced(0);
      return;
    }

    setActiveSlotIndexSynced((prev) => {
      const maxIndex = Math.max(0, playableAnswerLength - 1);
      const clampedPrev = Math.min(Math.max(0, prev), maxIndex);
      const editablePrev =
        resolveEditableGuessSlot(clampedPrev, playableAnswerLength, hintRevealedIndicesRef.current) ?? clampedPrev;

      if (currentGuess.length === 0) {
        return editablePrev;
      }

      if (!currentGuess[editablePrev]) {
        return editablePrev;
      }

      const firstEmptyIndex = currentGuess.findIndex(
        (letter, index) => !letter && !hintRevealedIndicesRef.current.includes(index),
      );
      if (firstEmptyIndex !== -1) {
        return firstEmptyIndex;
      }

      return editablePrev;
    });
  }, [playableAnswerLength, currentGuess, hintRevealedIndices, setActiveSlotIndexSynced]);

  const handleCoinContinue = useCallback(async () => {
    void analyticsService.logGameInteraction("continue_with_coins_selected", {
      game_mode: gameMode,
      cost: CONTINUE_COST_COINS,
      can_afford: currentUserCoins >= CONTINUE_COST_COINS,
    });

    const isInsufficientCoinsError = (error: unknown): boolean => {
      if (!error || typeof error !== "object") {
        return false;
      }

      const maybeCode =
        "code" in error && typeof (error as {code?: unknown}).code === "string"
          ? ((error as {code: string}).code || "").toLowerCase()
          : "";
      const maybeMessage =
        "message" in error && typeof (error as {message?: unknown}).message === "string"
          ? ((error as {message: string}).message || "").toLowerCase()
          : "";

      return (
        maybeCode.includes("failed-precondition") ||
        maybeCode.includes("resource-exhausted") ||
        maybeMessage.includes("insufficient coins")
      );
    };

    if (currentUserCoins < CONTINUE_COST_COINS) {
      modal.showInfoModal({
        title: t("GameScreenAlerts.NOT_ENOUGH_COINS_TITLE"),
        message: t("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE"),
      });
      return false;
    }

    try {
      if (!isGuestMode) {
        const spendResult = await runWithServerLoading(() =>
          callValidatedFunction(
            "spendCoins",
            {
              reason: "continue",
            },
            SpendCoinsInputSchema,
            SpendCoinsOutputSchema,
          ),
        );

        if (playerData) {
          updatePlayerDataLocally({
            coins: spendResult.newCoins,
          });
        }
      } else if (playerData) {
        updatePlayerDataLocally({
          coins: Math.max(0, (playerData.coins ?? 0) - CONTINUE_COST_COINS),
        });
      }
      setLastGuessResult(null);
      preserveKeyboardLetterStates();
      continueGame();
      applyPendingLockedGuessState();
      void analyticsService.logCoinSpend({
        action: "continue",
        amount: CONTINUE_COST_COINS,
        gameMode,
      });
      return true;
    } catch (error) {
      if (isInsufficientCoinsError(error)) {
        logger.warn("Insufficient coins for continue attempt");
        modal.showInfoModal({
          title: t("GameScreenAlerts.NOT_ENOUGH_COINS_TITLE"),
          message: t("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE"),
        });
        return false;
      }

      logger.error("Error spending coins for continue:", error);
      captureException(error);
      modal.showInfoModal({
        title: t("CommonAlerts.ERROR_TITLE"),
        message: t("GameScreenAlerts.SPEND_COINS_ERROR_MESSAGE"),
      });
      return false;
    }
  }, [
    modal,
    continueGame,
    applyPendingLockedGuessState,
    preserveKeyboardLetterStates,
    runWithServerLoading,
    isGuestMode,
    playerData,
    updatePlayerDataLocally,
    currentUserCoins,
    gameMode,
  ]);

  const confirmRewardedAdReward = useCallback(
    async (placement: "loss_continue" | "coin_shop") => {
      if (!isGuestMode) {
        logger.debug("Confirming rewarded ad reward with backend callback", {
          placement,
          userId: playerData?.userId,
        });
        const rewardResult = await recordRewardedAdCompletion(placement);
        if (playerData) {
          updatePlayerDataLocally({coins: rewardResult.newCoins}, {syncToFirestore: false});
        }
        logger.debug("Rewarded ad backend callback confirmed", {
          placement,
          callbackId: rewardResult.callbackId,
          alreadyProcessed: rewardResult.alreadyProcessed,
          rewardCoins: rewardResult.rewardCoins,
          newCoins: rewardResult.newCoins,
        });
        return {
          rewardCoins: rewardResult.rewardCoins,
          totalCoins: rewardResult.newCoins,
        };
      }

      const totalCoins = currentUserCoins + CONTINUE_REWARDED_AD_COIN_REWARD;
      if (playerData) {
        updatePlayerDataLocally({
          coins: totalCoins,
        });
      }
      logger.debug("Rewarded ad guest reward applied locally", {
        placement,
        rewardCoins: CONTINUE_REWARDED_AD_COIN_REWARD,
        totalCoins,
      });
      return {
        rewardCoins: CONTINUE_REWARDED_AD_COIN_REWARD,
        totalCoins,
      };
    },
    [currentUserCoins, isGuestMode, playerData, recordRewardedAdCompletion, updatePlayerDataLocally],
  );

  const runRewardedAdContinueFlow = useCallback(async () => {
    const didCompleteRewardedAd = await showRewardedAd();
    if (didCompleteRewardedAd) {
      let rewardResult: {rewardCoins: number; totalCoins: number};
      try {
        rewardResult = await confirmRewardedAdReward("loss_continue");
      } catch (error) {
        logger.error("Error confirming rewarded ad continue:", error);
        captureException(error);
        modalActions.showAdError();
        return false;
      }

      modal.showCoinPurchaseFanfareModal({
        coinsPurchased: rewardResult.rewardCoins,
        totalCoins: rewardResult.totalCoins,
      });
      setLastGuessResult(null);
      preserveKeyboardLetterStates();
      continueGame();
      applyPendingLockedGuessState();
      return true;
    }

    modal.showInfoModal({
      title: t("GameScreenAlerts.AD_NOT_READY_TITLE"),
      message: t("GameScreenAlerts.AD_NOT_READY_MESSAGE"),
    });
    return false;
  }, [
    showRewardedAd,
    confirmRewardedAdReward,
    continueGame,
    applyPendingLockedGuessState,
    preserveKeyboardLetterStates,
    modal,
    modalActions,
  ]);

  const handlePurchaseProduct = useCallback(
    async (productId: string) => {
      if (isPurchaseInProgress) {
        logger.debug("Purchase already in progress. Ignoring duplicate request.");
        return;
      }

      logger.debug(`Initiating purchase for product: ${productId}`);
      setIsPurchaseInProgress(true);
      setIapLoading(true);

      try {
        const purchaseResult = await IapService.purchaseProduct(productId);

        if (purchaseResult) {
          logger.debug("Purchase completed successfully:", purchaseResult);
          const mappedCoinsForProduct = IapService.getCoinsForProduct(productId) ?? 0;
          const resolvedNewCoins = parseCoinBalance(purchaseResult.newCoins);
          const balanceDeltaCoins = resolvedNewCoins !== null ? Math.max(resolvedNewCoins - currentUserCoins, 0) : null;
          const coinsPurchased = mappedCoinsForProduct > 0 ? mappedCoinsForProduct : (balanceDeltaCoins ?? 0);
          if (coinsPurchased <= 0) {
            logger.warn("Purchase result did not resolve to a positive coin award.", {
              productId,
              transactionId: purchaseResult.transactionId,
              resolvedNewCoins,
              currentUserCoins,
            });
            throw new Error(t("GameScreenAlerts.PURCHASE_FAILED_MESSAGE"));
          }
          const backendUnlockedAchievementIds = Array.isArray(purchaseResult.newlyUnlockedAchievementIds)
            ? (purchaseResult.newlyUnlockedAchievementIds ?? [])
            : [];
          const isAlreadySupporter = Boolean(
            playerData?.unlockedAchievements?.some((achievement) => achievement.achievementId === "first_purchase"),
          );
          // Fallback: if backend hasn't returned first_purchase yet, unlock it client-side once
          // after the first successful shop purchase.
          const unlockedAchievementIds = isAlreadySupporter
            ? backendUnlockedAchievementIds
            : Array.from(new Set([...backendUnlockedAchievementIds, "first_purchase"]));
          const unlockedAchievements = unlockedAchievementIds
            .map((achievementId) => ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === achievementId))
            .filter((achievement): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] => Boolean(achievement));
          const totalCoinsAfterPurchase = resolvedNewCoins ?? currentUserCoins + coinsPurchased;
          const isLocalDevPurchase =
            typeof purchaseResult.transactionId === "string" && purchaseResult.transactionId.startsWith("dev-local-");

          if (playerData) {
            const existingUnlockedAchievements = Array.isArray(playerData.unlockedAchievements)
              ? playerData.unlockedAchievements
              : [];
            const existingAchievementIds = new Set(existingUnlockedAchievements.map((entry) => entry.achievementId));
            const unlockedAt = Date.now();
            const newlyUnlockedEntries = unlockedAchievements
              .filter((achievement) => !existingAchievementIds.has(achievement.id))
              .map((achievement) => ({
                achievementId: achievement.id,
                unlockedAt,
              }));

            const nextPlayerUpdates: Partial<Player> = {};
            if (resolvedNewCoins !== null) {
              nextPlayerUpdates.coins = resolvedNewCoins;
            } else if (isLocalDevPurchase && coinsPurchased > 0) {
              nextPlayerUpdates.coins = (playerData.coins ?? 0) + coinsPurchased;
            }
            if (newlyUnlockedEntries.length > 0) {
              nextPlayerUpdates.unlockedAchievements = [...existingUnlockedAchievements, ...newlyUnlockedEntries];
            }
            if (playerData.hasPurchasedApp !== true) {
              nextPlayerUpdates.hasPurchasedApp = true;
            }

            if (Object.keys(nextPlayerUpdates).length > 0) {
              updatePlayerDataLocally(nextPlayerUpdates);
            }
          }

          // Close shop immediately after successful purchase.
          modal.closeModalByType("coinShop");

          const showPurchaseAchievementFanfareAtIndex = (index: number): void => {
            if (index >= unlockedAchievements.length) {
              return;
            }

            const achievement = unlockedAchievements[index];
            modal.showAchievementUnlockFanfareModal({
              coinsEarned: 0,
              totalCoins: totalCoinsAfterPurchase,
              achievementNames: [achievement.name],
              achievements: [achievement],
              onContinue: () => {
                void safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                  showPurchaseAchievementFanfareAtIndex(index + 1);
                });
              },
            });
          };

          modal.showCoinPurchaseFanfareModal({
            coinsPurchased,
            totalCoins: totalCoinsAfterPurchase,
            onConfirm: () => {
              if (unlockedAchievements.length > 0) {
                showPurchaseAchievementFanfareAtIndex(0);
              }
            },
          });
        } else {
          logger.debug("Purchase was cancelled or returned null");
        }
      } catch (error) {
        logger.error("Purchase failed:", error);
        captureException(error);
        const errorMessage =
          error instanceof Error ? error.message : t("GameScreenAlerts.PURCHASE_FAILED_MESSAGE");
        modal.showInfoModal({
          title: t("GameScreenAlerts.PURCHASE_FAILED_TITLE"),
          message: errorMessage,
        });
      } finally {
        setIapLoading(false);
        setIsPurchaseInProgress(false);
      }
    },
    [isPurchaseInProgress, modal, playerData, updatePlayerDataLocally, currentUserCoins],
  );

  const handlePayAndPlay = useCallback(() => {
    logger.debug("Pay and play button pressed");
    void analyticsService.logGameInteraction("pay_and_play_selected", {
      game_mode: gameMode,
    });

    const cheapestProduct = [...iapProducts].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];

    if (cheapestProduct) {
      handlePurchaseProduct(cheapestProduct.id);
    } else {
      modalActions.showNoProductsAvailable();
    }
  }, [iapProducts, handlePurchaseProduct, modalActions, gameMode]);

  const handleWatchAdForCoins = useCallback(async () => {
    logger.debug("Watch ad for coins button pressed");
    void analyticsService.logGameInteraction("watch_ad_for_coins_selected", {
      game_mode: gameMode,
    });
    modal.closeModalByType("coinShop");

    try {
      const didCompleteRewardedAd = await showRewardedAd();
      if (didCompleteRewardedAd) {
        const rewardResult = await confirmRewardedAdReward("coin_shop");
        modal.showCoinPurchaseFanfareModal({
          coinsPurchased: rewardResult.rewardCoins,
          totalCoins: rewardResult.totalCoins,
        });
        logger.debug("Rewarded ad for coins shown successfully");
      } else {
        logger.warn("Rewarded ad was not ready to be shown");
        modalActions.showAdNotReady();
      }
    } catch (error) {
      logger.error("Error showing rewarded ad for coins:", error);
      captureException(error);
      modalActions.showAdError();
    }
  }, [modal, showRewardedAd, confirmRewardedAdReward, modalActions, gameMode]);

  const showPostVictoryInterstitialAd = useCallback(async () => {
    if (playerData?.hasPurchasedApp === true) {
      return false;
    }

    try {
      return await showInterstitialAd("post_victory");
    } catch (error) {
      logger.error("Error showing post-victory interstitial ad:", error);
      captureException(error);
      return false;
    }
  }, [playerData?.hasPurchasedApp, showInterstitialAd]);

  useEffect(() => {
    if (gameOver && lastGuessResult && lastGuessResult.outcome !== "continue" && !gameOverHandledRef.current) {
      gameOverHandledRef.current = true;
      const result = lastGuessResult;

      if (result.outcome === "win") {
        const resolvedAttempts = lastSubmittedAttemptRef.current ?? guesses.length;
        const unlockedAchievements = (result.newlyUnlockedAchievementIds ?? [])
          .map((achievementId) => ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievementId))
          .filter((achievement): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] => Boolean(achievement));

        const unlockedAchievementNames = unlockedAchievements.map((achievement) => achievement.name);
        unlockedAchievements.forEach((achievement) => {
          void analyticsService.logAchievementUnlocked(achievement.id);
        });

        if (playerData && unlockedAchievements.length > 0) {
          const existingUnlockedAchievements = Array.isArray(playerData.unlockedAchievements)
            ? playerData.unlockedAchievements
            : [];
          const existingAchievementIds = new Set(existingUnlockedAchievements.map((entry) => entry.achievementId));
          const unlockedAt = Date.now();
          const newlyUnlockedEntries = unlockedAchievements
            .filter((achievement) => !existingAchievementIds.has(achievement.id))
            .map((achievement) => ({
              achievementId: achievement.id,
              unlockedAt,
            }));

          if (newlyUnlockedEntries.length > 0) {
            updatePlayerDataLocally(
              {
                unlockedAchievements: [...existingUnlockedAchievements, ...newlyUnlockedEntries],
              },
              {syncToFirestore: false},
            );
          }
        }

        if (isHapticsEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          if (unlockedAchievementNames.length > 0) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }

        const unlockedAchievementFanfareItems = unlockedAchievements.map((achievement) => ({
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
        }));
        const existingCorrectAnswers = Math.max(
          toNonNegativeStatValue(playerData?.stats?.totalWins),
          toNonNegativeStatValue(playerData?.stats?.challengeWins),
        );
        const correctAnswersAfterWin = existingCorrectAnswers + 1;

        const xpValue = Number(playerData?.stats?.xp ?? 0);
        const totalScoreValue = Number(playerData?.stats?.totalScore ?? 0);
        const currentXp = Math.max(
          Number.isFinite(xpValue) ? xpValue : 0,
          Number.isFinite(totalScoreValue) ? totalScoreValue : 0,
        );
        const earnedXp = Math.max(0, Number(result.scoreEarned || 0));
        const previousLevel = getXpLevel(currentXp).level;
        const nextLevel = getXpLevel(currentXp + earnedXp).level;
        const didLevelUp = earnedXp > 0 && nextLevel > previousLevel;
        const previousRank = getRankForLevel(previousLevel);
        const nextRank = getRankForLevel(nextLevel);
        const didReachNewRank = nextRank.id !== previousRank.id;
        // Prefer server-provided breakdown when available; fall back to
        // client-side constants for older deployments or error cases.
        const rewardBreakdown = result.rewardBreakdown;

        const levelUpBonusCoins = rewardBreakdown?.levelUpBonus ?? (didLevelUp ? LEVEL_UP_COIN_BONUS : 0);
        const resolvedDailyStreak =
          gameMode === "daily" ? (result.newWinStreak ?? deriveDailyStreakAfterWin()) : undefined;
        const dailyChallengeBonusCoins =
          rewardBreakdown?.dailyStreakBonus ??
          (gameMode === "daily" && resolvedDailyStreak ? getStreakRewardBonus(resolvedDailyStreak) : 0);
        const achievementBonusCoins = rewardBreakdown?.achievementBonus ?? 0;
        const totalBonusCoinsAwarded = levelUpBonusCoins + dailyChallengeBonusCoins + achievementBonusCoins;
        const totalCoinsAfterWin =
          rewardBreakdown?.newBalance ?? currentUserCoins + (result.coinsEarned || 0) + totalBonusCoinsAwarded;
        const totalCoinsToAnimate = (result.coinsEarned || 0) + totalBonusCoinsAwarded;
        const coinCountUpDurationMs = Math.min(2500, 400 + Math.sqrt(Math.max(0, totalCoinsToAnimate)) * 180) + 500;

        const playDeferredCoinAnimation = async () => {
          if (totalCoinsToAnimate <= 0) {
            return;
          }

          if (coinAnimationSettleTimeoutRef.current) {
            clearTimeout(coinAnimationSettleTimeoutRef.current);
            coinAnimationSettleTimeoutRef.current = null;
          }

          // Explicitly resume deferred coin animation after final modal dismissal.
          setIsAwaitingPostSubmitModalClose(false);
          setCanAnimateCoinIncreases(true);
          await safeDelay(coinCountUpDurationMs);
        };

        const continueToNextLevel = async () => {
          logger.debug("Victory modal: Next level button pressed");
          resetRoundState();

          try {
            await runWithServerLoading(() => onNextLevel());
          } catch (error) {
            logger.error("Error calling onNextLevel:", error);
            captureException(error);
          } finally {
            setIsTransitioningToNextLevel(false);
          }
        };

        const completionPopupCount =
          unlockedAchievementFanfareItems.length + 1 + (didLevelUp ? 1 : 0) + (didReachNewRank ? 1 : 0);
        const shouldUseSharedFanfareBackground = completionPopupCount > 1;
        const sharedFanfareBackgroundProps = shouldUseSharedFanfareBackground
          ? {showRotatingBackground: false}
          : {};

        const completionPopupSequence: ModalSequenceStep[] = [
          ...unlockedAchievementFanfareItems.map((achievement, index) => ({
            name: `achievement-${achievement.name}`,
            open: (sequenceProgress: ModalSequenceProgress, onContinue: () => void | Promise<void>) => {
              modal.showAchievementUnlockFanfareModal({
                ...sharedFanfareBackgroundProps,
                coinsEarned: index === 0 ? achievementBonusCoins || result.coinsEarned || 0 : 0,
                totalCoins: totalCoinsAfterWin,
                achievementNames: [achievement.name],
                achievements: [achievement],
                sequenceProgress,
                onContinue,
              });
            },
          })),
          {
            name: "victory",
            open: (sequenceProgress: ModalSequenceProgress, onContinue: () => void | Promise<void>) => {
              modal.showVictoryModal({
                ...sharedFanfareBackgroundProps,
                attempts: resolvedAttempts,
                coinsEarned: (rewardBreakdown?.totalAwarded as number) ?? result.coinsEarned ?? 0,
                totalCoins: totalCoinsAfterWin,
                streakValue: resolvedDailyStreak,
                unlockedAchievementNames,
                guesses,
                sequenceProgress,
                onNext: async () => {
                  modal.closeModalByType("victory");
                  await Promise.resolve(onContinue());
                },
              });
            },
          },
          ...(didLevelUp
            ? [
                {
                  name: "level-up",
                  open: (sequenceProgress: ModalSequenceProgress, onContinue: () => void | Promise<void>) => {
                    modal.showLevelUpFanfareModal({
                      ...sharedFanfareBackgroundProps,
                      newLevel: nextLevel,
                      coinsAwarded: levelUpBonusCoins,
                      totalCoins: totalCoinsAfterWin,
                      sequenceProgress,
                      onContinue,
                    });
                  },
                },
              ]
            : []),
          ...(didReachNewRank
            ? [
                {
                  name: "rank-up",
                  open: (sequenceProgress: ModalSequenceProgress, onContinue: () => void | Promise<void>) => {
                    modal.showRankUpFanfareModal({
                      ...sharedFanfareBackgroundProps,
                      newLevel: nextLevel,
                      sequenceProgress,
                      onContinue,
                    });
                  },
                },
              ]
            : []),
        ];

        const fanfareBackgroundModalId = shouldUseSharedFanfareBackground
          ? modal.openModal(FANFARE_SEQUENCE_BACKGROUND_MODAL_TYPE, {}, {priority: -1, persistent: true})
          : null;

        runModalFanfareSequence(completionPopupSequence, {
          closeDelayMs: MODAL_CLOSE_DELAY_MS,
          delay: safeDelay,
          nextActionText: t("GameScreenAlerts.NEXT_BUTTON") ?? "Next",
          onComplete: async () => {
            await Promise.resolve();
            if (fanfareBackgroundModalId) {
              modal.closeModal(fanfareBackgroundModalId);
            }
            await safeDelay(MODAL_CLOSE_DELAY_MS);
            await showPostVictoryInterstitialAd();
            setIsTransitioningToNextLevel(true);
            void playDeferredCoinAnimation();
            await continueToNextLevel();
            if (unlockedAchievementFanfareItems.length > 0) {
              void showTooltipOnce("achievementEarned", profileButtonRef);
            }
            if (correctAnswersAfterWin >= FIFTH_CORRECT_ANSWER_COUNT) {
              void showTooltipOnce("leaderboardFifthCorrectAnswer", profileButtonRef);
            }
          },
        });

        const baseWinCoins = rewardBreakdown?.baseWinCoins ?? (result.coinsEarned || 0);

        if (rewardBreakdown) {
          onGameWin(
            resolvedAttempts,
            baseWinCoins,
            result.scoreEarned || 0,
            resolvedDailyStreak,
            totalBonusCoinsAwarded,
            true,
          );
        } else {
          onGameWin(
            resolvedAttempts,
            baseWinCoins,
            result.scoreEarned || 0,
            resolvedDailyStreak,
            totalBonusCoinsAwarded,
          );
        }
      } else if (result.outcome === "attemptLimitReached") {
        const canAffordCoinContinue = currentUserCoins >= CONTINUE_COST_COINS;
        const skipLevelCost = SKIP_COST_CLASSIC;
        // Cache keyboard hints as soon as the loss modal opens so they survive
        // any continue/close timing differences while the grid resets.
        setPreservedLetterStates((existing) => mergeLetterStates(existing, computeLetterStates(guesses)));

        void safeDelay(RESULT_MODAL_REVEAL_DELAY_MS).then(() => {
          if (!isMountedRef.current || latestResultRef.current !== result) {
            return;
          }

          modal.showLossModal({
            correctAnswer: result.correctAnswer || "",
            totalCoins: currentUserCoins,
            onWatchAdContinue: result.canOfferRewardedAd
              ? () => {
                  void analyticsService.logGameInteraction("continue_with_ad_selected", {
                    game_mode: gameMode,
                    ad_ready: isRewardedAdReady,
                  });
                  modal.closeModalByType("loss");
                  void runRewardedAdContinueFlow();
                  return true;
                }
              : undefined,
            onCoinContinue: result.canOfferCoinContinue ? handleCoinContinue : undefined,
            coinContinueCost: CONTINUE_COST_COINS,
            skipLevelCost,
            canWatchAd: isRewardedAdReady,
            canUseCoin: canAffordCoinContinue,
            onOpenShop: () => openShopFromLossRef.current(),
            onNext: () => {
              void analyticsService.logGameInteraction("loss_next_selected", {
                game_mode: gameMode,
                outcome: "attempt_limit_reached",
              });
              modal.closeModalByType("loss");
              resetRoundState();
              runWithServerLoading(() => onNextLevel()).catch((error) => {
                logger.error("Error loading next level after attempt limit:", error);
                captureException(error);
              });
            },
          });
        });
      } else if (result.outcome === "loss") {
        const resolvedAttempts = lastSubmittedAttemptRef.current ?? guesses.length;
        if (isHapticsEnabled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        const skipLevelCost = SKIP_COST_CLASSIC;

        void safeDelay(RESULT_MODAL_REVEAL_DELAY_MS).then(() => {
          if (!isMountedRef.current || latestResultRef.current !== result) {
            return;
          }

          modal.showLossModal({
            correctAnswer: result.correctAnswer || "",
            totalCoins: currentUserCoins,
            skipLevelCost,
            onOpenShop: () => openShopFromLossRef.current(),
            onNext: () => {
              void analyticsService.logGameInteraction("loss_next_selected", {
                game_mode: gameMode,
                outcome: "lost",
              });
              modal.closeModalByType("loss");
              resetRoundState();
              runWithServerLoading(() => onNextLevel()).catch((error) => {
                logger.error("Error loading next level after loss:", error);
                captureException(error);
              });
            },
          });
        });

        if (result.correctAnswer) {
          onGameLoss(result.correctAnswer, resolvedAttempts);
        }
      }
    }
  }, [
    gameOver,
    lastGuessResult,
    modal,
    guesses,
    isHapticsEnabled,
    currentUserCoins,
    gameMode,
    onGameWin,
    onGameLoss,
    onNextLevel,
    resetRoundState,
    deriveDailyStreakAfterWin,
    runRewardedAdContinueFlow,
    showPostVictoryInterstitialAd,
    handleCoinContinue,
    isRewardedAdReady,
    runWithServerLoading,
    playerData,
    playerData?.stats?.xp,
    playerData?.stats?.totalScore,
    playerData?.stats?.totalWins,
    playerData?.stats?.challengeWins,
    updatePlayerDataLocally,
    showTooltipOnce,
  ]);

  const toggleSoundEnabled = useCallback((isEnabled: boolean) => {
    void analyticsService.logGameInteraction("sound_toggled", {enabled: isEnabled});
    toggleSoundEnabledSetting(isEnabled);
  }, [toggleSoundEnabledSetting]);

  const toggleHapticsEnabled = useCallback((isEnabled: boolean) => {
    void analyticsService.logGameInteraction("haptics_toggled", {enabled: isEnabled});
    toggleHapticsEnabledSetting(isEnabled);
  }, [toggleHapticsEnabledSetting]);

  const handleChangeLanguage = useCallback((language: SupportedLanguage) => {
    void analyticsService.logGameInteraction("language_changed", {language});
    void persistLocale(language);
    void updatePlayerData({preferredLanguage: language}).catch((error) => {
      logger.error("Error saving language preference to player profile:", error);
      captureException(error);
    });
  }, [updatePlayerData]);

  const handleSubmit = useCallback(async () => {
    tooltip.dismissTooltip("submitAnswer");
    const isGuessComplete =
      currentGuess.length === playableAnswerLength &&
      currentGuess.every((letter) => typeof letter === "string" && letter.length > 0);

    if (isGuessComplete) {
      try {
        // Always allow the next completed guess result to trigger exactly one modal flow.
        gameOverHandledRef.current = false;
        setLastGuessResult(null);
        lastSubmittedAttemptRef.current = guesses.length + 1;
        // Pause header coin count-up immediately so modal-driven result flows
        // can decide exactly when deferred animations should resume.
        setCanAnimateCoinIncreases(false);
        const result = (await runWithServerLoading(() => processGuess(currentGuess))) as GuessResult;
        const lockedGuessState = buildLockedGuessState(currentGuess, result.feedback, playableAnswerLength);
        setLastGuessResult(result);
        if (result.outcome === "continue") {
          pendingLockedGuessStateRef.current = null;
          applyLockedGuessState(lockedGuessState);
          void showTooltipOnce("hintAfterWrongGuess", hintButtonRef);
        } else if (result.outcome === "attemptLimitReached") {
          pendingLockedGuessStateRef.current = lockedGuessState;
        } else {
          pendingLockedGuessStateRef.current = null;
        }
        const willOpenResultModal = result.outcome !== "continue";
        setIsAwaitingPostSubmitModalClose(willOpenResultModal);
        if (!willOpenResultModal) {
          // No win/loss modal sequence is coming, so re-enable right away.
          setCanAnimateCoinIncreases(true);
        }
      } catch (error) {
        logger.error("Error processing guess in GameScreen:", error);
        captureException(error);
        setIsAwaitingPostSubmitModalClose(false);
        setCanAnimateCoinIncreases(true);
        modal.showInfoModal({
          title: t("GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE"),
          message: t("GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE"),
        });
      }
    } else if (isHapticsEnabled) {
      void analyticsService.logGameInteraction("submit_invalid", {
        game_mode: gameMode,
        filled_slots: currentGuess.filter(Boolean).length,
        answer_length: playableAnswerLength,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [
    currentGuess,
    guesses.length,
    playableAnswerLength,
    processGuess,
    isHapticsEnabled,
    applyLockedGuessState,
    modal,
    runWithServerLoading,
    showTooltipOnce,
    tooltip,
    gameMode,
  ]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (playableAnswerLength <= 0) return;
      const targetIndex = resolveEditableGuessSlot(
        activeSlotIndexRef.current,
        playableAnswerLength,
        hintRevealedIndicesRef.current,
      );
      if (targetIndex === null) return;

      setCurrentGuess((prev: string[]) => {
        const next = [...prev];
        while (next.length <= targetIndex) {
          next.push("");
        }
        next[targetIndex] = key;
        if (next.length > playableAnswerLength) {
          next.length = playableAnswerLength;
        }
        return next;
      });
      gameEventBus.emit<LetterAddedEvent>({
        type: "LETTER_ADDED",
        letter: key,
        position: targetIndex,
      });

      setActiveSlotIndexSynced(
        resolveNextActiveGuessSlot(targetIndex, playableAnswerLength, hintRevealedIndicesRef.current),
      );
    },
    [playableAnswerLength, setCurrentGuess, setActiveSlotIndexSynced],
  );

  const handleBackspace = useCallback(() => {
    if (playableAnswerLength <= 0) return;
    const targetIndex = resolveBackspaceGuessSlot(
      activeSlotIndexRef.current,
      currentGuess,
      playableAnswerLength,
      hintRevealedIndicesRef.current,
    );
    if (targetIndex === null) return;

    setCurrentGuess((prev: string[]) => {
      const next = [...prev];
      next[targetIndex] = "";
      while (next.length > 0 && !next[next.length - 1]) {
        next.pop();
      }
      return next;
    });
    gameEventBus.emit<LetterRemovedEvent>({
      type: "LETTER_REMOVED",
      position: targetIndex,
    });

    setActiveSlotIndexSynced(targetIndex);
  }, [playableAnswerLength, currentGuess, setCurrentGuess, setActiveSlotIndexSynced]);

  const handleSelectCurrentGuessSlot = useCallback(
    (slotIndex: number) => {
      if (playableAnswerLength <= 0) return;
      if (slotIndex < 0 || slotIndex >= playableAnswerLength) return;
      const editableSlotIndex = resolveEditableGuessSlot(
        slotIndex,
        playableAnswerLength,
        hintRevealedIndicesRef.current,
      );
      if (editableSlotIndex === null) return;
      void analyticsService.logGameInteraction("guess_slot_selected", {
        position: editableSlotIndex,
        game_mode: gameMode,
      });
      setActiveSlotIndexSynced(editableSlotIndex);
    },
    [playableAnswerLength, setActiveSlotIndexSynced, gameMode],
  );

  const handleShowHint = useCallback(async () => {
    if (!playerData?.userId) return;
    void analyticsService.logGameInteraction("hint_opened", {
      game_mode: gameMode,
      can_afford: currentUserCoins >= hintCost,
    });
    tooltip.dismissTooltip("hintAfterWrongGuess");

    if (currentUserCoins < hintCost) {
      void showTooltipOnce("shopOutOfCoins", coinsButtonRef);
    }

    logger.debug("Showing hint modal for riddle:", riddleId);

    modal.showHintModal({
      userCoins: currentUserCoins,
      hintCost,
      onOpenShop: () => openShopFromLossRef.current(),
      onShowHint: () => {
        gameEventBus.emit<HintRequestedEvent>({
          type: "HINT_REQUESTED",
          hintType: "letter",
        });
        (async () => {
          // Guest/local flow: reveal locally and call onHintUsed to persist via
          // the surrounding navigation stack.
          if (isGuestMode || !playerData?.userId) {
            const answerLetters = splitGraphemes(playableAnswer, currentLanguage).map((letter) =>
              letter.toLocaleLowerCase(currentLanguage),
            );
            const revealIndex = answerLetters.findIndex((_, i) => !hintRevealedIndicesRef.current.includes(i));

            if (revealIndex === -1) {
              modal.showInfoModal({
                title: t("GameScreenAlerts.HINT_NOT_AVAILABLE_TITLE"),
                message: t("GameScreenAlerts.HINT_NOT_AVAILABLE_MESSAGE"),
              });
              return;
            }

            const nextHintRevealedIndices = [...hintRevealedIndicesRef.current, revealIndex];
            setHintRevealedIndicesSynced(nextHintRevealedIndices);

            setCurrentGuess((prev: string[]) => {
              const newGuess = [...prev];
              while (newGuess.length <= revealIndex) {
                newGuess.push("");
              }
              newGuess[revealIndex] = answerLetters[revealIndex];
              return newGuess;
            });
            setActiveSlotIndexSynced(
              resolveEditableGuessSlot(activeSlotIndexRef.current, playableAnswerLength, nextHintRevealedIndices) ??
                Math.max(0, Math.min(playableAnswerLength - 1, activeSlotIndexRef.current)),
            );

            Promise.resolve(onHintUsed(hintCost)).catch((e) => logger.error("onHintUsed error:", e));
            void analyticsService.logCoinSpend({
              action: "hint",
              amount: hintCost,
              gameMode,
            });
            return;
          }

          // Authenticated flow: ask server for authoritative hint.
          try {
            const backendGameMode = gameMode === "daily" ? "challenge" : "classic";
            const fullAttempt = Array.from({length: playableAnswerLength}, (_, i) => currentGuess[i] ?? "");
            const data = await callValidatedFunction(
              "getHint",
              {currentAttempt: fullAttempt, riddleId, gameMode: backendGameMode},
              GetHintInputSchema,
              GetHintOutputSchema,
            );

            if (!data) {
              modal.showInfoModal({
                title: t("GameScreenAlerts.HINT_NOT_AVAILABLE_TITLE"),
                message: t("GameScreenAlerts.HINT_NOT_AVAILABLE_MESSAGE"),
              });
              return;
            }

            const revealIndex = data.index;
            const revealedLetter = (data.revealedLetter || "").toUpperCase();

            const nextHintRevealedIndices = [...hintRevealedIndicesRef.current, revealIndex];
            setHintRevealedIndicesSynced(nextHintRevealedIndices);

            setCurrentGuess((prev: string[]) => {
              const newGuess = [...prev];
              while (newGuess.length <= revealIndex) {
                newGuess.push("");
              }
              newGuess[revealIndex] = revealedLetter;
              return newGuess;
            });

            setActiveSlotIndexSynced(
              resolveEditableGuessSlot(activeSlotIndexRef.current, playableAnswerLength, nextHintRevealedIndices) ??
                Math.max(0, Math.min(playableAnswerLength - 1, activeSlotIndexRef.current)),
            );

            if (typeof updatePlayerDataLocally === "function" && data.newCoins !== undefined) {
              updatePlayerDataLocally({coins: data.newCoins}, {syncToFirestore: false});
            }
            void analyticsService.logCoinSpend({
              action: "hint",
              amount: hintCost,
              gameMode,
            });

            const newlyUnlocked = data.newlyUnlockedAchievementIds ?? [];
            if (newlyUnlocked.length > 0) {
              const unlockedAchievements = newlyUnlocked
                .map((achievementId: string) =>
                  ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === achievementId),
                )
                .filter(
                  (
                    achievement: (typeof ACHIEVEMENT_DEFINITIONS)[number] | undefined,
                  ): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] => Boolean(achievement),
                );

              const totalCoinsAfterHint = data.newCoins ?? currentUserCoins - hintCost;
              const showAchievementFanfareAtIndex = (index: number) => {
                if (index >= unlockedAchievements.length) {
                  return;
                }

                const achievement = unlockedAchievements[index];
                modal.showAchievementUnlockFanfareModal({
                  coinsEarned: 0,
                  totalCoins: totalCoinsAfterHint,
                  achievementNames: [achievement.name],
                  achievements: [
                    {
                      name: achievement.name,
                      description: achievement.description,
                      icon: achievement.icon,
                    },
                  ],
                  onContinue: () => {
                    void safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                      showAchievementFanfareAtIndex(index + 1);
                    });
                  },
                });
              };

              showAchievementFanfareAtIndex(0);
            }
          } catch (err) {
            logger.error("Error requesting hint from server:", err);
            captureException(err);
            modal.showInfoModal({
              title: t("GameScreenAlerts.HINT_ERROR_TITLE"),
              message: t("GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE"),
            });
          }
        })();
      },
    });
  }, [
    currentGuess,
    gameMode,
    isGuestMode,
    playerData?.userId,
    riddleId,
    modal,
    currentUserCoins,
    hintCost,
    playableAnswer,
    playableAnswerLength,
    setCurrentGuess,
    setActiveSlotIndexSynced,
    setHintRevealedIndicesSynced,
    updatePlayerDataLocally,
    onHintUsed,
    showTooltipOnce,
    tooltip,
    currentLanguage,
  ]);

  const handleCoinsPress = useCallback(async () => {
    void analyticsService.logGameInteraction("coin_shop_opened", {
      game_mode: gameMode,
      source: latestResultRef.current?.outcome === "attemptLimitReached" ? "loss_modal" : "game_header",
    });
    tooltip.dismissTooltip("shopOutOfCoins");
    let productsForModal = iapProducts;
    let firestoreProductsForModal = firestoreProducts;

    if (!hasLoadedShopCatalogRef.current) {
      const {iapResult, firestoreResult} = await ensureShopCatalogLoaded();
      productsForModal = iapResult.products;
      firestoreProductsForModal = firestoreResult.products;
    }

    const availableStoreProductIds = new Set(
      productsForModal
        .map((product) => product.id ?? (product as {productId?: string}).productId)
        .filter((productId): productId is string => typeof productId === "string"),
    );
    const purchasableFirestoreProducts = shouldUseFullFirestoreCatalog
      ? firestoreProductsForModal
      : firestoreProductsForModal.filter((product) => availableStoreProductIds.has(product.productId));

    if (__DEV__) {
      logger.debug("Opening coin shop modal with:", {
        iapProducts: productsForModal.length,
        firestoreProducts: firestoreProductsForModal.length,
        purchasableFirestoreProducts: purchasableFirestoreProducts.length,
        shouldUseFullFirestoreCatalog,
        iapLoading,
        productPricingLoading,
        iapError,
        productPricingError,
      });
    }

    try {
      modal.showCoinShop({
        products: productsForModal,
        firestoreProducts: purchasableFirestoreProducts,
        currentCoins: currentUserCoins,
        loading: iapLoading || productPricingLoading,
        error: iapError || productPricingError,
        onPurchaseProduct: handlePurchaseProduct,
        onWatchVideo: handleWatchAdForCoins,
        onPayAndPlay: handlePayAndPlay,
      });
    } catch (error) {
      logger.error("Error opening coin shop:", error);
      captureException(error);
      modal.showInfoModal({
        title: t("CommonAlerts.ERROR_TITLE"),
        message: t("CoinShop.NO_PACKS_AVAILABLE"),
      });
    }
  }, [
    ensureShopCatalogLoaded,
    iapProducts,
    firestoreProducts,
    shouldUseFullFirestoreCatalog,
    iapLoading,
    productPricingLoading,
    iapError,
    productPricingError,
    modal,
    currentUserCoins,
    handlePurchaseProduct,
    handleWatchAdForCoins,
    handlePayAndPlay,
    tooltip,
    gameMode,
  ]);

  const handleOverlayNext = useCallback(() => {
    void analyticsService.logGameInteraction("skip_opened", {
      game_mode: gameMode,
      can_afford: currentUserCoins >= (gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC),
    });
    tooltip.dismissTooltip("classicFromDaily");
    logger.debug("Next button pressed - opening skip modal");

    const skipCost = gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC;

    modal.showSkipModal({
      userCoins: currentUserCoins,
      totalCoins: currentUserCoins,
      skipCost,
      onOpenShop: handleCoinsPress,
      onSkipLevel: async () => {
        void analyticsService.logGameInteraction("skip_confirmed", {
          game_mode: gameMode,
          cost: skipCost,
        });
        try {
          if (!isGuestMode) {
            await runWithServerLoading(() =>
              callValidatedFunction(
                "spendCoins",
                {
                  reason: "skip",
                  gameMode: gameMode === "daily" ? "challenge" : "classic",
                },
                SpendCoinsInputSchema,
                SpendCoinsOutputSchema,
              ),
            );
          }

          onSkipUsed(skipCost);
          void analyticsService.logCoinSpend({
            action: "skip",
            amount: skipCost,
            gameMode,
          });
          resetRoundState();
          await runWithServerLoading(() => onNextLevel());
        } catch (error) {
          logger.error("Error spending coins for skip:", error);
          captureException(error);
          modalActions.showSpendCoinsError();
        }
      },
    });
  }, [
    gameMode,
    modal,
    currentUserCoins,
    handleCoinsPress,
    resetRoundState,
    onNextLevel,
    onSkipUsed,
    runWithServerLoading,
    modalActions,
    isGuestMode,
    tooltip,
  ]);

  const handleSettingsPress = useCallback(() => {
    logger.debug("Settings button pressed - opening settings modal");
    void analyticsService.logGameInteraction("settings_opened", {
      game_mode: gameMode,
    });
    modal.showSettingsModal({
      isSoundEnabled,
      isHapticsEnabled,
      currentLanguage,
      onToggleSound: toggleSoundEnabled,
      onToggleHaptics: toggleHapticsEnabled,
      onChangeLanguage: handleChangeLanguage,
      onPressLogout: logout,
      onPressHelp: () => {
        logger.debug("Help button pressed - opening support email composer");
        void analyticsService.logGameInteraction("support_opened", {
          game_mode: gameMode,
        });
        void Linking.openURL("mailto:support@adspeq.com").catch((error) => {
          logger.error("Failed to open support email composer:", error);
          captureException(error);
        });
      },
      onPressCredits: () => {
        logger.debug("Credits button pressed - closing settings and opening credits modal");
        modal.closeModalByType("settings");
        setTimeout(() => {
          modal.showCreditsModal();
        }, MODAL_CLOSE_DELAY_MS);
      },
      onPressAbout: () => {
        logger.debug("About button pressed - closing settings and opening about/legal modal");
        modal.closeModalByType("settings");
        setTimeout(() => {
          modal.showAboutLegalModal();
        }, MODAL_CLOSE_DELAY_MS);
      },
      playerData: playerData ?? null,
    });
  }, [
    modal,
    isSoundEnabled,
    playerData,
    isHapticsEnabled,
    currentLanguage,
    toggleSoundEnabled,
    toggleHapticsEnabled,
    handleChangeLanguage,
    logout,
    gameMode,
  ]);

  const handleProfilePress = useCallback(async () => {
    void analyticsService.logGameInteraction("profile_opened", {
      game_mode: gameMode,
    });
    tooltip.dismissTooltip("achievementEarned");
    tooltip.dismissTooltip("leaderboardFifthCorrectAnswer");
    if (isProfileModalLoading) {
      return;
    }

    const loadingStartedAt = Date.now();
    setIsProfileModalLoading(true);
    let latestPlayerData = playerData;

    try {
      if (!isGuestMode && playerData?.userId) {
        try {
          const refreshedProfile = await runWithServerLoading(() => loadUserProgressFromFirestore(playerData.userId));

          if (refreshedProfile) {
            const resolvedProfile = resolveProfileSnapshot(playerData, refreshedProfile);
            latestPlayerData = resolvedProfile;
            updatePlayerDataLocally(resolvedProfile, {
              syncToFirestore: false,
            });
          }
        } catch (error) {
          logger.error("Error loading profile data before opening modal:", error);
          captureException(error);
        }
      }

      const minSpinnerMs = 300;
      const elapsedMs = Date.now() - loadingStartedAt;
      if (elapsedMs < minSpinnerMs) {
        await safeDelay(minSpinnerMs - elapsedMs);
      }

      modal.showFullProfileDetailsModal({
        playerData: latestPlayerData,
      });
    } finally {
      setIsProfileModalLoading(false);
    }
  }, [
    modal,
    playerData,
    isGuestMode,
    runWithServerLoading,
    updatePlayerDataLocally,
    isProfileModalLoading,
    tooltip,
    gameMode,
  ]);

  useEffect(() => {
    openShopFromLossRef.current = handleCoinsPress;
  }, [handleCoinsPress]);

  const handleDebugCompleteRiddle = useCallback(() => {
    if (gameOver) return;

    const solvedGuess = splitGraphemes(playableAnswer, currentLanguage).map((letter) =>
      letter.toLocaleUpperCase(currentLanguage),
    );
    setCurrentGuess(solvedGuess);
    setActiveSlotIndexSynced(Math.max(0, playableAnswerLength - 1));
  }, [gameOver, playableAnswer, currentLanguage, playableAnswerLength, setCurrentGuess, setActiveSlotIndexSynced]);

  const handleDebugGenerateDailyChallenge = useCallback(async () => {
    try {
      await runWithServerLoading(() =>
        callValidatedFunction(
          "generateTodaysDailyChallengeFunction",
          {
            forceGenerate: true,
          },
          GenerateTodaysDailyChallengeInputSchema,
          GenerateTodaysDailyChallengeOutputSchema,
        ),
      );

      modal.showInfoModal({
        title: t("GameScreenAlerts.DEBUG_DAILY_CHALLENGE_GENERATED_TITLE"),
        message: t("GameScreenAlerts.DEBUG_DAILY_CHALLENGE_GENERATED_MESSAGE"),
      });
    } catch (error) {
      logger.error("Error generating daily challenge from debug panel:", error);
      captureException(error);

      modal.showInfoModal({
        title: t("GameScreenAlerts.DEBUG_DAILY_CHALLENGE_ERROR_TITLE"),
        message: t("GameScreenAlerts.DEBUG_DAILY_CHALLENGE_ERROR_MESSAGE"),
      });
    }
  }, [runWithServerLoading, modal]);

  const handleDebugClearLocalData = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      await logout();
    } catch (error) {
      logger.error("Error clearing local data from debug panel:", error);
      captureException(error);
      modal.showInfoModal({
        title: t("GameScreenAlerts.DEBUG_CLEAR_LOCAL_DATA_ERROR_TITLE"),
        message: t("GameScreenAlerts.DEBUG_CLEAR_LOCAL_DATA_ERROR_MESSAGE"),
      });
    }
  }, [logout, modal]);

  const isSubmitDisabled = useMemo(
    () =>
      currentGuess.length !== playableAnswerLength ||
      currentGuess.some((letter) => typeof letter !== "string" || letter.length === 0),
    [currentGuess, playableAnswerLength],
  );

  useEffect(() => {
    if (suppressOnboarding || !isOnboardingComplete || isUpgradeModalVisible || hasQueuedSubmitTooltipRef.current) {
      return;
    }

    hasQueuedSubmitTooltipRef.current = true;
    const timeoutId = setTimeout(() => {
      void showTooltipOnce("submitAnswer", submitButtonRef);
    }, 650);

    return () => clearTimeout(timeoutId);
  }, [isOnboardingComplete, isUpgradeModalVisible, showTooltipOnce, suppressOnboarding]);

  const headerModeLabel =
    gameMode === "daily"
      ? t("GameScreenAlerts.DAILY_CHALLENGE_LABEL")
      : t("GameScreenAlerts.CLASSIC_LABEL");
  const spinnerSize = isTransitioningToNextLevel ? 120 : LOADING_SPINNER_SIZE;
  const spinnerOpacity = isTransitioningToNextLevel ? 0.8 : LOADING_SPINNER_OPACITY;

  return (
    <View style={{flex: 1}}>
      <StarryBackground />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          style={[
            styles.gameContainer,
            isAnyModalVisible && styles.overlayVisible,
            isTablet && styles.gameContainerTablet,
            isLargeTablet && styles.gameContainerLargeTablet,
            isDesktop && styles.gameContainerDesktop,
          ]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Header
            userCoins={currentUserCoins}
            onCoinsPress={handleCoinsPress}
            modeLabel={headerModeLabel}
            shouldAnimateCoins={canAnimateCoinIncreases}
            coinsButtonRef={coinsButtonRef}
          />

          <GameBoard
            riddleText={playableRiddleText}
            guesses={guesses}
            currentGuess={currentGuess}
            answerLength={playableAnswerLength}
            handleKeyPress={handleKeyPress}
            handleBackspace={handleBackspace}
            isAnyOverlayVisible={isInteractionBlocked}
            letterStates={letterStates}
            hintRevealedIndices={hintRevealedIndices}
            activeSlotIndex={activeSlotIndex}
            onSelectCurrentGuessSlot={handleSelectCurrentGuessSlot}
          />

          {tooltip.activeTooltipId === "submitAnswer" ? (
            <View pointerEvents="none" style={SUBMIT_TOOLTIP_BACKDROP_LAYER} testID="submit-tooltip-local-backdrop" />
          ) : null}

          <GameInput
            isSubmitDisabled={isSubmitDisabled}
            gameOver={gameOver}
            handleSubmit={handleSubmit}
            handleHint={handleShowHint}
            handleNext={handleOverlayNext}
            hintButtonRef={hintButtonRef}
            submitButtonRef={submitButtonRef}
            nextButtonRef={nextButtonRef}
            isSubmitTooltipTargetActive={tooltip.activeTooltipId === "submitAnswer"}
          />

          <BottomNavigationBar
            onProfilePress={handleProfilePress}
            onSettingsPress={handleSettingsPress}
            profileButtonRef={profileButtonRef}
          />

        </KeyboardAvoidingView>

        <PulsingSpinner
          visible={isLoading || isProfileModalLoading || isPurchaseInProgress || isTransitioningToNextLevel}
          size={spinnerSize}
          opacity={spinnerOpacity}
        />

        <ModalProvider />
        <GuestOnboardingModal
          isVisible={isGuestOnboardingModalVisible}
          onClose={completeGuestOnboarding}
          onUpgrade={handleGuestOnboardingUpgrade}
        />
        <OfflineBlockingModal isVisible={isOffline} />
        {isGuestMode ? (
          <UpgradeAccountModal
            isVisible={isGuestMode && isUpgradeModalVisible}
            onClose={() => setIsUpgradeModalVisible(false)}
          />
        ) : null}

        <Controls onNextPress={handleOverlayNext} isWin={gameOver && lastGuessResult?.outcome === "win"} />

        {__DEV__ && !suppressOnboarding && (
          <ModalTogglePanel
            onCompleteRiddle={handleDebugCompleteRiddle}
            onGenerateDailyChallenge={handleDebugGenerateDailyChallenge}
            onClearLocalData={handleDebugClearLocalData}
            onWatchRewardedAdForCoins={() => {
              void handleWatchAdForCoins();
            }}
            onWatchRewardedAdForLossContinue={() => {
              void runRewardedAdContinueFlow();
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const GameScreen = React.memo(GameScreenInner);
export default GameScreen;
