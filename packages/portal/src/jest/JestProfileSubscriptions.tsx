import {tr} from "../play/i18n";
import {useSubscriptionManagement} from "../play/modalPages/commerce/useSubscriptionManagement";

/** Keeps subscription management in Profile, using the target's authoritative entitlement catalog. */
export function JestProfileSubscriptions() {
  /** Authoritative catalog and cancellation state drive the Profile subscription controls. */
  const {products, pending, cancelled, error, cancel} = useSubscriptionManagement();
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
          <button disabled={pending !== null || cancelled.includes(product.productId)}
            onClick={() => void cancel(product.productId)}>
            {tr("CoinShop.CANCEL_SUBSCRIPTION")}
          </button>
          {cancelled.includes(product.productId) ? <small role="status">{tr("CoinShop.SUBSCRIPTION_CANCELLED_NOTICE")}</small> : null}
        </div>
      ))}
    </div>
  );
}
