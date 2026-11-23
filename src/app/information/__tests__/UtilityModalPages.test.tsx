import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {AboutModalPage, CreditsModalPage, InstructionsModalPage} from "../InformationModalPages";
import {UsernameModalPage} from "../../../accounts/components/UsernameModalPage";
import {SettingsModalPage} from "../../../settings/components/SettingsModalPage";

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

describe("utility modal pages", () => {
  it("renders sound, locale, and navigation settings", () => {
    /** Provides enabled html behavior. */
    const enabledHtml = renderToString(
      <SettingsModalPage locale="en" muted={false} onOpenModal={noop} onToggleMute={noop} />,
    );
    /** Provides muted html behavior. */
    const mutedHtml = renderToString(<SettingsModalPage locale="en" muted onOpenModal={noop} onToggleMute={noop} />);
    expect(enabledHtml).toContain("settings-page");
    expect(enabledHtml).toContain("English");
    expect(enabledHtml).toContain("<select");
    expect(enabledHtml).toContain("On");
    expect(mutedHtml).toContain("Off");
    expect(enabledHtml).not.toContain("Show activity to rivals");
    expect(
      renderToString(
        <SettingsModalPage
          locale="en"
          muted={false}
          onOpenModal={noop}
          onToggleMute={noop}
          commerceAvailable={false}
        />,
      ),
    ).not.toContain("Buy coins");
  });

  it("renders instructions, credits, and legal information", () => {
    /** Provides credits html behavior. */
    const creditsHtml = renderToString(<CreditsModalPage />);
    /** Provides about html behavior. */
    const aboutHtml = renderToString(<AboutModalPage onOpenModal={noop} />);

    expect(renderToString(<InstructionsModalPage onClose={noop} />)).toContain("instructions-page");
    expect(creditsHtml).toContain("Craig Beswetherick");
    expect(creditsHtml).toContain("Lead Developer &amp; Game Design");
    expect(creditsHtml).toContain("Game Designer, Publisher, Overall Hero");
    expect(aboutHtml).toContain(
      '<button class="about-list-row about-list-action" type="button">Account Deletion</button>',
    );
    expect(aboutHtml.match(/grindheadgames@gmail\.com/g)).toHaveLength(2);
    expect(aboutHtml).toContain('href="./third-party-licenses.txt"');
    expect(aboutHtml.match(/href=/g)).toHaveLength(1);
    expect(aboutHtml).not.toMatch(/href="(?:https?:|mailto:)/i);
    expect(aboutHtml).not.toContain("target=");
    expect(aboutHtml).not.toMatch(/Riddle Quest Website|Privacy Policy|Terms of Use/);
    expect(aboutHtml.match(/about-list-row/g)).toHaveLength(4);
  });

  it("renders an initially disabled username editor with shared limits", () => {
    /** Provides html behavior. */
    const html = renderToString(<UsernameModalPage onUpdateUsername={noop} />);
    expect(html).toContain("username-form");
    expect(html).toContain('minLength="3"');
    expect(html).toContain('maxLength="24"');
    expect(html).toContain("disabled");
  });
});
