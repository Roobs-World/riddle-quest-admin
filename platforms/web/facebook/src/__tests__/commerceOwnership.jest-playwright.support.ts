import {expect} from "@jest/globals";
import {expect as expectBrowser, type Page} from "@playwright/test";
import {FACEBOOK_PRODUCTS} from "../commerce/facebookCatalog";

/** Exercises the mounted Facebook checkout with only external payment, HTTP and persistence fixtures. */
export async function verifyCommerceOwnership(page: Page, origin: string): Promise<void> {
  let grants = 0;
  await page.route("**/getFacebookClientConfiguration", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({data: {
      commerceEnabled: true, removeInterstitialAds: false,
      interstitialsEnabled: false, rewardedAdsEnabled: false, notificationsEnabled: false,
      referralsEnabled: false, matchmakingEnabled: false, tournamentsEnabled: false, presenceEnabled: false,
    }}),
  }));
  await page.route("**/grantFacebookPurchase", route => {
    grants += 1;
    return route.fulfill({status: 500, contentType: "application/json",
      body: JSON.stringify({error: {status: "INTERNAL"}})});
  });
  const catalog = Object.values(FACEBOOK_PRODUCTS).map(product => ({
    productID: product.productId, title: `Fixture ${product.coins || "ad removal"}`,
    description: "Browser payment fixture", price: `$${(product.basePriceUsdCents / 100).toFixed(2)}`,
    priceAmount: String(product.basePriceUsdCents / 100), priceCurrencyCode: "USD",
  }));
  await page.addInitScript(products => {
    if (new URL(location.href).searchParams.get("commerce") !== "ownership") return;
    const sdk = window.FBInstant!;
    const supported = sdk.getSupportedAPIs.bind(sdk);
    sdk.getSupportedAPIs = () => [...supported(), "payments.getCatalogAsync", "payments.getPurchasesAsync",
      "payments.purchaseAsync", "payments.consumePurchaseAsync"];
    sdk.payments = {
      onReady: callback => callback(),
      async getCatalogAsync() {return products;},
      async getPurchasesAsync() {
        if (Reflect.get(window, "__holdCommerceReceipts")) {
          await new Promise<void>(resolve => Reflect.set(window, "__releaseCommerceReceipts", resolve));
        }
        return [];
      },
      async purchaseAsync() {
        window.__facebookEvents.push("commerce:purchase");
        throw {code: "USER_INPUT"};
      },
      async consumePurchaseAsync() {throw new Error("No browser fixture purchase may be consumed.");},
    };
  }, catalog);
  await page.goto(`${origin}/?harness=race&commerce=ownership`);
  await page.locator(".game-bottom-navigation").waitFor();
  const onboarding = page.locator(".onboarding-card .play-primary");
  if (await onboarding.count()) {
    await onboarding.click();
    await page.locator(".onboarding-clues").waitFor();
    await onboarding.click();
    await onboarding.waitFor({state: "detached"});
  }
  for (let step = 0; step < 8; step++) {
    const tip = page.locator(".tooltip-backdrop");
    try {await tip.first().waitFor({timeout: 500});} catch {break;}
    await tip.first().locator("button").last().click();
  }
  await page.locator(".tooltip-backdrop").waitFor({state: "detached"});
  await page.locator("button.coin-pill").click();
  const purchase = page.locator(".game-shop-grid button").first();
  await purchase.waitFor();
  expect(await page.locator(".game-shop-grid article").count()).toBe(7);

  // A control click proves the real session exposes Meta checkout for its captured owner.
  await purchase.click();
  await page.waitForFunction(() => window.__facebookEvents.filter(event => event.startsWith("analytics:checkout_result:")).length === 1);
  expect(await page.evaluate(() => window.__facebookEvents.filter(event => event === "commerce:purchase").length)).toBe(1);
  expect(grants).toBe(0);

  // Change accounts after checkout admission, while the provider receipt read is still pending.
  await page.evaluate(() => Reflect.set(window, "__holdCommerceReceipts", true));
  await purchase.click();
  await page.waitForFunction(() => typeof Reflect.get(window, "__releaseCommerceReceipts") === "function");
  await page.locator(".game-app[inert]").waitFor();
  await replacePersistedAccount(page);
  await page.evaluate(() => Reflect.get(window, "__releaseCommerceReceipts")());
  await page.locator(".game-app[inert]").waitFor({state: "detached"});
  expect(await page.evaluate(() => window.__facebookEvents.filter(event => event === "commerce:purchase").length)).toBe(1);
  expect(grants).toBe(0);
}

/** Models another tab signing in through Auth's real IndexedDB persistence without accessing app internals. */
async function replacePersistedAccount(page: Page): Promise<void> {
  const replacementUid = `facebook_${"b".repeat(40)}`;
  await page.evaluate(async uid => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("firebaseLocalStorageDb");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("firebaseLocalStorage", "readwrite");
        const store = transaction.objectStore("firebaseLocalStorage");
        const request = store.getAll();
        request.onsuccess = () => {
          const record = request.result.find(value => value.fbase_key.startsWith("firebase:authUser:"));
          if (!record || record.value.uid !== `facebook_${"a".repeat(40)}`) {
            transaction.abort();
            reject(new Error("Expected the isolated original account in browser persistence."));
            return;
          }
          const token = record.value.stsTokenManager.accessToken.split(".");
          const claims = JSON.parse(atob(token[1].replace(/-/gu, "+").replace(/_/gu, "/")));
          token[1] = btoa(JSON.stringify({...claims, sub: uid, user_id: uid})).replace(/=/gu, "").replace(/\+/gu, "-").replace(/\//gu, "_");
          record.value = {...record.value, uid, browserFixtureReplacementPending: true,
            stsTokenManager: {...record.value.stsTokenManager, accessToken: token.join(".")}};
          store.put(record);
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {database.close();}
  }, replacementUid);
  // Auth polls every 800 ms, adopts the new user, then writes its normalized record back.
  // The new UID/claims plus removed marker distinguish adoption from an old-owner write.
  await expectBrowser.poll(() => page.evaluate(async uid => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("firebaseLocalStorageDb");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const records = await new Promise<Array<{fbase_key: string; value: {
        uid: string; browserFixtureReplacementPending?: boolean; stsTokenManager: {accessToken: string};
      }}>>((resolve, reject) => {
        const request = database.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const user = records.find(record => record.fbase_key.startsWith("firebase:authUser:"))?.value;
      if (user?.uid !== uid || user.browserFixtureReplacementPending !== undefined) return false;
      const payload = user.stsTokenManager.accessToken.split(".")[1].replace(/-/gu, "+").replace(/_/gu, "/");
      const claims = JSON.parse(atob(payload));
      return claims.sub === uid && claims.user_id === uid;
    } finally {database.close();}
  }, replacementUid), {timeout: 5_000}).toBe(true);
}
