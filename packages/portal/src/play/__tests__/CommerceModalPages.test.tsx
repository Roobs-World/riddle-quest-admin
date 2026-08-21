import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {
  ContinueModalPage,
  HintModalPage,
  SkipModalPage,
  TreasureModalPage,
} from "../modalPages/commerce/CoinActionModalPages";
import {ShopModalPage} from "../modalPages/commerce/ShopModalPage";
import {
  CONTINUE_COIN_COST,
  HINT_COIN_COST,
  SKIP_COIN_COST,
} from "../modalPages/commerce/commerceCosts";
import type {ProductSummary} from "../types";

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
      CONTINUE_COIN_COST: 100,
      HINT_COIN_COST: 50,
      SKIP_COIN_COST: 100,
    });
  });

  it("renders an empty platform catalog and all product variants", () => {
    const emptyHtml = renderToString(<ShopModalPage balance={0} products={[]} onPurchase={noop} />);
    const populatedHtml = renderToString(
      <ShopModalPage balance={1250} products={products} onPurchase={noop} />,
    );

    expect(emptyHtml).toContain("No coin packs are available right now");
    expect(populatedHtml).toContain("1,250");
    expect(populatedHtml).toContain("Popular");
    expect(populatedHtml).toContain("START FREE TRIAL");
    expect(populatedHtml).toContain("SUBSCRIBED");
    expect(populatedHtml).toContain("shop-subscription-card");
  });

  it("renders affordable and insufficient continue prompts", () => {
    const poorHtml = renderToString(
      <ContinueModalPage balance={10} onContinue={noop} onOpenModal={noop} />,
    );
    const fundedHtml = renderToString(
      <ContinueModalPage balance={100} onContinue={noop} onOpenModal={noop} />,
    );

    expect(poorHtml).toContain("disabled");
    expect(poorHtml).toContain("not have enough coins");
    expect(fundedHtml).not.toContain("not have enough coins");
  });

  it("removes every shop route when platform commerce is unavailable", () => {
    const continueHtml = renderToString(
      <ContinueModalPage balance={0} onContinue={noop} onOpenModal={noop} commerceAvailable={false} />,
    );
    const hintHtml = renderToString(
      <HintModalPage balance={0} onClose={noop} onOpenModal={noop} onRequestAction={noop} commerceAvailable={false} />,
    );
    const treasureHtml = renderToString(
      <TreasureModalPage balance={0} onOpenModal={noop} commerceAvailable={false} />,
    );
    expect(`${continueHtml}${hintHtml}${treasureHtml}`).not.toMatch(/Open Shop|Buy coins/u);
  });

  it("renders hint and skip prompts from the same coin action component", () => {
    const poorHintHtml = renderToString(
      <HintModalPage balance={0} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );
    const fundedHintHtml = renderToString(
      <HintModalPage balance={50} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );
    const fundedSkipHtml = renderToString(
      <SkipModalPage balance={100} onClose={noop} onOpenModal={noop} onRequestAction={noop} />,
    );

    expect(poorHintHtml).toContain("Open Shop");
    expect(fundedHintHtml).toContain("SHOW HINT");
    expect(fundedSkipHtml).toContain("SKIP LEVEL");
  });

  it("renders the treasure balance with a shop action", () => {
    const html = renderToString(<TreasureModalPage balance={1234} onOpenModal={noop} />);
    expect(html).toContain("1,234");
    expect(html).toContain("Buy coins");
  });
});
