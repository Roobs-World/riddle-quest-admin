package com.roobsworld.riddlequest.notifications

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.firebase.messaging.FirebaseMessaging
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

class NotificationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  init { owner = WeakReference(this) }

  companion object {
    @Volatile private var owner: WeakReference<NotificationModule>? = null
    fun tokenChanged() { owner?.get()?.emitTokenChanged() }
  }

  private fun emitTokenChanged() {
    try {
      if (context.hasActiveReactInstance()) {
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("riddleQuestNotificationTokenChanged", null)
      }
    } catch (_: Exception) { }
  }

  override fun invalidate() {
    if (owner?.get() === this) owner = null
    super.invalidate()
  }

  override fun getName() = "RiddleQuestNotifications"

  @ReactMethod
  fun configure(config: ReadableMap, promise: Promise) {
    try {
      AndroidNotifications.configure(context, config.getString("appId") ?: "", config.getString("apiKey") ?: "",
        config.getString("projectId") ?: "", config.getString("senderId") ?: "")
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("notification-config-unavailable", error) }
  }

  @ReactMethod
  fun getToken(promise: Promise) {
    try {
      val messaging = FirebaseMessaging.getInstance()
      messaging.token.addOnSuccessListener {
        AndroidNotifications.recordKnownToken(context, it)
        promise.resolve(it)
      }
        .addOnFailureListener { promise.reject("notification-token-unavailable", it) }
    } catch (error: Exception) { promise.reject("notification-token-unavailable", error) }
  }

  @ReactMethod
  fun deviceId(promise: Promise) {
    try { promise.resolve(AndroidNotifications.deviceId(context)) }
    catch (error: Exception) { promise.reject("notification-device-unavailable", error) }
  }

  @ReactMethod
  fun beginAccountOperation(accountId: String, promise: Promise) {
    try { promise.resolve(AndroidNotifications.beginAccountOperation(context, accountId).toDouble()) }
    catch (error: Exception) { promise.reject("notification-account-unavailable", error) }
  }

  @ReactMethod
  fun invalidateAccountOperation(accountId: String, promise: Promise) {
    try {
      AndroidNotifications.invalidateAccountOperation(context, accountId)
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("notification-account-unavailable", error) }
  }

  @ReactMethod
  fun setAccount(accountId: String, enabled: Boolean, operationId: Double, registrationRevision: Double, promise: Promise) {
    if (!operationId.isFinite() || operationId < 1 || operationId > 9_007_199_254_740_991.0 || operationId % 1.0 != 0.0 ||
      !registrationRevision.isFinite() || registrationRevision < 0 || registrationRevision > 9_007_199_254_740_991.0 ||
      registrationRevision % 1.0 != 0.0 || enabled && registrationRevision < 1) {
      promise.reject("notification-command-invalid", "Invalid notification command.")
      return
    }
    try { promise.resolve(AndroidNotifications.setAccount(context, accountId, enabled, operationId.toLong(), registrationRevision.toLong())) }
    catch (error: Exception) { promise.reject("notification-account-unavailable", error) }
  }

  @ReactMethod
  fun knownToken(promise: Promise) {
    promise.resolve(AndroidNotifications.knownToken(context))
  }

  @ReactMethod
  fun pendingToken(promise: Promise) {
    promise.resolve(AndroidNotifications.pendingToken(context))
  }

  @ReactMethod
  fun clearPendingToken(expectedToken: String, promise: Promise) {
    promise.resolve(AndroidNotifications.clearPendingToken(context, expectedToken))
  }

  @ReactMethod
  fun clearAccount(expectedUid: String, promise: Promise) {
    try { promise.resolve(AndroidNotifications.clearAccount(context, expectedUid)) }
    catch (error: Exception) { promise.reject("notification-account-unavailable", error) }
  }
}
