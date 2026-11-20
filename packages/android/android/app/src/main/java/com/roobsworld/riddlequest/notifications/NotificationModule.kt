package com.roobsworld.riddlequest.notifications

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.firebase.messaging.FirebaseMessaging

class NotificationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
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
      messaging.token.addOnSuccessListener { promise.resolve(it) }
        .addOnFailureListener { promise.reject("notification-token-unavailable", it) }
    } catch (error: Exception) { promise.reject("notification-token-unavailable", error) }
  }

  @ReactMethod
  fun setAccount(accountId: String, invitations: Boolean, daily: Boolean, promise: Promise) {
    AndroidNotifications.setAccount(context, accountId, invitations, daily)
    promise.resolve(null)
  }

  @ReactMethod
  fun clearAccount(expectedUid: String, promise: Promise) {
    promise.resolve(AndroidNotifications.clearAccount(context, expectedUid))
  }
}
