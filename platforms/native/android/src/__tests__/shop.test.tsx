import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "../AndroidApp";
import {createAndroidCommerce as createGuardedAndroidCommerce, type AndroidPurchaseBackend} from "../billing/androidCommerce";
import type {PlayBillingPort as CheckoutPort} from "../billing/playBilling";
/** Shop behavior fixtures represent an explicitly linked, recoverable account. */
const createAndroidCommerce = (billing: CheckoutPort, backend: AndroidPurchaseBackend) => createGuardedAndroidCommerce(billing, backend, {canCheckout: () => true});
import type {PlayBillingPort} from "../billing/playBilling";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {HostedShopScreen} from "../screens/HostedShopScreen";
import {calls, createFakeHostServices, subscribers} from "../test/fakeHostServices";
import {
  MONTHLY_ID,
  PACK_ID,
  YEARLY_ID,
  createFakeBilling,
  createFakePurchaseBackend,
  inapp,
  owned,
  subs,
  type BillingScript,
} from "../test/fakeBilling";
import {contentSource, createPort, expectScreen, press} from "../test/harness";

/** Every coin pack priced, plus both Premium plans. */
const fullCatalog = [
  inapp("com.roobsworld.riddlequest.coinpack1", "£0.99"),
  inapp(PACK_ID),
  inapp("com.roobsworld.riddlequest.coinpack3"),
  inapp("com.roobsworld.riddlequest.coinpack4"),
  inapp("com.roobsworld.riddlequest.coinpack5"),
  inapp("com.roobsworld.riddlequest.coinpack6", "£19.99"),
  subs(MONTHLY_ID),
  subs(YEARLY_ID, "P1Y", "£79.99"),
];
/** Renders the shop over scripted Play and backend fakes. */
const renderShop = async (
  script: BillingScript,
  backend = createFakePurchaseBackend(),
  locale: YouTubeLocale = "en",
  withBilling = true,
  durableAccount = true,
) => {
  /** Play fake. */
  const billing = createFakeBilling(script);
  /** Port given to the screen. */
  const port: PlayBillingPort | null = withBilling ? billing : null;
  /** Records explicit navigation to durable account linking. */
  const onShowAccount = jest.fn();
  await render(
    <SafeAreaProvider>
      <HostedShopScreen
        locale={locale}
        services={createFakeHostServices()}
        accountUid="device-uid"
        fallbackCoins={300}
        billing={port}
        commerce={port ? createAndroidCommerce(port, backend) : null}
        durableAccount={durableAccount}
        onShowAccount={onShowAccount}
        onBack={() => undefined}
      />
    </SafeAreaProvider>,
  );
  return {billing, backend, onShowAccount};
};

