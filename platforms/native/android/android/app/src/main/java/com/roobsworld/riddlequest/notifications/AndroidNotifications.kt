package com.roobsworld.riddlequest.notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.roobsworld.riddlequest.MainActivity
import com.roobsworld.riddlequest.R
import java.util.UUID

internal data class AndroidNotificationContent(
  val accountId: String,
  val notificationId: String,
  val title: String,
  val body: String,
  val imageUrl: String?,
  val expiresAtMs: Long,
  val registrationRevision: Long?,
  val link: String?
)

object AndroidNotifications {
  const val CHANNEL = "riddle-quest"
  const val WORK_TAG = "riddle-quest-notifications"
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
    catch (_: Exception) { }
  }

  @Synchronized
  fun deviceId(context: Context): String {
    val prefs = preferences(context)
    val existing = prefs.getString("deviceId", null)
    if (existing != null && existing.matches(Regex("[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))) return existing
    val created = UUID.randomUUID().toString()
    check(prefs.edit().putString("deviceId", created).commit()) { "notification-device-save-failed" }
    return created
  }

  @Synchronized
  fun beginAccountOperation(context: Context, accountId: String): Long {
    val prefs = preferences(context)
    val next = prefs.getLong("commandEpoch", 0) + 1
    check(next in 1..9_007_199_254_740_991L) { "notification-command-unavailable" }
    check(prefs.edit().putLong("commandEpoch", next).putString("commandUid", accountId).commit()) {
      "notification-command-save-failed"
    }
    return next
  }

  @Synchronized
  fun invalidateAccountOperation(context: Context, accountId: String) {
    val prefs = preferences(context)
    if (prefs.getString("commandUid", null) != accountId) return
    check(prefs.edit().putLong("commandEpoch", prefs.getLong("commandEpoch", 0) + 1).remove("commandUid").commit()) {
      "notification-command-save-failed"
    }
  }

  @Synchronized
  fun setAccount(context: Context, accountId: String, enabled: Boolean, operationId: Long, registrationRevision: Long): Boolean {
    val prefs = preferences(context)
    if (prefs.getString("commandUid", null) != accountId || prefs.getLong("commandEpoch", 0) != operationId) return false
    applyAccount(context, accountId, enabled, registrationRevision)
    return true
  }

  private fun applyAccount(context: Context, accountId: String, enabled: Boolean, registrationRevision: Long) {
    val prefs = preferences(context)
    val changedOwner = prefs.getString("accountId", null) != accountId
    val changedConsent = isEnabled(context) != enabled
    val edit = prefs.edit().putString("accountId", accountId).putBoolean("enabled", enabled)
      .putLong("registrationRevision", registrationRevision)
      .remove("liveChallenge").remove("daily")
    if (changedOwner || changedConsent) edit.putLong("ownerEpoch", prefs.getLong("ownerEpoch", 0) + 1)
    check(edit.commit()) { "notification-preference-save-failed" }
    try { FirebaseMessaging.getInstance().isAutoInitEnabled = enabled } catch (_: Exception) { }
    if (changedOwner || !enabled) {
      context.getSystemService(NotificationManager::class.java).cancelAll()
      WorkManager.getInstance(context).cancelAllWorkByTag(WORK_TAG)
    }
  }

  @Synchronized
  fun clearAccount(context: Context, expectedUid: String): Boolean {
    invalidateAccountOperation(context, expectedUid)
    if (preferences(context).getString("accountId", null) != expectedUid) return false
    applyAccount(context, "", false, 0)
    return true
  }

  @Synchronized
  fun recordToken(context: Context, token: String) {
    if (!token.matches(Regex("[A-Za-z0-9_:.-]{20,4096}"))) return
    if (preferences(context).edit().putString("knownToken", token).putString("pendingToken", token).commit()) NotificationModule.tokenChanged()
  }

  @Synchronized
  fun recordKnownToken(context: Context, token: String) {
    if (!token.matches(Regex("[A-Za-z0-9_:.-]{20,4096}"))) return
    val prefs = preferences(context)
    val pending = prefs.getString("pendingToken", null)
    if (pending != null && pending != token) return
    prefs.edit().putString("knownToken", token).commit()
  }

  fun knownToken(context: Context): String? {
    val prefs = preferences(context)
    return prefs.getString("knownToken", null) ?: prefs.getString("pendingToken", null)
  }

  fun pendingToken(context: Context): String? = preferences(context).getString("pendingToken", null)

  @Synchronized
  fun clearPendingToken(context: Context, expectedToken: String): Boolean {
    val prefs = preferences(context)
    if (prefs.getString("pendingToken", null) != expectedToken) return false
    return prefs.edit().remove("pendingToken").commit()
  }

  private fun isEnabled(context: Context): Boolean {
    val prefs = preferences(context)
    return if (prefs.contains("enabled")) prefs.getBoolean("enabled", false)
      else prefs.getBoolean("liveChallenge", false) || prefs.getBoolean("daily", false)
  }

  internal fun content(data: Map<String, String>): AndroidNotificationContent? {
    val account = data["accountId"]?.takeIf { it.isNotEmpty() && it.length <= 128 } ?: return null
    val title = data["title"]?.takeIf { it.isNotBlank() && it.length <= 200 } ?: return null
    val body = data["body"]?.takeIf { it.isNotBlank() && it.length <= 2000 } ?: return null
    val expires = data["expiresAtMs"]?.toLongOrNull()?.takeIf { it > 0 } ?: return null
    val kind = data["kind"] ?: return null
    val id: String
    val link: String?
    val registrationRevision: Long?
    when (kind) {
      "campaign" -> {
        id = data["notificationId"]?.takeIf { it.matches(Regex("[a-f0-9]{64}")) } ?: return null
        registrationRevision = data["registrationRevision"]?.toLongOrNull()?.takeIf { it in 1..9_007_199_254_740_991L } ?: return null
        link = null
      }
      "daily" -> { id = "legacy-daily"; registrationRevision = null; link = "riddlequest://daily" }
      "liveChallenge" -> {
        val challenge = data["challengeId"]?.takeIf { it.matches(Regex("live_[a-f0-9]{64}")) } ?: return null
        id = challenge
        registrationRevision = null
        link = "riddlequest://race?challengeId=$challenge"
      }
      else -> return null
    }
    val image = data["imageUrl"]?.takeIf { NotificationImage.isPermittedUrl(it) }
    return AndroidNotificationContent(account, id, title, body, image, expires, registrationRevision, link)
  }

  internal fun mayDisplay(context: Context, message: AndroidNotificationContent, epoch: Long): Boolean {
    val prefs = preferences(context)
    return prefs.getString("accountId", null) == message.accountId && prefs.getLong("ownerEpoch", 0) == epoch &&
      isEnabled(context) && message.expiresAtMs > System.currentTimeMillis() &&
      (message.registrationRevision == null || prefs.getLong("registrationRevision", 0) == message.registrationRevision) &&
      (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
  }

  @Synchronized
  fun display(context: Context, data: Map<String, String>) {
    val message = content(data) ?: return
    val epoch = preferences(context).getLong("ownerEpoch", 0)
    if (!mayDisplay(context, message, epoch)) return
    present(context, message, epoch, null)
    if (message.imageUrl == null) return
    val payload = Data.Builder().putString("kind", data["kind"]).putString("accountId", message.accountId)
      .putString("notificationId", message.notificationId).putString("title", message.title).putString("body", message.body)
      .putString("imageUrl", message.imageUrl).putString("expiresAtMs", message.expiresAtMs.toString())
      .putLong("ownerEpoch", epoch)
    data["challengeId"]?.let { payload.putString("challengeId", it) }
    message.registrationRevision?.let { payload.putString("registrationRevision", it.toString()) }
    val work = OneTimeWorkRequestBuilder<NotificationImageWorker>().setInputData(payload.build()).addTag(WORK_TAG).build()
    WorkManager.getInstance(context).enqueueUniqueWork("$WORK_TAG:${message.accountId}:${message.notificationId}", ExistingWorkPolicy.KEEP, work)
  }

  @Synchronized
  internal fun present(context: Context, message: AndroidNotificationContent, epoch: Long, image: Bitmap?) {
    if (!mayDisplay(context, message, epoch)) return
    val intent = Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (message.link != null) intent.setAction(Intent.ACTION_VIEW).setData(Uri.parse(message.link))
    else intent.setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val pending = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
    if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(message.expiresAtMs - System.currentTimeMillis())
    builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(message.title).setContentText(message.body)
      .setOnlyAlertOnce(true).setAutoCancel(true).setContentIntent(pending)
    if (image != null) builder.setStyle(Notification.BigPictureStyle().bigPicture(image).setSummaryText(message.body))
    else builder.setStyle(Notification.BigTextStyle().bigText(message.body))
    context.getSystemService(NotificationManager::class.java).notify(message.notificationId, 0, builder.build())
  }
}
