import type {HostServices, LeaderboardType} from "../../../../../src/platform/contracts/hostServices";
import {youtubeText} from "../../../../../src/localization/copy/localGameCopy";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {useState} from "react";
import {StyleSheet, Text, TextInput, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import {AchievementRow} from "../components/StatusViews";
import {AvatarEditor} from "../components/AvatarEditor";
import {useAuthSnapshot} from "../hosted/useAuthSnapshot";
import {PROFILE_LEADERBOARDS, useHostedProfile, type UsernameNotice} from "../hosted/useHostedProfile";
import {profileText, type ProfileCopyKey} from "../i18n/profileCopy";
import {palette, spacing} from "../theme";
/** Props for {@link HostedProfileScreen}. */
export type HostedProfileScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Shared hosted services. */
  services: HostServices;
  /** Firebase uid of the signed-in account, to highlight its leaderboard row. */
  accountUid: string;
  /** Returns to the home screen. */
  onBack: () => void;
  /** Called after the account was deleted. */
  onDeleted: () => void;
}>;
/** Tab label per leaderboard. */
const BOARD_COPY: Readonly<Record<LeaderboardType, ProfileCopyKey>> = {xp: "tabXp", totalWins: "tabWins", bestStreak: "tabStreak", multiplayerWins: "tabWins"};
/** Message per username result. */
const USERNAME_COPY: Readonly<Record<UsernameNotice, ProfileCopyKey>> = {
  updated: "usernameUpdated",
  taken: "usernameTaken",
  tooShort: "usernameTooShort",
  failed: "usernameFailed",
};
/** Hosted profile matching the Jest Web Target: stats, achievements, username, leaderboards and account deletion. */
export function HostedProfileScreen({locale, services, accountUid, onBack, onDeleted}: HostedProfileScreenProps) {
  /** Server-confirmed profile. */
  const {profile} = useAuthSnapshot(services);
  /** Profile actions. */
  const controller = useHostedProfile(services, onDeleted);
  /** Username being edited. */
  const [draftName, setDraftName] = useState("");
  /** Solo copy lookup for achievement labels. */
  const solo = (key: Parameters<typeof youtubeText>[1]) => youtubeText(locale, key);
  /** Win rate as a whole percentage. */
  const winRate = profile && profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0;
  /** Stat cells. */
  const stats: ReadonlyArray<[ProfileCopyKey, string | number]> = profile
    ? [
        ["gamesPlayed", profile.gamesPlayed],
        ["totalWins", profile.totalWins ?? profile.wins],
        ["winRate", `${winRate}%`],
        ["bestStreak", profile.bestStreak ?? profile.winStreak],
        ["dailyPuzzles", profile.dailyPuzzlesCompleted ?? 0],
      ]
    : [];
  return (
    <Screen testID="screen-profile">
      <Panel>
        <ActionButton label={`← ${youtubeText(locale, "back")}`} onPress={onBack} style={styles.back} testID="back" />
        <Heading testID="profile-heading">{profileText(locale, "profileTitle")}</Heading>
        {profile ? (
          <View style={styles.stack} testID="profile-summary">
            <AvatarEditor locale={locale} services={services} accountUid={accountUid} avatarUrl={profile.avatarUrl} />
            <Text style={styles.name} testID="profile-username">{profile.username}</Text>
            <Text style={styles.body}>{`${profileText(locale, "levelPrefix")} ${profile.level} · ${solo("xp")} ${profile.xp} · 🪙 ${profile.coins}`}</Text>
            <Eyebrow>{profileText(locale, "statsTitle")}</Eyebrow>
            <View style={styles.grid}>
              {stats.map(([key, value]) => (
                <View key={key} accessibilityLabel={`${profileText(locale, key)}: ${value}`} style={styles.cell} testID={`profile-stat-${key}`}>
                  <Text style={styles.cellLabel}>{profileText(locale, key)}</Text>
                  <Text style={styles.cellValue}>{value}</Text>
                </View>
              ))}
            </View>
            {profile.achievements.length > 0 && (
              <View style={styles.stack} testID="profile-achievements">
                <Eyebrow>{solo("achievements")}</Eyebrow>
                <AchievementRow ids={profile.achievements} text={solo} label={solo("achievements")} />
              </View>
            )}
          </View>
        ) : (
          <Notice testID="profile-loading">{youtubeText(locale, "loading")}</Notice>
        )}
      </Panel>
      <Panel>
        <Eyebrow>{profileText(locale, "updateUsername")}</Eyebrow>
        <TextInput
          accessibilityLabel={profileText(locale, "updateUsername")}
          autoCapitalize="none"
          maxLength={24}
          onChangeText={setDraftName}
          placeholder={profileText(locale, "usernamePlaceholder")}
          placeholderTextColor={palette.muted}
          style={styles.input}
          testID="profile-username-input"
          value={draftName}
        />
        <ActionButton
          tone="primary"
          label={profileText(locale, "save")}
          disabled={controller.savingUsername}
          onPress={() => controller.saveUsername(draftName)}
          testID="profile-username-save"
        />
        {controller.usernameNotice && (
          <Notice error={controller.usernameNotice !== "updated"} testID="profile-username-notice">
            {profileText(locale, USERNAME_COPY[controller.usernameNotice])}
          </Notice>
        )}
      </Panel>
      <Panel>
        <Heading level={2}>{profileText(locale, "leaderboardTitle")}</Heading>
        <View style={styles.tabs}>
          {PROFILE_LEADERBOARDS.map((board) => (
            <ActionButton
              key={board}
              tone={controller.board === board ? "primary" : "secondary"}
              label={profileText(locale, BOARD_COPY[board])}
              onPress={() => controller.selectBoard(board)}
              style={styles.tab}
              testID={`leaderboard-tab-${board}`}
            />
          ))}
        </View>
        {controller.leaderboard.kind === "loading" && <Notice testID="leaderboard-loading">{youtubeText(locale, "loading")}</Notice>}
        {controller.leaderboard.kind === "failed" && (
          <View style={styles.stack}>
            <Notice error testID="leaderboard-failed">{youtubeText(locale, "loadFailed")}</Notice>
            <ActionButton label={youtubeText(locale, "retry")} onPress={() => controller.selectBoard(controller.board)} testID="leaderboard-retry" />
          </View>
        )}
        {controller.leaderboard.kind === "ready" && (
          <View testID="leaderboard-rows">
            {controller.leaderboard.entries.map((entry, index) => {
              /** Value for the selected board. */
              const value = controller.board === "xp" ? entry.xp : controller.board === "totalWins" ? entry.totalWins : entry.bestStreak;
              return (
                <View
                  key={entry.userId}
                  style={[styles.row, entry.userId === accountUid && styles.ownRow]}
                  testID={entry.userId === accountUid ? "leaderboard-own-row" : `leaderboard-row-${index}`}
                >
                  <Text style={styles.rank}>{index + 1}</Text>
                  <Text style={styles.rowName} numberOfLines={1}>{entry.username}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
      <Panel>
        {controller.deletion === "confirming" || controller.deletion === "deleting" ? (
          <View style={styles.stack} testID="profile-delete-confirm">
            <Heading level={2}>{profileText(locale, "deleteConfirmTitle")}</Heading>
            <Text style={styles.body}>{profileText(locale, "deleteConfirmMessage")}</Text>
            <ActionButton
              tone="danger"
              label={profileText(locale, controller.deletion === "deleting" ? "deleting" : "deleteAccount")}
              disabled={controller.deletion === "deleting"}
              onPress={controller.confirmDeletion}
              testID="profile-delete-confirm-button"
            />
            <ActionButton
              label={profileText(locale, "cancel")}
              disabled={controller.deletion === "deleting"}
              onPress={() => controller.setConfirmingDeletion(false)}
              testID="profile-delete-cancel"
            />
          </View>
        ) : (
          <View style={styles.stack}>
            {controller.deletion === "failed" && <Notice error testID="profile-delete-failed">{profileText(locale, "deleteFailed")}</Notice>}
            <ActionButton tone="danger" label={profileText(locale, "deleteAccount")} onPress={() => controller.setConfirmingDeletion(true)} testID="profile-delete" />
          </View>
        )}
      </Panel>
    </Screen>
  );
}
/** Styles for the profile. */
const styles = StyleSheet.create({
  back: {alignSelf: "flex-start", minHeight: 40},
  stack: {gap: spacing.sm},
  name: {color: palette.text, fontSize: 22, fontWeight: "700"},
  body: {color: palette.subtle, fontSize: 15, lineHeight: 22},
  grid: {flexDirection: "row", flexWrap: "wrap", gap: spacing.sm},
  cell: {minWidth: "45%", flexGrow: 1, padding: spacing.sm, borderRadius: 12, backgroundColor: palette.banner, gap: spacing.xs},
  cellLabel: {color: palette.muted, fontSize: 13},
  cellValue: {color: palette.text, fontSize: 20, fontWeight: "700"},
  input: {color: palette.text, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.sm, minHeight: 48, fontSize: 16},
  tabs: {flexDirection: "row", gap: spacing.xs},
  tab: {flex: 1, minHeight: 40},
  row: {flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 8},
  ownRow: {backgroundColor: palette.banner, borderColor: palette.accent, borderWidth: 1},
  rank: {color: palette.muted, width: 28, fontSize: 15},
  rowName: {color: palette.text, flex: 1, fontSize: 15},
  rowValue: {color: palette.text, fontSize: 15, fontWeight: "700"},
});
