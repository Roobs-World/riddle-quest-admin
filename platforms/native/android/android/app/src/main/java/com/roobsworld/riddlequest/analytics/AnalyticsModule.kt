package com.roobsworld.riddlequest.analytics

import android.content.Context
import android.os.Bundle
import android.util.AtomicFile
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.analytics.FirebaseAnalytics
import com.roobsworld.riddlequest.BuildConfig

class AnalyticsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "RiddleQuestAnalytics"
  private val preferences get() = context.getSharedPreferences("riddle-quest-analytics", Context.MODE_PRIVATE)
  private var analytics: FirebaseAnalytics? = null
  private var available = false
  private var collectionAllowed = false
  private val denialMarker get() = AtomicFile(context.filesDir.resolve("analytics-consent-denied"))

  private fun persistDenial(): Boolean {
    var markerWritten = false
    val marker = denialMarker
    var stream: java.io.FileOutputStream? = null
    try {
      stream = marker.startWrite()
      stream.write(1)
      marker.finishWrite(stream)
      markerWritten = true
    } catch (_: Exception) {
      marker.failWrite(stream)
    }
    val preferenceWritten = try { preferences.edit().putBoolean("enabled", false).commit() } catch (_: Exception) { false }
    return preferenceWritten || markerWritten
  }

  private fun applyConsent(enabled: Boolean) {
    collectionAllowed = false
    val sdk = analytics ?: return
    if (!enabled) sdk.setAnalyticsCollectionEnabled(false)
    sdk.setConsent(mapOf(
      FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to if (enabled) FirebaseAnalytics.ConsentStatus.GRANTED else FirebaseAnalytics.ConsentStatus.DENIED,
      FirebaseAnalytics.ConsentType.AD_STORAGE to FirebaseAnalytics.ConsentStatus.DENIED,
      FirebaseAnalytics.ConsentType.AD_USER_DATA to FirebaseAnalytics.ConsentStatus.DENIED,
      FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to FirebaseAnalytics.ConsentStatus.DENIED,
    ))
    sdk.setUserProperty("allow_personalized_ads", "false")
    sdk.setAnalyticsCollectionEnabled(enabled)
    collectionAllowed = enabled
  }

  @ReactMethod
  fun configure(config: ReadableMap, promise: Promise) {
    try {
      if (BuildConfig.DEBUG || !config.hasKey("collectionAllowed") || !config.getBoolean("collectionAllowed")) {
        FirebaseAnalytics.getInstance(context).setAnalyticsCollectionEnabled(false)
        promise.resolve(null)
        return
      }
      val appId = config.getString("appId") ?: ""
      require(appId.matches(Regex("1:[0-9]+:android:[a-f0-9]+"))) { "firebase-android-app-id-required" }
      val existing = FirebaseApp.getApps(context).find { it.name == FirebaseApp.DEFAULT_APP_NAME }
      if (existing == null) {
        FirebaseApp.initializeApp(context, FirebaseOptions.Builder().setApplicationId(appId)
          .setApiKey(config.getString("apiKey") ?: "").setProjectId(config.getString("projectId") ?: "")
          .setGcmSenderId(config.getString("senderId") ?: "").build())
      } else require(existing.options.applicationId == appId) { "firebase-android-app-mismatch" }
      analytics = FirebaseAnalytics.getInstance(context)
      available = true
      val enabled = preferences.getBoolean("enabled", true) && !denialMarker.baseFile.exists()
      applyConsent(enabled)
      promise.resolve(enabled)
    } catch (error: Exception) {
      available = false
      collectionAllowed = false
      try { applyConsent(false) } catch (_: Exception) { }
      promise.reject("analytics-unavailable", error)
    }
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    try {
      require(available) { "analytics-unavailable" }
      if (!enabled) {
        applyConsent(false)
        analytics?.resetAnalyticsData()
        require(persistDenial()) { "analytics-preference-write-failed" }
      } else {
        require(preferences.edit().putBoolean("enabled", true).commit()) { "analytics-preference-write-failed" }
        denialMarker.delete()
        require(!denialMarker.baseFile.exists()) { "analytics-preference-write-failed" }
        applyConsent(true)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      collectionAllowed = false
      try { applyConsent(false) } catch (_: Exception) { }
      persistDenial()
      promise.reject("analytics-preference-failed", error)
    }
  }

  @ReactMethod
  fun logEvent(name: String, params: ReadableMap, promise: Promise) {
    try {
      if (analytics != null && collectionAllowed && name.matches(Regex("[a-z][a-z0-9_]{0,39}"))) {
        val bundle = Bundle()
        val keys = params.keySetIterator()
        var count = 0
        while (keys.hasNextKey() && count < 25) {
          val key = keys.nextKey()
          if (!key.matches(Regex("[a-z][a-z0-9_]{0,39}"))) continue
          when (params.getType(key)) {
            ReadableType.String -> bundle.putString(key, params.getString(key)?.take(100))
            ReadableType.Boolean -> bundle.putLong(key, if (params.getBoolean(key)) 1L else 0L)
            ReadableType.Number -> { val value = params.getDouble(key); if (value.isFinite()) bundle.putDouble(key, value) }
            else -> continue
          }
          count++
        }
        analytics?.logEvent(name, bundle)
      }
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("analytics-event-failed", error) }
  }
}
