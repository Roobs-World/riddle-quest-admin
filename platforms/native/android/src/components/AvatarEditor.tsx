import {createAvatarUploadController} from "../../../../../src/hosted/avatarUpload";
import type {HostServices} from "../../../../../src/hosted/hostTypes";
import {youtubeText, type YouTubeLocale} from "../../../../../src/solo";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {Image, StyleSheet, View} from "react-native";
import {pickAvatar} from "../avatar/pickAvatar";
import {deviceAvatarUrl} from "../avatar/avatarUrl";
import {hostedConfig} from "../hosted/hostedConfig";
import {avatarText} from "../i18n/avatarCopy";
import {ActionButton, Notice} from "./Primitives";

/** Native profile image selection backed by the shared account-owned upload controller. */
export function AvatarEditor({locale, services, accountUid, avatarUrl}: {
  /** Active content language. */ locale: YouTubeLocale;
  /** Existing server-authoritative profile services. */ services: HostServices;
  /** Changing accounts retires the previous picker before it can upload. */ accountUid: string;
  /** Latest server-confirmed avatar. */ avatarUrl?: string;
}) {
  /** Construction is inert; the effect owns entry and asynchronous cleanup. */
  const controller = useMemo(() => createAvatarUploadController({pick: pickAvatar, upload: image => services.updateAvatar(image)}), [services, accountUid]);
  /** Shared controller snapshots drive only native rendering. */
  const status = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {controller.enter(); return () => controller.dispose();}, [controller]);
  return <View style={styles.editor}>
    {avatarUrl && <Image source={{uri: deviceAvatarUrl(avatarUrl, hostedConfig.emulators?.host)}} style={styles.avatar} accessible={false} testID="profile-avatar" />}
    <ActionButton label={status === "picking" || status === "uploading" ? youtubeText(locale, "loading") : avatarText(locale, "UPLOAD_FROM_LIBRARY_BUTTON")}
      disabled={status === "picking" || status === "uploading"} onPress={() => {void controller.select();}} testID="profile-avatar-select" />
    {status === "updated" && <Notice testID="profile-avatar-notice">{avatarText(locale, "ALERT_AVATAR_UPDATE_SUCCESS")}</Notice>}
    {status === "selectionFailed" && <Notice error testID="profile-avatar-notice">{avatarText(locale, "ALERT_AVATAR_SELECT_FAIL")}</Notice>}
    {status === "uploadFailed" && <Notice error testID="profile-avatar-notice">{avatarText(locale, "ALERT_AVATAR_UPDATE_ERROR")}</Notice>}
  </View>;
}
/** Avatars use the same square crop prepared by both the web and native adapters. */
const styles = StyleSheet.create({editor: {gap: 12}, avatar: {width: 84, height: 84, borderRadius: 42, alignSelf: "center"}});
