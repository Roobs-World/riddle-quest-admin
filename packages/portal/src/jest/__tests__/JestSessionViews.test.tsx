import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {JestAccountDeleted} from "../JestSessionViews";

describe("JestAccountDeleted", () => {
  it("renders a localized, restartable terminal state", () => {
    const html = renderToString(<JestAccountDeleted />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Account deleted");
    expect(html).toContain("Your account has been deleted.");
    expect(html).toContain(">Play</button>");
  });
});
