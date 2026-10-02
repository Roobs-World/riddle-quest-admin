jest.mock("../../platform/webTargetEnvironment", () => ({isFacebookWebTarget: true}));
import {renderToString} from "react-dom/server";
import {ContinueModalPage} from "../../play/modalPages/commerce/CoinActionModalPages";

const noop = () => undefined;
it("offers a video alongside coins even with zero coins and no shop", () => {
  const html = renderToString(<ContinueModalPage balance={0} onContinue={noop} onSkip={noop} onOpenModal={noop}
    onRecoverAttempt={noop} commerceAvailable={false} />);
  expect(html).toContain("Watch a video for an extra try");
  expect(html).toMatch(/loss-video-action" aria-busy="false"/);
  expect(html).toMatch(/loss-continue-action" disabled/);
  expect(html).not.toContain("loss-shop-action");
});
it("locks both choices, Skip and Shop during provider/server work", () => {
  const html = renderToString(<ContinueModalPage balance={500} onContinue={noop} onSkip={noop} onOpenModal={noop}
    onRecoverAttempt={noop} pending />);
  for (const name of ["video", "continue", "skip", "shop"]) expect(html).toMatch(new RegExp(`loss-${name}-action" disabled`));
  expect(html).toContain('aria-busy="true"');
});
it("never offers a video without a target capability", () => {
  expect(renderToString(<ContinueModalPage balance={100} onContinue={noop} onSkip={noop} onOpenModal={noop} />))
    .not.toContain("loss-video-action");
});
it("waits for the final guess before allowing the video, without blocking queued coin actions", () => {
  const html = renderToString(<ContinueModalPage balance={100} onContinue={noop} onSkip={noop} onOpenModal={noop}
    onRecoverAttempt={noop} recoveryPending />);
  expect(html).toMatch(/loss-video-action" disabled/);
  expect(html).toContain('class="play-primary loss-continue-action">');
});
