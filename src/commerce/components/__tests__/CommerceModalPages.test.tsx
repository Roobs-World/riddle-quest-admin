import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {
  ContinueModalPage,
  HintModalPage,
  SkipModalPage,
  TreasureModalPage,
} from "../CoinActionModalPages";

it("offers the ordinary next action without advertising unavailable guest coin actions", () => {
  /** No economy module exists in this hosted practice session. */
  const props = {balance: 0, onContinue: () => {}, onSkip: () => {}, onOpenModal: () => {},
    economyAvailable: false, onDecline: () => {}};
  /** This actual dialog must omit unsupported paid choices even with no checkout products. */
  const html = renderToString(<ContinueModalPage {...props} />);
  expect(html).not.toContain("loss-continue-action");
  expect(html).not.toContain("loss-skip-action");
  expect(html).not.toContain("continue-balance");
  expect(html).toContain("loss-next-action");
});
import {ShopModalPage} from "../ShopModalPage";
import {CONTINUE_COIN_COST, HINT_COIN_COST, SKIP_COIN_COST} from "../../browser/commerceCosts";
import type {ProductSummary} from "../../../platform/contracts/hostServices";

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

/** Provider offers include supported one-time products and an unsupported subscription. */
const products: ProductSummary[] = [
  {
    productId: "coins-100",
    productType: "consumable",
    name: "Coin Pouch",
    description: "Adds coins",
    coins: 100,
    displayPrice: "£0.99",
    featuredBadge: "Popular",
  },
  {
    productId: "premium-trial",
    productType: "subscription",
    name: "Premium Trial",
    description: "Monthly premium access",
    coins: 0,
    displayPrice: "£2.99",
    billingPeriod: "monthly",
    subscriptionStatus: "inactive",
    trialEligible: true,
  },
  {
    productId: "no-ads",
    productType: "durable",
    name: "No Ads",
    description: "Removes optional interstitial ads",
    coins: 0,
    displayPrice: "£2.99",
  },
];