describe("HostedShopScreen", () => {
  it("requires account linking for new purchases while allowing existing receipts to restore", async () => {
    /** An anonymous account can inspect prices and restore, but cannot buy. */
    const f = await renderShop({products: fullCatalog}, createFakePurchaseBackend(), "en", true, false);
    await waitFor(() => expect(screen.getByTestId(`shop-buy-${PACK_ID}`)).toBeDisabled());
    await fireEvent.press(screen.getByTestId(`shop-buy-${PACK_ID}`));
    expect(f.billing.calls.some(call => call.startsWith("purchase:"))).toBe(false);
    await fireEvent.press(screen.getByTestId("shop-link-account")); expect(f.onShowAccount).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("shop-restore")).toBeEnabled();
  });

  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("lists priced coin packs with badges and the Premium plans, and shows the confirmed balance", async () => {
    await renderShop({products: fullCatalog});
    await expectScreen(`shop-pack-${PACK_ID}`);
    expect(screen.getByTestId("shop-coins")).toHaveTextContent(/300$/u);
    expect(screen.getByTestId("shop-pack-com.roobsworld.riddlequest.coinpack1")).toHaveTextContent(/STARTER/u);
    expect(screen.getByTestId("shop-pack-com.roobsworld.riddlequest.coinpack6")).toHaveTextContent(/BEST VALUE/u);
    expect(screen.getByTestId(`shop-buy-${PACK_ID}`)).toHaveTextContent("£1.99");
    expect(screen.getByTestId("shop-premium")).toHaveTextContent(/3400 coins added to your balance every 30 days/u);
    expect(screen.getByTestId(`shop-plan-${MONTHLY_ID}`)).toHaveTextContent(/£9\.99 \/ month/u);
    expect(screen.getByTestId(`shop-plan-${YEARLY_ID}`)).toHaveTextContent(/£79\.99 \/ year/u);
    expect(screen.queryByTestId("shop-premium-active")).toBeNull();
  });

  it("buys a coin pack, reports the coins and refreshes the profile", async () => {
    /** Retains {billing, backend} for this operation. */
    const {billing, backend} = await renderShop(
      {products: fullCatalog, checkouts: [{status: "purchased", purchases: [owned("tok", PACK_ID)]}]},
      createFakePurchaseBackend({grants: {tok: {}}}),
    );
    await press(`shop-buy-${PACK_ID}`);
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent("550 coins added."));
    expect(billing.calls).toContain(`purchase:${PACK_ID}:device-uid`);
    expect(backend.calls).toEqual(["sync:", "grant:tok"]);
    expect(calls).toContain("loadProfile:device-uid");
  });

  it("stays quiet on a cancelled checkout and reports pending and failed ones", async () => {
    await renderShop({products: fullCatalog, checkouts: [{status: "cancelled"}, {status: "pending"}, new Error("billing-unavailable")]});
    await expectScreen(`shop-buy-${PACK_ID}`);
    await press(`shop-buy-${PACK_ID}`);
    await waitFor(() => expect(screen.getByTestId(`shop-buy-${PACK_ID}`)).not.toBeDisabled());
    expect(screen.queryByTestId("shop-notice")).toBeNull();
    await press(`shop-buy-${PACK_ID}`);
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent(/pending/u));
    await press(`shop-buy-${PACK_ID}`);
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent("Purchase failed. Please try again."));
    expect(calls).not.toContain("loadProfile:device-uid");
  });

  it("subscribes to Premium and then offers Play's subscription management", async () => {
    /** Mutable backend script. */
    const backendScript: Parameters<typeof createFakePurchaseBackend>[0] = {sync: {activeSkus: []}};
    /** Retains backend for this operation. */
    const backend = createFakePurchaseBackend(backendScript);
    /** Retains {billing} for this operation. */
    const {billing} = await renderShop(
      {products: fullCatalog, checkouts: [{status: "purchased", purchases: [owned("sub", MONTHLY_ID)]}], ownedSubs: [owned("sub", MONTHLY_ID)]},
      backend,
    );
    await expectScreen(`shop-buy-${MONTHLY_ID}`);
    // Play reports the subscription before the backend verifies it.
    backendScript.sync = {activeSkus: [MONTHLY_ID], premiumCoinsAwarded: 3400, newCoins: 3700};
    await press(`shop-buy-${MONTHLY_ID}`);
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent("Premium active"));
    expect(screen.getByTestId("shop-premium-active")).toBeTruthy();
    await press(`shop-manage-${MONTHLY_ID}`);
    expect(billing.calls).toContain(`manage:${MONTHLY_ID}`);
  });

  it("treats a subscription Play completed but the backend has not verified yet as pending", async () => {
    await renderShop(
      {products: fullCatalog, checkouts: [{status: "purchased", purchases: [owned("sub", MONTHLY_ID)]}], ownedSubs: [owned("sub", MONTHLY_ID)]},
      createFakePurchaseBackend({sync: {activeSkus: []}}),
    );
    await expectScreen(`shop-buy-${MONTHLY_ID}`);
    await press(`shop-buy-${MONTHLY_ID}`);
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent(/pending/u));
  });

  it("shows an active Premium plan on open and restores owned purchases", async () => {
    await renderShop(
      {products: fullCatalog, ownedInapp: [owned("left", PACK_ID)], ownedSubs: [owned("sub", MONTHLY_ID)]},
      createFakePurchaseBackend({grants: {left: {}}, sync: {activeSkus: [MONTHLY_ID]}}),
    );
    await expectScreen(`shop-manage-${MONTHLY_ID}`);
    await press("shop-restore");
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent("550 coins added."));
    await press("shop-restore");
    await waitFor(() => expect(screen.getByTestId("shop-notice")).toHaveTextContent("Purchases restored."));
  });

  it("explains when Play cannot price products and retries", async () => {
    /** Script whose first pricing fails. */
    const script: BillingScript = {products: new Error("service-unavailable")};
    await renderShop(script);
    await expectScreen("shop-load-failed");
    script.products = [];
    await press("shop-reload");
    await expectScreen("shop-empty");
    expect(screen.getByTestId("shop-empty")).toHaveTextContent("No coin packs are available right now.");
  });

  it("explains that Play Billing is unavailable when the device's Play Store cannot connect", async () => {
    await renderShop({products: Object.assign(new Error("Billing service unavailable on device."), {code: "billing-unavailable"})});
    await expectScreen("shop-unavailable");
    expect(screen.getByTestId("shop-unavailable")).toHaveTextContent("Google Play purchases aren't available on this device.");
  });

  it("explains that a device without Play Billing cannot buy, in the player's language", async () => {
    await renderShop({}, createFakePurchaseBackend(), "es", false);
    expect(screen.getByTestId("shop-unavailable")).toHaveTextContent("Las compras de Google Play no están disponibles en este dispositivo.");
    expect(screen.getByTestId("shop-heading")).toHaveTextContent("TIENDA DE MONEDAS");
    expect(screen.queryByTestId("shop-restore")).toBeNull();
  });
});

describe("AndroidApp shop", () => {
  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("settles owned purchases on launch and opens the shop from the hosted home", async () => {
    /** Backend fake shared with the client. */
    const backend = createFakePurchaseBackend({grants: {left: {}}});
    /** Client that provisions immediately. */
    const client = {
      projectId: "riddle-quest-test",
      usingEmulators: true,
      functions: {} as never,
      currentUser: () => null,
      onUserChanged: () => () => {},
      signInAnonymously: async () => ({uid: "device-uid"}) as never,
      signOut: async () => {},
      loadUserDocument: async () => null,
      provisionAccount: async () => ({uid: "device-uid", created: false, coins: 300}),
      purchases: backend,
    } satisfies HostedFirebaseClient;
    /** Play fake with an interrupted coin purchase. */
    const billing = createFakeBilling({products: fullCatalog, ownedInapp: [owned("left", PACK_ID)]});
    await render(
      <SafeAreaProvider>
        <AndroidApp sdk={createPort()} contentSource={contentSource} client={client} services={createFakeHostServices()} billing={billing} />
      </SafeAreaProvider>,
    );
    await expectScreen("screen-hosted-home");
    await waitFor(() => expect(calls).toContain("loadProfile:device-uid"));
    expect(backend.calls.slice(0, 2)).toEqual(["grant:left", "sync:"]);
    await press("show-shop");
    await expectScreen("screen-shop");
    await expectScreen(`shop-pack-${PACK_ID}`);
    await press("back");
    await expectScreen("screen-hosted-home");
  });
});
