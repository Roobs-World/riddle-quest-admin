import {UpdateAvatarRequestSchema} from "@riddle-quest/core/validation/requestSchemas";
import {NativeModules} from "react-native";

/** Reads the prepared avatar from Android's system picker, without media-library permissions. */
export async function pickAvatar(): Promise<string | null> {
  /** Native module values are untrusted until their method and result are checked. */
  const picker: unknown = NativeModules.RiddleQuestAvatarPicker;
  if (!picker || typeof picker !== "object" || !("pickAvatar" in picker) || typeof picker.pickAvatar !== "function")
    throw new Error("avatar-picker-unavailable");
  /** Cancellation is an expected outcome and never triggers an account mutation. */
  const selected: unknown = await picker.pickAvatar();
  return selected === null ? null : UpdateAvatarRequestSchema.parse({imageDataUrl: selected}).imageDataUrl;
}
