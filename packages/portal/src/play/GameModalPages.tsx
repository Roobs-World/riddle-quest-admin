import {useEffect} from "react";
import type {GameModal, GameSessionState} from "./gameSession";
import {
  ContinueModalPage,
  HintModalPage,
  SkipModalPage,
  TreasureModalPage,
} from "./modalPages/commerce/CoinActionModalPages";
import {ShopModalPage} from "#shop-modal-page";
import {AboutModalPage, CreditsModalPage, InstructionsModalPage} from "./modalPages/information/InformationModalPages";
import {LeaderboardModalPage} from "./modalPages/leaderboard/LeaderboardModalPage";
import {ProfileModalPage} from "./modalPages/profile/ProfileModalPage";
import {AchievementsModalPage, RanksModalPage, StatisticsModalPage} from "./modalPages/profile/ProfileStatsModalPages";
import {UsernameModalPage} from "./modalPages/profile/UsernameModalPage";
import {SettingsModalPage} from "./modalPages/settings/SettingsModalPage";

/** State and handlers routed to modal-specific page components. */
export type GameModalPagesProps = {
  /** Stores state. */
  state: GameSessionState;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
  /** Optional target-funded extra attempt; absent on unsupported targets. */
  onRecoverAttempt?: () => void;
  continuationPending?: boolean;
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
  /** Stores on request hint. */
  onRequestHint: () => void;
  /** Stores on request skip. */
  onRequestSkip: () => void;
  /** Stores on request leaderboard. */
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak") => void;
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
  onRecoverAttempt,
  continuationPending = false,
  onPurchase,
  onOpenModal,
  onToggleMute,
  commerceAvailable = true,
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

  useEffect(() => {
    if (state.modal === "leaderboard") onRequestLeaderboard(state.leaderboardType);
  }, [onRequestLeaderboard, state.leaderboardType, state.modal]);

  return (
    <>
      {state.modal === "continue" && (
        <ContinueModalPage
          balance={balance}
          onContinue={onContinue}
          onRecoverAttempt={onRecoverAttempt}
          pending={continuationPending}
          recoveryPending={state.guessPending}
          onSkip={onRequestSkip}
          onOpenModal={onOpenModal}
          commerceAvailable={commerceAvailable}
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
          onOpenModal={onOpenModal}
          onToggleMute={onToggleMute}
          commerceAvailable={commerceAvailable}
        />
      )}

      {state.modal === "achievements" && <AchievementsModalPage profile={profile} />}

      {state.modal === "statistics" && <StatisticsModalPage profile={profile} />}

      {state.modal === "ranks" && <RanksModalPage profile={profile} />}

      {state.modal === "leaderboard" && (
        <LeaderboardModalPage
          key={state.leaderboardType}
          entries={state.leaderboard}
          loading={state.leaderboardLoading}
          leaderboardType={state.leaderboardType}
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

      {state.modal === "skip" && state.gameMode === "classic" && (
        <SkipModalPage
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
