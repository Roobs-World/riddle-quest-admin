import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {CoinAwardSequence} from "../modalPages/fanfare/CoinAwardSequence";
import {AchievementFanfare, FanfareTabContent} from "../modalPages/fanfare/FanfareModalContent";
import type {FanfareStep} from "../modalPages/fanfare/fanfareSequence";

/** Counter preview is outside these server-rendered content assertions. */
const noop = () => undefined;

describe("compact reward tabs", () => {
  it("retains full translated achievement details for the profile", () => {
    expect(renderToString(<AchievementFanfare achievementId="first_win" />)).toContain("First Win");
    expect(renderToString(<AchievementFanfare achievementId="unknown-achievement" />)).toContain("unknown-achievement");
  });

  it.each<{
    /** Milestone rendered by this scenario. */
    step: FanfareStep;
    /** Expected translated title. */
    title: string;
  }>([
    {step: {kind: "victory"}, title: "YOU WON!"},
    {step: {kind: "level"}, title: "Level 3"},
    {step: {kind: "achievement", achievementId: "first_win"}, title: "First Win"},
    {step: {kind: "purchase"}, title: "Coins Added!"},
    {step: {kind: "referral"}, title: "A friend joined!"},
    {step: {kind: "coins"}, title: "Coins Added!"},
  ])("shows a short $step.kind label without an action button", ({step, title}) => {
    /** Rendered reward content with React separator comments removed. */
    const html = renderToString(<FanfareTabContent step={step} level={3} award={null}
      collecting={false} onBalancePreview={noop} />).replaceAll("<!-- -->", "");
    expect(html).toContain(title);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<p>");
  });

  it("shows normalized granted coins with an automatically opened chest", () => {
    /** Rendered reward content with React separator comments removed. */
    const html = renderToString(<CoinAwardSequence amount={10.6} total={30.4}
      onBalancePreview={noop} />).replaceAll("<!-- -->", "");
    expect(html).toContain("+11 Coins");
    expect(html).not.toContain("<button");
    expect(html).toContain('reward-chest collecting');
  });
});
