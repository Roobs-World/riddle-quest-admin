const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeForComparison = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function clueContainsLiteralAnswer(question: string, answer: string): boolean {
  const normalizedQuestion = normalizeForComparison(question);
  const normalizedAnswer = normalizeForComparison(answer);

  if (!normalizedQuestion || !normalizedAnswer) {
    return false;
  }

  if (normalizedQuestion === normalizedAnswer) {
    return true;
  }

  const answerPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(answer.toLowerCase())}([^a-z0-9]|$)`, "i");
  return answerPattern.test(question);
}
