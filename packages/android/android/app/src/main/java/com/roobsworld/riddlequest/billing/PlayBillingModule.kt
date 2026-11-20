package com.roobsworld.riddlequest.billing

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Google Play Billing for the shop (`NativeModules.RiddleQuestPlayBilling`).
 *
 * Play only reports purchases here. Coins and Premium are granted by the backend, which verifies
 * every token with the Play Developer API, so this module never acknowledges or grants anything
 * itself; it consumes a token only when the backend reports that it could not.
 */
class PlayBillingModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), PurchasesUpdatedListener {

  /** Priced products from the latest query, needed to launch their checkout. */
  private val products = ConcurrentHashMap<String, ProductDetails>()

  /** Checkout awaiting Play's purchase update. */
  private var checkout: Promise? = null

  /** Calls waiting for the billing service connection. */
  private val waiting = mutableListOf<Pair<Promise, () -> Unit>>()

  /** Whether a connection attempt is in flight. */
  private var connecting = false

  /** Play Billing client, created on first use. */
  private val client: BillingClient by lazy {
    BillingClient.newBuilder(context)
      .setListener(this)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
      .enableAutoServiceReconnection()
      .build()
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    val pending = synchronized(this) {
      val promises = (waiting.map { it.first } + listOfNotNull(checkout)).distinct()
      waiting.clear()
      checkout = null
      connecting = false
      promises
    }
    pending.forEach { it.reject("billing-closed", "The billing connection closed.") }
    client.endConnection()
    super.invalidate()
  }

  /** Runs [block] once the billing service is connected, or rejects [promise]. */
  private fun withConnection(promise: Promise, block: () -> Unit) {
    synchronized(this) {
      if (client.isReady) {
        block()
        return
      }
      waiting.add(promise to block)
      if (connecting) return
      connecting = true
    }
    client.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) {
        val queued = synchronized(this@PlayBillingModule) {
          connecting = false
          waiting.toList().also { waiting.clear() }
        }
        for ((queuedPromise, queuedBlock) in queued) {
          if (result.responseCode == BillingResponseCode.OK) queuedBlock()
          else {
            synchronized(this@PlayBillingModule) { if (checkout === queuedPromise) checkout = null }
            queuedPromise.reject("billing-unavailable", result.debugMessage)
          }
        }
      }

