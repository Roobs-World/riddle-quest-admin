import AsyncStorage from "@react-native-async-storage/async-storage";
import type {TooltipId} from "./types";

const TOOLTIP_SEEN_STORAGE_KEY_PREFIX = "tooltipSeen";
const TOOLTIP_SEQUENCE_SEEN_STORAGE_KEY_PREFIX = "tooltipSequenceSeen";
const ANONYMOUS_USER_ID = "anonymous";
const seenTooltipCache = new Set<string>();
const seenTooltipSequenceCache = new Set<string>();

const getScopedUserId = (userId?: string | null): string =>
  typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : ANONYMOUS_USER_ID;

export const getTooltipSeenStorageKey = (tooltipId: TooltipId, userId?: string | null): string => {
  return `${TOOLTIP_SEEN_STORAGE_KEY_PREFIX}:${getScopedUserId(userId)}:${tooltipId}`;
};

export const getTooltipSequenceSeenStorageKey = (sequenceId: string, userId?: string | null): string => {
  return `${TOOLTIP_SEQUENCE_SEEN_STORAGE_KEY_PREFIX}:${getScopedUserId(userId)}:${sequenceId}`;
};

export const hasSeenTooltip = async (tooltipId: TooltipId, userId?: string | null): Promise<boolean> => {
  const storageKey = getTooltipSeenStorageKey(tooltipId, userId);
  if (seenTooltipCache.has(storageKey)) {
    return true;
  }

  const value = await AsyncStorage.getItem(storageKey);
  if (value === "true") {
    seenTooltipCache.add(storageKey);
    return true;
  }

  return false;
};

export const markTooltipSeen = async (tooltipId: TooltipId, userId?: string | null): Promise<void> => {
  const storageKey = getTooltipSeenStorageKey(tooltipId, userId);
  seenTooltipCache.add(storageKey);
  await AsyncStorage.setItem(storageKey, "true");
};

export const hasSeenTooltipSequence = async (sequenceId: string, userId?: string | null): Promise<boolean> => {
  const storageKey = getTooltipSequenceSeenStorageKey(sequenceId, userId);
  if (seenTooltipSequenceCache.has(storageKey)) {
    return true;
  }

  const value = await AsyncStorage.getItem(storageKey);
  if (value === "true") {
    seenTooltipSequenceCache.add(storageKey);
    return true;
  }

  return false;
};

export const markTooltipSequenceSeen = async (sequenceId: string, userId?: string | null): Promise<void> => {
  const storageKey = getTooltipSequenceSeenStorageKey(sequenceId, userId);
  seenTooltipSequenceCache.add(storageKey);
  await AsyncStorage.setItem(storageKey, "true");
};

export const clearTooltipSeenMemoryCache = (): void => {
  seenTooltipCache.clear();
  seenTooltipSequenceCache.clear();
};
