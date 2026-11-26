import {useEffect, useRef} from "react";
import type {GameModal, GameSessionState} from "../../../gameplay/session/gameSession";
import {
  ContinueModalPage,
  HintModalPage,
  SkipModalPage,
  TreasureModalPage,
} from "../../../commerce/components/CoinActionModalPages";
import {ShopModalPage} from "#shop-modal-page";
import {AboutModalPage, CreditsModalPage, InstructionsModalPage} from "../../information/InformationModalPages";
import {LeaderboardModalPage} from "../../../leaderboards/components/LeaderboardModalPage";
import {ProfileModalPage} from "../../../accounts/components/ProfileModalPage";
import {AchievementsModalPage, RanksModalPage, StatisticsModalPage} from "../../../progression/components/ProfileStatsModalPages";
import {UsernameModalPage} from "../../../accounts/components/UsernameModalPage";
import {SettingsModalPage} from "../../../settings/components/SettingsModalPage";

/** State and handlers routed to modal-specific page components. */
export type GameModalPagesProps = {
  /** Stores state. */
  state: GameSessionState;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
  /** Disables competing loss actions while continuation is awaiting completion. */
  continuationPending?: boolean;
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
  /** Paid actions require an actual economy module in the owning host session. */
  economyAvailable?: boolean;
  /** Stores on request hint. */
  onRequestHint: () => void;
  /** Stores on request skip. */
  onRequestSkip: () => void;
  /** Stores on request leaderboard. */
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak" | "multiplayerWins", page?: number) => void;
  /** Stores on update username. */
  onUpdateUsername: (username: string) => void;
  /** Stores on update avatar. */
  onUpdateAvatar: (file: File) => Promise<void>;
  /** Stores on delete account. */
  onDeleteAccount: () => void;
};

/** Routes the active modal to its isolated page component. */
export function GameModalPages({
  state,
  onClose,
  onContinue,
  continuationPending = false,
  onPurchase,
  onOpenModal,
  onToggleMute,
  commerceAvailable = true,
  economyAvailable = true,
  onRequestHint,
  onRequestSkip,
  onRequestLeaderboard,
  onUpdateUsername,
  onUpdateAvatar,
  onDeleteAccount,
}: GameModalPagesProps) {
  /** Provides profile behavior. */
  const profile = state.profile;
  /** Provides balance behavior. */
  const balance = profile?.coins ?? 0;

  /** Page entry owns the initial read; metric clicks and Retry own subsequent reads. */
  const previousModal = useRef<GameModal>(null);
  useEffect(() => {
    /** Initial reads belong to a page transition rather than repeated metric renders. */
    const enteringLeaderboard = state.modal === "leaderboard" && previousModal.current !== "leaderboard";
    previousModal.current = state.modal;
    const invalidatedLeaderboard = state.modal === "leaderboard" && !state.leaderboardLoading &&
      !state.leaderboardLoadError && !state.leaderboardCache[state.leaderboardType]?.[state.leaderboardPage];
    if (enteringLeaderboard || invalidatedLeaderboard) onRequestLeaderboard(state.leaderboardType, state.leaderboardPage);
  }, [onRequestLeaderboard, state.leaderboardCache, state.leaderboardLoadError,
    state.leaderboardLoading, state.leaderboardPage, state.leaderboardType, state.modal]);

  return (
    <>
      {state.modal === "continue" && (
        <ContinueModalPage
          balance={balance}
          onContinue={onContinue}
          pending={continuationPending}
          recoveryPending={state.guessPending}
          onSkip={onRequestSkip}
          onOpenModal={onOpenModal}
          commerceAvailable={commerceAvailable}
          economyAvailable={economyAvailable}
          onDecline={onClose}
        />
      )}

      {state.modal === "shop" && <ShopModalPage balance={balance} products={state.products} onPurchase={onPurchase} />}

      {state.modal === "profile" && (
        <ProfileModalPage
          profile={profile}
          platformRegistered={state.user?.platformRegistered}
          onClose={onClose}
          onOpenModal={onOpenModal}
          onUpdateAvatar={onUpdateAvatar}
          onDeleteAccount={onDeleteAccount}
        />
      )}

      {state.modal === "settings" && (
        <SettingsModalPage
          locale={state.locale}
          muted={state.muted}
          platformRegistered={state.user?.platformRegistered}
          onOpenModal={onOpenModal}
          onToggleMute={onToggleMute}
        />
      )}

      {state.modal === "achievements" && <AchievementsModalPage profile={profile} />}

      {state.modal === "statistics" && <StatisticsModalPage profile={profile} />}

      {state.modal === "ranks" && <RanksModalPage profile={profile} />}

      {state.modal === "leaderboard" && (
        <LeaderboardModalPage
          entries={state.leaderboard}
          loading={state.leaderboardLoading}
          loadError={state.leaderboardLoadError}
          leaderboardType={state.leaderboardType}
          page={state.leaderboardPage}
          nextCursor={state.leaderboardNextCursor}
          onRequestLeaderboard={onRequestLeaderboard}
        />
      )}

      {state.modal === "instructions" && <InstructionsModalPage onClose={onClose} />}

      {state.modal === "hint" && (
        <HintModalPage
          balance={balance}
          onClose={onClose}
          onOpenModal={onOpenModal}
          onRequestAction={onRequestHint}
          commerceAvailable={commerceAvailable}
        />
      )}

      {state.modal === "skip" && (economyAvailable || state.gameMode === "challenge") && (
        <SkipModalPage
          gameMode={state.gameMode}
          balance={balance}
          onClose={onClose}
          onOpenModal={onOpenModal}
          onRequestAction={onRequestSkip}
          commerceAvailable={commerceAvailable}
        />
      )}

      {state.modal === "username" && <UsernameModalPage onUpdateUsername={onUpdateUsername} />}

      {state.modal === "credits" && <CreditsModalPage />}

      {state.modal === "about" && <AboutModalPage onOpenModal={onOpenModal} />}

      {state.modal === "treasure" && (
        <TreasureModalPage balance={balance} onOpenModal={onOpenModal} commerceAvailable={commerceAvailable} />
      )}
    </>
  );
}
