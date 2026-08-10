import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {
  AboutModalPage,
  CreditsModalPage,
  InstructionsModalPage,
} from "../modalPages/information/InformationModalPages";
import {UsernameModalPage} from "../modalPages/profile/UsernameModalPage";
import {SettingsModalPage} from "../modalPages/settings/SettingsModalPage";

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

describe("utility modal pages", () => {
  it("renders sound, locale, and navigation settings", () => {
    const enabledHtml = renderToString(
      <SettingsModalPage locale="en" muted={false} onOpenModal={noop} onToggleMute={noop} />,
    );
    const mutedHtml = renderToString(
      <SettingsModalPage locale="en" muted onOpenModal={noop} onToggleMute={noop} />,
    );

    expect(enabledHtml).toContain("settings-page");
    expect(enabledHtml).toContain("English");
    expect(enabledHtml).toContain("On");
    expect(mutedHtml).toContain("Off");
  });

  it("renders instructions, credits, and legal information", () => {
    expect(renderToString(<InstructionsModalPage onClose={noop} />)).toContain("instructions-page");
    expect(renderToString(<CreditsModalPage />)).toContain("Craig Beswetherick");
    expect(renderToString(<AboutModalPage />)).toContain("Privacy Policy");
  });

  it("renders an initially disabled username editor with shared limits", () => {
    const html = renderToString(<UsernameModalPage onUpdateUsername={noop} />);
    expect(html).toContain("username-form");
    expect(html).toContain('minLength="3"');
    expect(html).toContain('maxLength="24"');
    expect(html).toContain("disabled");
  });
});
