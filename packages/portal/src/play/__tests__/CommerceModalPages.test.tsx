import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {
  ContinueModalPage,
  HintModalPage,
  SkipModalPage,
  TreasureModalPage,
} from "../modalPages/commerce/CoinActionModalPages";

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
import {ShopModalPage, SUBSCRIPTION_BENEFIT_KEYS} from "../modalPages/commerce/ShopModalPage";
import {tr} from "../i18n";
import {PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "@qwordly/core/pricing/catalog";
import {ShopSubscriptionContext} from "../modalPages/commerce/ShopSubscriptionContext";
import {CONTINUE_COIN_COST, HINT_COIN_COST, SKIP_COIN_COST} from "../modalPages/commerce/commerceCosts";
import type {ProductSummary} from "@qwordly/hosted/hostTypes";

/** No-op callback shared by server-rendering tests. */
const noop = () => undefined;

/** Platform product fixtures covering consumable and subscription presentations. */
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
    productId: "premium-active",
    productType: "subscription",
    name: "Premium Active",
    description: "Active premium access",
    coins: 0,
    displayPrice: "£2.99",
    subscriptionStatus: "active",
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

  it("renders an empty platform catalog and all product variants", () => {
    /** Provides empty html behavior. */
    const emptyHtml = renderToString(<ShopModalPage balance={0} products={[]} onPurchase={noop} />);
    /** Provides populated html behavior. */
    const populatedHtml = renderToString(<ShopModalPage balance={1250} products={products} onPurchase={noop} />);

    expect(emptyHtml).toContain("No coin packs are available right now");
    expect(populatedHtml).toContain("1,250");
    expect(populatedHtml).toContain("Popular");
    expect(populatedHtml).not.toContain("START FREE TRIAL");
    expect(populatedHtml).not.toContain("SUBSCRIBED");
    expect(populatedHtml).not.toContain("Cancel subscription");
    expect(populatedHtml).toContain("shop-subscription-card");
  });

  it("shows a cached subscription offer on the shop's first render", () => {
    /** Subscription actions activate the Jest shop refresh path. */
    const subscriptionActions = {
      products,
      refresh: async () => undefined,
      cancel: async () => "success" as const,
    };
    /** First render produced before the opening provider refresh can settle. */
    const html = renderToString(
      <ShopSubscriptionContext.Provider value={subscriptionActions}>
        <ShopModalPage balance={1250} products={[products[1]]} onPurchase={noop} />
      </ShopSubscriptionContext.Provider>,
    );

    expect(html).toContain("START FREE TRIAL");
    expect(html).toContain("shop-subscription-card");
  });

  it("explains exactly what a subscription offer includes, with price and billing period", () => {
    /** Inactive offer only, so the price and period are rendered. */
    const offerHtml = renderToString(<ShopModalPage balance={0} products={products.slice(1, 2)} onPurchase={noop} />);
    /** Active plan keeps the same benefit summary. */
    const activeHtml = renderToString(<ShopModalPage balance={0} products={products.slice(2, 3)} onPurchase={noop} />);

    expect(SUBSCRIPTION_BENEFIT_KEYS).toHaveLength(4);
    for (const html of [offerHtml, activeHtml]) {
      expect(html).toContain("shop-subscription-benefits");
      expect(html).toContain("What you get");
      for (const key of SUBSCRIPTION_BENEFIT_KEYS)
        expect(html).toContain(tr(key, {coins: PREMIUM_SUBSCRIPTION_MONTHLY_COINS.toLocaleString()}));
      expect(html).toContain(`${PREMIUM_SUBSCRIPTION_MONTHLY_COINS.toLocaleString()} coins added to your balance every 30 days`);
    }
    expect(offerHtml).toContain("£2.99 / month");
    expect(offerHtml).toContain("Premium status on your Riddle Quest account");
    expect(offerHtml).toContain("Renews automatically. Cancel anytime in Profile or Settings.");
  });

  it("does not attach subscription benefits to coin packs", () => {
    /** Consumable-only catalog. */
    const html = renderToString(<ShopModalPage balance={0} products={products.slice(0, 1)} onPurchase={noop} />);
    expect(html).not.toContain("shop-subscription-benefits");
    expect(html).not.toContain("What you get");
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
