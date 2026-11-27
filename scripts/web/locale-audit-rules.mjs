/** Detects visible text damaged by a failed translation/encoding replacement. */
export const hasQuestionMarkReplacementText = (value) =>
  typeof value === "string" && (
    /\?{3,}/u.test(value) ||
    (/\?{2}/u.test(value) && /^[\p{P}\p{S}\s]+$/u.test(value)) ||
    /\p{L}\?+\p{L}/u.test(value)
  );
