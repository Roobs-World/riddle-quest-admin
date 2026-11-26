import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {JestRegistrationAlert} from "../JestRegistrationAlert";
import type {JestSession} from "../types";

/** Ignores button callbacks in static markup assertions. */
const noop = () => undefined;

describe("JestRegistrationAlert", () => {
  it("offers one combined Register / Login choice beside Play as guest", () => {
    /** Guest session; the alert only reads entry intent. */
    const session = {entryIntent: {}} as unknown as JestSession;
    /** Provides html behavior. */
    const html = renderToString(
      <JestRegistrationAlert blocked={false} session={session} onRegister={noop} onDismiss={noop} />,
    );

    expect(html).toContain("Register / Login");
    expect(html).toContain("Play as guest");
    expect(html).not.toContain("Log in");
    expect(html.match(/<button/g)).toHaveLength(2);
  });
});