      override fun onBillingServiceDisconnected() = Unit
    })
  }

  /** Prices in-app products and subscriptions; unknown ids are omitted. */
  @ReactMethod
  fun getProducts(inapp: ReadableArray, subs: ReadableArray, promise: Promise) {
    withConnection(promise) {
      val priced = Arguments.createArray()
      val queries = listOf(ProductType.INAPP to inapp, ProductType.SUBS to subs).filter { it.second.size() > 0 }
      queryProducts(queries, 0, priced, promise)
    }
  }

  /** Queries each product type in turn, then resolves the combined list. */
  private fun queryProducts(queries: List<Pair<String, ReadableArray>>, index: Int, priced: WritableArray, promise: Promise) {
    if (index == queries.size) {
      promise.resolve(priced)
      return
    }
    val (type, ids) = queries[index]
    val params = QueryProductDetailsParams.newBuilder()
      .setProductList((0 until ids.size()).mapNotNull { ids.getString(it) }.map {
        QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(type).build()
      })
      .build()
    client.queryProductDetailsAsync(params) { result, details ->
      if (result.responseCode != BillingResponseCode.OK) {
        promise.reject("billing-error-${result.responseCode}", result.debugMessage)
        return@queryProductDetailsAsync
      }
      for (product in details.productDetailsList) {
        products[product.productId] = product
        toProduct(product)?.let { priced.pushMap(it) }
      }
      queryProducts(queries, index + 1, priced, promise)
    }
  }

  /** Maps one priced product, choosing a subscription's base-plan offer. */
  private fun toProduct(product: ProductDetails): WritableMap? {
    val map = Arguments.createMap()
    map.putString("productId", product.productId)
    if (product.productType == ProductType.INAPP) {
      val offer = product.oneTimePurchaseOfferDetails ?: return null
      map.putString("type", "inapp")
      map.putString("price", offer.formattedPrice)
      return map
    }
    val offer = product.subscriptionOfferDetails?.let { offers -> offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull() }
      ?: return null
    val recurring = offer.pricingPhases.pricingPhaseList.lastOrNull() ?: return null
    map.putString("type", "subs")
    map.putString("price", recurring.formattedPrice)
    map.putString("offerToken", offer.offerToken)
    map.putString("billingPeriod", recurring.billingPeriod)
    return map
  }

  /** Opens Play's checkout for a priced product, binding it to the hashed account uid. */
  @ReactMethod
  fun purchase(productId: String, type: String, offerToken: String?, accountUid: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    val product = products[productId]
    if (activity == null || product == null || product.productType != type) {
      promise.reject("product-not-loaded", "Load the product before buying it.")
      return
    }
    synchronized(this) {
      if (checkout != null) {
        promise.reject("checkout-in-progress", "Another checkout is open.")
        return
      }
      checkout = promise
    }
    val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
      .setProductDetails(product)
      .apply { if (offerToken != null) setOfferToken(offerToken) }
      .build()
    val flow = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(listOf(productParams))
      .setObfuscatedAccountId(sha256(accountUid))
      .build()
    withConnection(promise) {
      activity.runOnUiThread {
        val result = client.launchBillingFlow(activity, flow)
        if (result.responseCode != BillingResponseCode.OK) settleCheckout(result, null)
      }
    }
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    val wasCheckout = synchronized(this) { checkout != null }
    settleCheckout(result, purchases)
    if (!wasCheckout && result.responseCode == BillingResponseCode.OK) {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("RiddleQuestPurchasesChanged", null)
    }
  }

  /** Resolves the open checkout from Play's result. */
  private fun settleCheckout(result: BillingResult, purchases: List<Purchase>?) {
    val promise = synchronized(this) { checkout.also { checkout = null } } ?: return
    when (result.responseCode) {
      BillingResponseCode.OK -> {
        val list = purchases.orEmpty()
        if (list.none { it.purchaseState == Purchase.PurchaseState.PURCHASED } && list.any { it.purchaseState == Purchase.PurchaseState.PENDING }) {
          promise.resolve(Arguments.createMap().apply { putString("status", "pending") })
        } else {
          promise.resolve(Arguments.createMap().apply {
            putString("status", "purchased")
            putArray("purchases", toPurchases(list))
          })
        }
      }
      BillingResponseCode.USER_CANCELED -> promise.resolve(Arguments.createMap().apply { putString("status", "cancelled") })
      else -> promise.reject("billing-error-${result.responseCode}", result.debugMessage)
    }
  }

  /** Lists purchases the Play account owns for one product type. */
  @ReactMethod
  fun getOwnedPurchases(type: String, promise: Promise) {
    withConnection(promise) {
      client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build()) { result, purchases ->
        if (result.responseCode == BillingResponseCode.OK) promise.resolve(toPurchases(purchases))
        else promise.reject("billing-error-${result.responseCode}", result.debugMessage)
      }
    }
  }

  /** Consumes a granted in-app purchase; a token that is no longer owned counts as consumed. */
  @ReactMethod
  fun consume(purchaseToken: String, promise: Promise) {
    withConnection(promise) {
      client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(purchaseToken).build()) { result, _ ->
        if (result.responseCode == BillingResponseCode.OK || result.responseCode == BillingResponseCode.ITEM_NOT_OWNED) promise.resolve(null)
        else promise.reject("billing-error-${result.responseCode}", result.debugMessage)
      }
    }
  }

  /** Maps purchases for JavaScript. */
  private fun toPurchases(purchases: List<Purchase>): WritableArray {
    val array = Arguments.createArray()
    for (purchase in purchases) {
      array.pushMap(Arguments.createMap().apply {
        putString("purchaseToken", purchase.purchaseToken)
        putArray("products", Arguments.createArray().apply { purchase.products.forEach { pushString(it) } })
        putString(
          "state",
          when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> "purchased"
            Purchase.PurchaseState.PENDING -> "pending"
            else -> "unspecified"
          },
        )
      })
    }
    return array
  }

  companion object {
    /** JavaScript module name. */
    const val NAME = "RiddleQuestPlayBilling"

    /**
     * Play's `obfuscatedAccountId`: SHA-256 hex of the Firebase uid, which is exactly Play's
     * 64-character limit. The backend compares it with `androidPlayAccountId(uid)`.
     */
    fun sha256(value: String): String =
      MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
  }
}
