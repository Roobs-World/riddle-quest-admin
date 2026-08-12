import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {createRef} from "react";
import {renderToString} from "react-dom/server";
import {OnboardingOverlay} from "../guidance/OnboardingOverlay";
import {TooltipOverlay} from "../guidance/TooltipOverlay";

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
    const cardRef = createRef<HTMLDivElement>();
    const welcomeHtml = renderToString(
      <OnboardingOverlay
        cardRef={cardRef}
        onboardingStep={0}
        totalSteps={2}
        welcomeOnly={false}
        onAdvance={noop}
      />,
    );
    const instructionsHtml = renderToString(
      <OnboardingOverlay
        cardRef={cardRef}
        onboardingStep={1}
        totalSteps={2}
        welcomeOnly={false}
        onAdvance={noop}
      />,
    );

    expect(welcomeHtml).toContain("onboarding-logo");
    expect(welcomeHtml).toContain("Let&#x27;s Play");
    expect(welcomeHtml).toContain('tabindex="-1"');
    expect(instructionsHtml).toContain("onboarding-clues");
    expect(instructionsHtml).toContain("Got It!");
  });

  it("renders the Jest registration onboarding page", () => {
    const html = renderToString(
      <OnboardingOverlay
        cardRef={createRef<HTMLDivElement>()}
        onboardingStep={2}
        registrationName="Nova"
        totalSteps={3}
        welcomeOnly={false}
        onAdvance={noop}
      />,
    );

    expect(html).toContain("Nova");
    expect(html).toContain("Register");
    expect(html).toContain("Play as guest");
  });

  it("shows the inviter identity on attributed registration", () => {
    const html = renderToString(
      <OnboardingOverlay
        cardRef={createRef<HTMLDivElement>()}
        onboardingStep={2}
        registrationName="Generic welcome"
        registrationInviterName="Orion"
        totalSteps={3}
        welcomeOnly={false}
        onAdvance={noop}
      />,
    );

    expect(html).toContain("Orion invited you to play");
    expect(html).not.toContain("Generic welcome");
  });

  it("renders centered and targeted tooltip presentations", () => {
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
