import {googleIdentityCopy} from "../i18n/googleIdentityCopy";
import type {HostServices} from "@riddle-quest/hosted/hostTypes";
import {youtubeText, type YouTubeLocale} from "@riddle-quest/solo";
import {useCallback} from "react";
import {StyleSheet, Text, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import type {AndroidCommerce} from "../billing/androidCommerce";
import type {PlayBillingPort, PlayProduct} from "../billing/playBilling";
import {useShop, type ShopNotice} from "../billing/useShop";
import {useAuthSnapshot} from "../hosted/useAuthSnapshot";
import {shopText, type ShopCopyKey} from "../i18n/shopCopy";
import {PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "@riddle-quest/core/pricing/catalog";
import {palette, spacing} from "../theme";
/** Props for {@link HostedShopScreen}. */
export type HostedShopScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Shared hosted services, for the live balance. */
  services: HostServices;
  /** Firebase uid that owns purchases. */
  accountUid: string;
  /** Balance shown until the profile loads. */
  fallbackCoins: number;
  /** Play port, or `null` when the device has none. */
  billing: PlayBillingPort | null;
  /** Shop flow, or `null` without Play. */
  commerce: AndroidCommerce | null;
  /** Whether Google linking makes this exact purchase account recoverable. */
  durableAccount: boolean;
  /** Opens account linking before a new paid checkout. */
  onShowAccount: () => void;
  /** Returns to the home screen. */
  onBack: () => void;
}>;
/** Copy key per coin-pack badge. */
const BADGE_COPY: Readonly<Record<string, ShopCopyKey>> = {starter: "badgeStarter", popular: "badgePopular", bestValue: "badgeBestValue"};
/** Renders the message for a shop notice. */
const noticeText = (locale: YouTubeLocale, notice: ShopNotice): string => {
  switch (notice.kind) {
    case "coinsAdded":
      return shopText(locale, "coinsAdded", {coins: notice.coins});
    case "premiumActive":
      return shopText(locale, "premiumActive");
    case "pending":
      return shopText(locale, "purchasePending");
    case "restored":
      return shopText(locale, "purchasesRestored");
    case "failed":
      return shopText(locale, "purchaseFailed");
  }
};
/** Google Play shop: coin packs and Premium, settled by the backend. */
export function HostedShopScreen({locale, services, accountUid, fallbackCoins, billing, commerce, durableAccount, onShowAccount, onBack}: HostedShopScreenProps) {
  /** Live account snapshot for the confirmed balance. */
  const snapshot = useAuthSnapshot(services);
  /** Refreshes the published profile after a grant. */
  const onAccountChanged = useCallback(() => {
    void services.loadProfile(accountUid).catch(() => undefined);
  }, [accountUid, services]);
  /** Shop state. */
  const shop = useShop({billing, commerce, accountUid, onAccountChanged});
  /** Confirmed balance. */
  const coins = snapshot.profile?.coins ?? fallbackCoins;
  /** Renders one Premium plan. */
  const renderPlan = (plan: PlayProduct) => {
    /** Whether this plan is already active. */
    const active = shop.activeSkus.includes(plan.productId);
    /** Period label. */
    const period = shopText(locale, plan.billingPeriod === "P1Y" ? "perYear" : "perMonth");
    return (
      <View key={plan.productId} style={styles.row} testID={`shop-plan-${plan.productId}`}>
        <Text style={styles.rowTitle}>{`${plan.price} / ${period}`}</Text>
        {active ? (
          <ActionButton label={shopText(locale, "manageSubscription")} onPress={() => void billing?.manageSubscription(plan.productId)} testID={`shop-manage-${plan.productId}`} />
        ) : (
          <ActionButton
            tone="primary"
            label={shopText(locale, "subscribe")}
            disabled={shop.busy !== null || !durableAccount}
            onPress={() => shop.buy(plan)}
            testID={`shop-buy-${plan.productId}`}
          />
        )}
      </View>
    );
  };
  return (
    <Screen testID="screen-shop">
      <Panel>
        <ActionButton label={`← ${youtubeText(locale, "back")}`} onPress={onBack} style={styles.back} testID="back" />
        <Heading testID="shop-heading">{shopText(locale, "shopTitle")}</Heading>
        <Text accessibilityLabel={`${shopText(locale, "yourBalance")}: ${coins}`} style={styles.balance} testID="shop-coins">
          {`${shopText(locale, "yourBalance")}: 🪙 ${coins}`}
        </Text>
        {!durableAccount && <View style={styles.stack} testID="shop-account-required">
          <Notice>{googleIdentityCopy(locale).intro}</Notice>
          <ActionButton label={googleIdentityCopy(locale).title} onPress={onShowAccount} testID="shop-link-account" />
        </View>}
        {shop.notice && (
          <Notice error={shop.notice.kind === "failed"} testID="shop-notice">
            {noticeText(locale, shop.notice)}
          </Notice>
        )}
        {shop.catalog.kind === "unavailable" && <Notice testID="shop-unavailable">{shopText(locale, "shopUnavailable")}</Notice>}
        {shop.catalog.kind === "loading" && <Notice testID="shop-loading">{shopText(locale, "loadingShop")}</Notice>}
        {shop.catalog.kind === "failed" && (
          <View style={styles.stack}>
            <Notice error testID="shop-load-failed">{shopText(locale, "shopLoadFailed")}</Notice>
            <ActionButton label={youtubeText(locale, "retry")} onPress={shop.reload} testID="shop-reload" />
          </View>
        )}
        {shop.catalog.kind === "ready" && (
          <View style={styles.stack}>
            {shop.catalog.packs.length === 0 && <Notice testID="shop-empty">{shopText(locale, "noProducts")}</Notice>}
            {shop.catalog.packs.map((pack) => (
              <View key={pack.productId} style={styles.row} testID={`shop-pack-${pack.productId}`}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{`🪙 ${pack.coins}`}</Text>
                  {pack.badge && <Eyebrow>{shopText(locale, BADGE_COPY[pack.badge])}</Eyebrow>}
                </View>
                <ActionButton
                  tone="primary"
                  label={pack.product.price}
                  disabled={shop.busy !== null || !durableAccount}
                  onPress={() => shop.buy(pack.product)}
                  testID={`shop-buy-${pack.productId}`}
                />
              </View>
            ))}
            {shop.catalog.premium.length > 0 && (
              <View style={styles.stack} testID="shop-premium">
                {shop.activeSkus.length > 0 && <Heading level={2} testID="shop-premium-active">{shopText(locale, "premiumActive")}</Heading>}
                <Text style={styles.body}>{shopText(locale, "premiumBenefitCoins", {coins: PREMIUM_SUBSCRIPTION_MONTHLY_COINS})}</Text>
                {shop.catalog.premium.map(renderPlan)}
              </View>
            )}
          </View>
        )}
        {commerce && (
          <ActionButton
            label={shopText(locale, "restorePurchases")}
            disabled={shop.busy !== null}
            onPress={shop.restore}
            testID="shop-restore"
          />
        )}
      </Panel>
    </Screen>
  );
}
/** Styles for the shop. */
const styles = StyleSheet.create({
  back: {alignSelf: "flex-start", minHeight: 40},
  balance: {color: palette.text, fontSize: 16, fontWeight: "600"},
  body: {color: palette.subtle, fontSize: 15, lineHeight: 22},
  stack: {gap: spacing.sm},
  row: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, padding: spacing.sm, borderRadius: 12, backgroundColor: palette.banner},
  rowText: {gap: spacing.xs},
  rowTitle: {color: palette.text, fontSize: 18, fontWeight: "700"},
});
