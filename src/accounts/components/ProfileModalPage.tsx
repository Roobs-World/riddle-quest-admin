import {SpinningWheel} from "../../app/components/feedback/SpinningWheelLoader";
import chestUrl from "../../../assets/images-web/chest-closed.webp";
import {useProviderProfile} from "./ProviderProfileContext";
import {useLayoutEffect, useMemo, useRef, useState} from "react";
import type {ChangeEvent, KeyboardEvent} from "react";
import type {BridgeUser} from "../../platform/bridge/messages";
import type {GameModal, GameSessionState} from "../../gameplay/session/gameSession";
import {useTranslator} from "../../localization/browser/i18n";
import {getNextRankForLevel, getRankForLevel} from "../../progression/browser/ranks";
import {RankedAvatar} from "../../progression/components/ranks/RankedAvatar";
import {RankIcon} from "../../progression/components/ranks/RankIcon";
import {getProfileProgress} from "../../progression/browser/profileProgress";
import {useReferralSharing} from "../../sharing/components/ReferralSharingCapability";

/** Properties required by the profile modal page. */
export type ProfileModalPageProps = {
  /** Latest profile returned by the trusted host, or null for a guest fallback. */
  profile: GameSessionState["profile"];
  /** Account controls explicitly approved by the active platform. */
  accountManagement?: BridgeUser["accountManagement"];
  /** Opens a related profile modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Uploads a selected avatar through the existing host boundary. */
  onUpdateAvatar: (file: File) => Promise<void>;
  /** Permanently deletes the authenticated player's Riddle Quest account data. */
  onDeleteAccount: () => void;
};

