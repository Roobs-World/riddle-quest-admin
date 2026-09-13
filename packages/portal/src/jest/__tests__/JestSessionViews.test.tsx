import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {JestAccountDeleted} from "../JestSessionViews";

describe("JestAccountDeleted", () => {
  it("renders a localized terminal state without offering a reload loop", () => {
    /** Provides html behavior. */
    const html = renderToString(<JestAccountDeleted />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Account deleted");
    expect(html).toContain("Your account has been deleted.");
    expect(html).not.toContain("<button");
  });
});
