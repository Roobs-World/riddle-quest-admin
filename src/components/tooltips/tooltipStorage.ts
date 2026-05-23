import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TooltipId } from "./types";

const TOOLTIP_SEEN_STORAGE_KEY_PREFIX = "tooltipSeen";
const ANONYMOUS_USER_ID = "anonymous";

export const getTooltipSeenStorageKey = (
  tooltipId: TooltipId,
  userId?: string | null
): string => {
  const scopedUserId =
    typeof userId === "string" && userId.trim().length > 0
      ? userId.trim()
      : ANONYMOUS_USER_ID;

  return `${TOOLTIP_SEEN_STORAGE_KEY_PREFIX}:${scopedUserId}:${tooltipId}`;
};

export const hasSeenTooltip = async (
  tooltipId: TooltipId,
  userId?: string | null
): Promise<boolean> => {
  const value = await AsyncStorage.getItem(
    getTooltipSeenStorageKey(tooltipId, userId)
  );
  return value === "true";
};

export const markTooltipSeen = async (
  tooltipId: TooltipId,
  userId?: string | null
): Promise<void> => {
  await AsyncStorage.setItem(getTooltipSeenStorageKey(tooltipId, userId), "true");
};
