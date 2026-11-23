import {CompletionPresentation, completionPresentationKey} from "../completionPresentation";
/** Provides first behavior. */
const first = completionPresentationKey({riddleId: "r1", sessionToken: "issued-1"});
/** Provides second behavior. */
const second = completionPresentationKey({riddleId: "r1", sessionToken: "issued-2"});
describe("Confirmed Progress presentation", () => {
  test.each(["confirmation-first", "dismissal-first"])("joins %s and consumes duplicates", (order) => {
    /** Provides presentation behavior. */
    const presentation = new CompletionPresentation();
    expect(order === "confirmation-first" ? presentation.confirm(first) : presentation.dismiss(first)).toBe(false);
    expect(order === "confirmation-first" ? presentation.dismiss(first) : presentation.confirm(first)).toBe(true);
    expect(presentation.confirm(first)).toBe(false);
    expect(presentation.dismiss(first)).toBe(false);
  });
  test("another issued outcome cannot release a confirmed win", () => {
    /** Provides presentation behavior. */
    const presentation = new CompletionPresentation();
    expect(presentation.confirm(first)).toBe(false);
    expect(presentation.dismiss(second)).toBe(false);
    expect(presentation.dismiss(first)).toBe(true);
    expect(presentation.confirm(second)).toBe(true);
  });
});