describe("commerce modal pages", () => {
  it("keeps displayed gameplay costs centralized", () => {
    expect({CONTINUE_COIN_COST, HINT_COIN_COST, SKIP_COIN_COST}).toEqual({
      CONTINUE_COIN_COST: 50,
      HINT_COIN_COST: 25,
      SKIP_COIN_COST: 100,
    });
  });

  it("renders supported one-time offers and hides subscription-only catalogs", () => {
    const emptyHtml = renderToString(<ShopModalPage balance={0} products={[]} onPurchase={noop} />);
    const subscriptionHtml = renderToString(<ShopModalPage balance={0} products={[products[1]]} onPurchase={noop} />);
    const populatedHtml = renderToString(<ShopModalPage balance={1250} products={products} onPurchase={noop} />);

    expect(emptyHtml).toContain("No coin packs are available right now");
    expect(subscriptionHtml).toContain("No coin packs are available right now");
    expect(populatedHtml).toContain("1,250");
    expect(populatedHtml).toContain("Popular");
    expect(populatedHtml).toContain("Coin Pouch");
    expect(populatedHtml).toContain("No Ads");
    expect(populatedHtml).toContain("Removes optional interstitial ads");
    expect(populatedHtml).not.toContain("Premium Trial");
  });

  it("renders affordable and insufficient continue prompts", () => {
    /** Provides poor html behavior. */
    const poorHtml = renderToString(<ContinueModalPage balance={10} onContinue={noop} onSkip={noop} onOpenModal={noop} />);
    /** Provides funded html behavior. */
    const fundedHtml = renderToString(<ContinueModalPage balance={100} onContinue={noop} onSkip={noop} onOpenModal={noop} />);

    expect(poorHtml).toContain("disabled");
    expect(poorHtml).toContain("not have enough coins");
    expect(fundedHtml).not.toContain("not have enough coins to continue");
    expect(fundedHtml).not.toContain("<img");
    expect(fundedHtml).toContain('class="play-primary loss-continue-action">');
    expect(fundedHtml.replace(/<[^>]+>/gu, "")).toContain("Use 50 Coins to Try Again");
    expect(fundedHtml.replace(/<[^>]+>/gu, "")).toContain("Use 100 coins to Skip Level");
  });

  it("runs skip directly from the loss prompt and disables it when coins are insufficient", () => {
    /** Counts direct skip requests from the loss prompt. */
    let skipRequests = 0;
    /** Provides poor html behavior. */
    const poorHtml = renderToString(<ContinueModalPage balance={99} onContinue={noop}
      onSkip={() => { skipRequests += 1; }} onOpenModal={noop} />);
    /** Provides funded prompt behavior for interaction inspection. */
    function FundedPrompt() {
      /** Actual component executes under the server renderer hook dispatcher. */
      const fundedPrompt = ContinueModalPage({
        balance: SKIP_COIN_COST,
        onContinue: noop,
        onSkip: () => { skipRequests += 1; },
        onOpenModal: noop,
      });
      /** Direct skip action rendered by the funded loss prompt. */
      const skipButton = fundedPrompt.props.children.find(
        (child: {
          /** Stores props. */
          props?: {
            /** Stores class name. */
            className?: string;
          };
        }) => child?.props?.className === "play-primary loss-skip-action",
      );

      expect(poorHtml).toMatch(/not have enough coins[\s\S]*loss-skip-action[^>]*disabled/u);
      expect(skipButton.props.disabled).toBe(false);
      skipButton.props.onClick();
      return fundedPrompt;
    }
    renderToString(<FundedPrompt />);
    expect(skipRequests).toBe(1);
  });

  it("keeps locally eligible continue choices usable while the fifth guess confirms", () => {
    /** Continue panel rendered before the server confirms the final guess. */
    const pendingHtml = renderToString(<ContinueModalPage balance={100} onContinue={noop}
      onSkip={noop} onOpenModal={noop} />);
    expect(pendingHtml).toContain("continue-actions");
    expect(pendingHtml).toContain('class="play-primary loss-continue-action">');
  });

  it("removes every shop route when platform commerce is unavailable", () => {
    /** Provides continue html behavior. */
    const continueHtml = renderToString(
      <ContinueModalPage balance={0} onContinue={noop} onSkip={noop} onOpenModal={noop} commerceAvailable={false} />,
    );
    /** Provides hint html behavior. */
    const hintHtml = renderToString(
      <HintModalPage balance={0} onClose={noop} onOpenModal={noop} onRequestAction={noop} commerceAvailable={false} />,
    );
    /** Provides treasure html behavior. */
    const treasureHtml = renderToString(<TreasureModalPage balance={0} onOpenModal={noop} commerceAvailable={false} />);
    expect(`${continueHtml}${hintHtml}${treasureHtml}`).not.toMatch(/Open Shop|Buy coins/u);
  });

  it("renders hint and skip prompts from the same coin action component", () => {
    /** Provides poor hint html behavior. */
    const poorHintHtml = renderToString(
      <HintModalPage balance={0} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );
    /** Provides funded hint html behavior. */
    const fundedHintHtml = renderToString(
      <HintModalPage balance={50} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );
    /** Provides funded skip html behavior. */
    const fundedSkipHtml = renderToString(
      <SkipModalPage balance={200} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );

    expect(poorHintHtml).toContain("Open Shop");
    expect(fundedHintHtml).toContain("SHOW HINT");
    expect(fundedSkipHtml).toContain("SKIP LEVEL");
  });

  it("renders the treasure balance with a shop action", () => {
    /** Provides html behavior. */
    const html = renderToString(<TreasureModalPage balance={1234} onOpenModal={noop} />);
    expect(html).toContain("1,234");
    expect(html).toContain("Buy coins");
  });
});


describe("coin pack buying power", () => {
  it("shows the actual coin grant as alternative whole-action amounts", () => {
    /** Rendered provider grant and its localized buying power. */
    const html = renderToString(<ShopModalPage balance={300} products={[{
      productId: "starter", name: "Starter", description: "", coins: 250,
      displayPrice: "$0.99", productType: "consumable",
    }]} onPurchase={noop} />);
    expect(html.replace(/<[^>]+>/gu, "")).toContain("Up to 10 hints or 5 extra attempts.");
  });
});
