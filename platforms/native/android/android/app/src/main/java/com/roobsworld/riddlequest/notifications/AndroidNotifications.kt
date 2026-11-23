package com.roobsworld.riddlequest.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.FirebaseOptions
import com.roobsworld.riddlequest.MainActivity
import com.roobsworld.riddlequest.R

object AndroidNotifications {
  const val CHANNEL = "riddle-quest"
  fun preferences(context: Context) = context.getSharedPreferences("riddle-quest-notifications", Context.MODE_PRIVATE)

  fun configure(context: Context, appId: String, apiKey: String, projectId: String, senderId: String) {
    require(appId.matches(Regex("1:[0-9]+:android:[a-f0-9]+"))) { "firebase-android-app-id-required" }
    if (FirebaseApp.getApps(context).none { it.name == FirebaseApp.DEFAULT_APP_NAME }) {
      FirebaseApp.initializeApp(context, FirebaseOptions.Builder().setApplicationId(appId).setApiKey(apiKey)
        .setProjectId(projectId).setGcmSenderId(senderId).build())
    }
    preferences(context).edit().putString("appId", appId).putString("apiKey", apiKey)
      .putString("projectId", projectId).putString("senderId", senderId).apply()
    if (Build.VERSION.SDK_INT >= 26) {
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL, context.getString(R.string.app_name), NotificationManager.IMPORTANCE_DEFAULT))
    }
  }

  fun restore(context: Context) {
    val prefs = preferences(context)
    val appId = prefs.getString("appId", null) ?: return
    try { configure(context, appId, prefs.getString("apiKey", "") ?: "", prefs.getString("projectId", "") ?: "", prefs.getString("senderId", "") ?: "") }
    catch (_: Exception) { /* A missing native Firebase registration never prevents offline play. */ }
  }

  @Synchronized
  fun setAccount(context: Context, accountId: String, invitations: Boolean, daily: Boolean) {
    preferences(context).edit().putString("accountId", accountId)
      .putBoolean("liveChallenge", invitations).putBoolean("daily", daily).commit()
    try { FirebaseMessaging.getInstance().isAutoInitEnabled = invitations || daily } catch (_: Exception) { }
    if (!invitations && !daily) context.getSystemService(NotificationManager::class.java).cancelAll()
  }

  @Synchronized
  fun clearAccount(context: Context, expectedUid: String): Boolean {
    if (preferences(context).getString("accountId", null) != expectedUid) return false
    setAccount(context, "", false, false)
    return true
  }

  @Synchronized
  fun display(context: Context, data: Map<String, String>) {
    val prefs = preferences(context)
    if (data["accountId"] != prefs.getString("accountId", null)) return
    val kind = data["kind"] ?: return
    if (kind !in listOf("liveChallenge", "daily") || !prefs.getBoolean(kind, false)) return
    val expires = data["expiresAtMs"]?.toLongOrNull() ?: return
    if (expires <= System.currentTimeMillis()) return
    val challenge = data["challengeId"]
    if (kind == "liveChallenge" && (challenge == null || !challenge.matches(Regex("live_[a-f0-9]{64}")))) return
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val title = data["title"]?.take(160) ?: return
    val body = data["body"]?.take(500) ?: return
    val link = if (kind == "daily") "riddlequest://daily" else "riddlequest://race?challengeId=$challenge"
    val intent = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(link))
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pending = PendingIntent.getActivity(context, link.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(context, CHANNEL) else android.app.Notification.Builder(context)
    if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(expires - System.currentTimeMillis())
    val notification = builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body)
      .setAutoCancel(true).setContentIntent(pending).build()
    context.getSystemService(NotificationManager::class.java).notify(link.hashCode(), notification)
  }
}
