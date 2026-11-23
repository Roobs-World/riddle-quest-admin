import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {createRef} from "react";
import {renderToString} from "react-dom/server";
import {OnboardingOverlay} from "../OnboardingOverlay";
import {TooltipOverlay} from "../TooltipOverlay";

/** Original Node global descriptor restored after tooltip rendering tests. */
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {innerHeight: 1000},
  });
});

afterAll(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("guidance views", () => {
  it("renders welcome and instruction onboarding pages", () => {
    /** Provides card ref behavior. */
    const cardRef = createRef<HTMLDivElement>();
    /** Provides welcome html behavior. */
    const welcomeHtml = renderToString(
      <OnboardingOverlay cardRef={cardRef} onboardingStep={0} totalSteps={2} welcomeOnly={false} onAdvance={noop} />,
    );
    /** Provides instructions html behavior. */
    const instructionsHtml = renderToString(
      <OnboardingOverlay cardRef={cardRef} onboardingStep={1} totalSteps={2} welcomeOnly={false} onAdvance={noop} />,
    );

    expect(welcomeHtml).toContain("onboarding-logo");
    expect(welcomeHtml).toContain("Let&#x27;s Play");
    expect(welcomeHtml).toContain('tabindex="-1"');
    expect(instructionsHtml).toContain("onboarding-clues");
    expect(instructionsHtml).toContain("Got It!");
    expect(instructionsHtml).not.toContain("Register");
  });

  it("renders centered and targeted tooltip presentations", () => {
    /** Provides centered html behavior. */
    const centeredHtml = renderToString(
      <TooltipOverlay
        cardRef={createRef<HTMLElement>()}
        activeTooltip="profileStats"
        content={{title: "Profile stats", body: "Review your progress"}}
        sequenceIndex={0}
        sequenceLength={2}
        targetRect={null}
        onAdvance={noop}
      />,
    );
    /** Provides targeted html behavior. */
    const targetedHtml = renderToString(
      <TooltipOverlay
        cardRef={createRef<HTMLElement>()}
        activeTooltip="profileStats"
        content={{title: "Profile stats", body: "Review your progress"}}
        sequenceIndex={1}
        sequenceLength={2}
        targetRect={{left: 10, top: 20, width: 100, height: 40, bottom: 60} as DOMRect}
        onAdvance={noop}
      />,
    );

    expect(centeredHtml).toContain("Profile stats");
    expect(centeredHtml).toContain('aria-labelledby="guidance-tooltip-profileStats-title"');
    expect(centeredHtml).toContain('aria-describedby="guidance-tooltip-profileStats-body"');
    expect(centeredHtml).toContain('tabindex="-1"');
    expect(centeredHtml).toContain("1<!-- -->/<!-- -->2");
    expect(targetedHtml).toContain("tooltip-spotlight");
    expect(targetedHtml).toContain("2<!-- -->/<!-- -->2");
  });
});
