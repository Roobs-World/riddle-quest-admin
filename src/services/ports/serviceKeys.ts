/** Stable registry keys for default service ports. */
export const SERVICE_KEYS = {
  userData: "UserDataService",
  riddleData: "RiddleDataService",
  audioFeedback: "AudioFeedbackService",
  gameCompletion: "GameCompletionPort",
} as const;

export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS];