/** Renders player identity, progression, statistics shortcuts, and avatar selection. */
export function ProfileModalPage({
  profile,
  accountManagement,
  onOpenModal,
  onUpdateAvatar,
  onDeleteAccount,
}: ProfileModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Target-owned display identity, when supplied. */
  const providerProfile = useProviderProfile();
  /** Current game username, with provider and localized guest fallbacks. */
  const displayName = profile?.username ?? providerProfile?.username ?? tr("Profile.GUEST_USERNAME");
  /** Saved game avatar, with the provider photo as the initial fallback. */
  const avatarUrl = profile?.avatarUrl ?? providerProfile?.avatarUrl;
  /** Optional outbound sharing supplied by the active release target. */
  const referralSharing = useReferralSharing();
  const selectedInviteOwner = useMemo(() => ({shareInvite: referralSharing?.shareInvite}),
    [referralSharing?.shareInvite]);
  const inviteOwner = useRef(selectedInviteOwner);
  const inviteLock = useRef(false);
  const mounted = useRef(false);
  const [inviting, setInviting] = useState(false);
  const [failedInviteOwner, setFailedInviteOwner] = useState<typeof selectedInviteOwner | null>(null);
  useLayoutEffect(() => {inviteOwner.current = selectedInviteOwner;}, [selectedInviteOwner]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  /** The native dialog result belongs only to the account and provider that opened it. */
  const inviteFriend = async () => {
    const selected = inviteOwner.current;
    if (!mounted.current || inviteLock.current || !selected.shareInvite) return;
    inviteLock.current = true;
    setInviting(true);
    setFailedInviteOwner(null);
    try {
      const outcome = await selected.shareInvite();
      if (mounted.current && inviteOwner.current === selected && outcome !== "success" && outcome !== "cancelled")
        setFailedInviteOwner(selected);
    } catch {
      if (mounted.current && inviteOwner.current === selected) setFailedInviteOwner(selected);
    } finally {
      inviteLock.current = false;
      if (mounted.current) setInviting(false);
    }
  };
  /** Recoverable avatar-selection error shown within the profile page. */
  const [avatarError, setAvatarError] = useState<string | null>(null);
  /** Whether the destructive account-deletion confirmation is visible. */
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  /** Hidden file input opened by the custom avatar button. */
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  /** Nested destructive dialog used to keep keyboard focus inside confirmation. */
  const deleteDialogRef = useRef<HTMLElement | null>(null);
  /** Trigger restored after the destructive confirmation is dismissed. */
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  /** A dismissal authorizes focus restoration only after its DOM update commits. */
  const restoreDeleteFocus = useRef(false);
  useLayoutEffect(() => {
    if (deleteConfirmationOpen || !restoreDeleteFocus.current) return;
    restoreDeleteFocus.current = false;
    deleteTriggerRef.current?.focus({preventScroll: true});
  }, [deleteConfirmationOpen]);
  /** Derived level and experience values for the current profile. */
  const progress = getProfileProgress(profile);
  /** Rank associated with the current level. */
  const rank = getRankForLevel(progress.level);
  /** Next rank milestone, when another rank remains. */
  const nextRank = getNextRankForLevel(progress.level);
  const balance = profile?.coins ?? 0;

  /** Opens the system file picker when the target permits avatar uploads. */
  const chooseAvatar = () => {
    setAvatarError(null);
    if (!accountManagement?.avatar) return;
    avatarInputRef.current?.click();
  };

  /** Sends a selected avatar file to the host and reports recoverable failures. */
  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    /** First file selected by the player. */
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      await onUpdateAvatar(file);
    } catch (error) {
      console.warn("[riddle-quest] Avatar selection failed", error);
      setAvatarError(tr("Profile.ALERT_AVATAR_SELECT_FAIL"));
    }
  };

  /** Dismisses confirmation; its closing commit restores the trigger before later input. */
  const dismissDeleteConfirmation = () => {
    restoreDeleteFocus.current = true;
    setDeleteConfirmationOpen(false);
  };

  /** Contains Escape and Tab navigation within the destructive confirmation. */
  const handleDeleteDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" && event.key !== "Tab") return;
    // Earlier key owners and native composition retain their own dismissal/navigation.
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismissDeleteConfirmation();
      return;
    }
    if (event.key !== "Tab") return;
    /** Provides buttons behavior. */
    const buttons = Array.from(
      deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (buttons.length === 0) {
      event.preventDefault();
      return;
    }
    /** Provides first behavior. */
    const first = buttons[0];
    /** Provides last behavior. */
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-identity" data-tooltip="profileIdentity">
          {!accountManagement?.avatar ? (
            <div className="profile-avatar-button">
              <RankedAvatar avatarUrl={avatarUrl} level={progress.level} size={84}
                fallback={displayName.slice(0, 1).toUpperCase()} fallbackClassName="profile-avatar-fallback" />
            </div>
          ) : <>
          <button
            type="button"
            className="profile-avatar-button"
            aria-label={tr("Profile.UPLOAD_FROM_LIBRARY_BUTTON")}
            onClick={chooseAvatar}
          >
            <RankedAvatar avatarUrl={avatarUrl} level={progress.level} size={84}
              fallback={displayName.slice(0, 1).toUpperCase()} fallbackClassName="profile-avatar-fallback" />
            <span className="profile-avatar-edit" aria-hidden="true">
              ＋
            </span>
          </button>
          <input
            ref={avatarInputRef}
            className="profile-avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void selectAvatar(event)}
            tabIndex={-1}
            aria-hidden="true"
          />
          </>}
          {avatarError ? (
            <small className="profile-avatar-error" role="alert">
              {avatarError}
            </small>
          ) : null}
          <div>
            <strong>{displayName}</strong>
            {accountManagement?.username && <button className="play-text-button" onClick={() => onOpenModal("username")}>
              {tr("Profile.EDIT_BUTTON")}
            </button>}
          </div>
        </div>
        <div className="rank-card" data-tooltip="profileProgression">
          <RankedAvatar size={56} level={progress.level} fallback={<RankIcon name={rank.icon} />} showSymbolBadge={false} />
          <div>
            <small>{tr("Ranks.CURRENT_RANK")}</small>
            <strong>{tr(rank.nameKey)}</strong>
            <span className="rank-material" data-rank-material={rank.material}>{tr(rank.materialKey)}</span>
            <p>{tr(rank.descriptionKey)}</p>
          </div>
        </div>
        <div className="xp-progress">
          <span>
            {tr("Profile.XP_LEVEL_PREFIX")}
            {progress.level}
          </span>
          <div>
            <i style={{width: `${progress.percentage}%`}} />
          </div>
          <span>
            {progress.xp} {tr("StatsModal.XP")}
          </span>
        </div>
        {nextRank ? (
          <p className="next-rank">
            {tr("Ranks.NEXT_RANK_PREFIX")} {tr(nextRank.nameKey)} {tr("Ranks.AT_LEVEL_PREFIX")} {nextRank.minimumLevel}
          </p>
        ) : null}
      </div>
      <dl className="profile-stats" data-tooltip="profileStats">
        <div>
          <dt>{tr("Profile.TOTAL_COINS_LABEL")}</dt>
          <dd>{balance}</dd>
        </div>
        <div>
          <dt>{tr("Profile.TOTAL_WINS_STAT")}</dt>
          <dd>{profile?.totalWins ?? profile?.wins ?? 0}</dd>
        </div>
        <div>
          <dt>{tr("Profile.BEST_STREAK_STAT")}</dt>
          <dd>{profile?.bestStreak ?? 0}</dd>
        </div>
        <div data-tooltip="profileDailyPuzzles">
          <dt>{tr("Profile.DAILY_PUZZLES_STAT")}</dt>
          <dd>{profile?.dailyPuzzlesCompleted ?? 0}</dd>
        </div>
      </dl>
      <div className="profile-links">
        {referralSharing ? <>
          <button className="profile-invite-button" disabled={inviting} aria-busy={inviting}
            onClick={() => void inviteFriend()}>
            {referralSharing.inviteLabel ?? tr("VictoryModal.INVITE_FRIEND")}
          </button>
          {failedInviteOwner === selectedInviteOwner && <p role="alert">{tr("Profile.ALERT_AN_ERROR_OCCURRED")}</p>}
        </> : null}
        <button data-tooltip="profileStatistics" onClick={() => onOpenModal("statistics")}>
          {tr("StatsModal.TITLE")}
        </button>
        <button data-tooltip="profileAchievements" onClick={() => onOpenModal("achievements")}>
          {tr("Achievements.MODAL_TITLE")}
        </button>
        <button
          data-tooltip="profileRanks"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenModal("ranks");
          }}
        >
          {tr("Ranks.TITLE")}
        </button>
        <button data-tooltip="profileLeaderboard" onClick={() => onOpenModal("leaderboard")}>
          {tr("Leaderboard.TITLE")}
        </button>
        <button type="button" className="profile-treasure-button" data-tooltip="profileTreasure"
          aria-label={`${balance.toLocaleString()}${tr("CoinShop.COINS_SUFFIX")}. ${tr("Navigation.BUY_COINS_BUTTON")}`}
          onClick={() => onOpenModal("shop")}>
          <SpinningWheel />
          <span className="profile-treasure-content">
            <img src={chestUrl} alt="" width="112" height="100" />
            <small>{tr("CoinShop.YOUR_BALANCE")}</small>
            <strong>{balance.toLocaleString()}{tr("CoinShop.COINS_SUFFIX")}</strong>
          </span>
        </button>
      </div>
      {accountManagement?.deletion && <div className="profile-danger-zone">
        <button
          ref={deleteTriggerRef}
          type="button"
          className="profile-delete-account-button"
          onClick={() => setDeleteConfirmationOpen(true)}
        >
          {tr("Profile.DELETE_ACCOUNT_BUTTON")}
        </button>
      </div>}
      {accountManagement?.deletion && deleteConfirmationOpen ? (
        <div className="profile-delete-backdrop">
          <section
            ref={deleteDialogRef}
            className="profile-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="profile-delete-title"
            aria-describedby="profile-delete-message"
            onKeyDown={handleDeleteDialogKeyDown}
          >
            <h2 id="profile-delete-title">{tr("Profile.DELETE_ACCOUNT_CONFIRM_TITLE")}</h2>
            <p id="profile-delete-message">{tr("Profile.DELETE_ACCOUNT_CONFIRM_MESSAGE")}</p>
            <div className="profile-delete-actions">
              <button type="button" autoFocus onClick={dismissDeleteConfirmation}>
                {tr("Profile.DELETE_ACCOUNT_CANCEL_BUTTON")}
              </button>
              <button
                type="button"
                className="profile-delete-account-button"
                onClick={() => {
                  setDeleteConfirmationOpen(false);
                  onDeleteAccount();
                }}
              >
                {tr("Profile.DELETE_ACCOUNT_CONFIRM_BUTTON")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
