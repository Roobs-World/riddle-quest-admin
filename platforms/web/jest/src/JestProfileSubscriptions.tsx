import {tr} from "../../../../src/web/play/i18n";
import {useSubscriptionManagement} from "../../../../src/web/play/modalPages/commerce/useSubscriptionManagement";

/** Shares subscription management across Profile and Settings using the target's authoritative entitlement catalog. */
export function JestProfileSubscriptions() {
  /** Authoritative catalog and cancellation state drive the Profile subscription controls. */
  const {products, pending, cancelled, unavailable, error, cancel} = useSubscriptionManagement();
  /** Authoritative active subscriptions whose renewal can be managed in Profile. */
  const active = products.filter((product) => product.productType === "subscription" && product.subscriptionStatus === "active");
  if (active.length === 0) return null;
  return (
    <div className="profile-subscriptions">
      {error ? <p role="alert">{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p> : null}
      {active.map((product) => (
        <div key={product.productId} className="profile-subscription">
          <strong>{product.name}</strong>
          <span>{tr("CoinShop.SUBSCRIPTION_ACTIVE")}</span>
          <button disabled={pending !== null || cancelled.includes(product.productId) || unavailable.includes(product.productId)}
            onClick={() => void cancel(product.productId)}>
            {tr("CoinShop.CANCEL_SUBSCRIPTION")}
          </button>
          {unavailable.includes(product.productId) ? <small role="status">{tr("CoinShop.SUBSCRIPTION_CANCEL_UNAVAILABLE_NOTICE")}</small> : null}
          {cancelled.includes(product.productId) ? <small role="status">{tr("CoinShop.SUBSCRIPTION_CANCELLED_NOTICE")}</small> : null}
        </div>
      ))}
    </div>
  );
}
