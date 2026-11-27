package com.roobsworld.riddlequest.notifications

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class NotificationImageWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
  override fun doWork(): Result {
    val data = inputData.keyValueMap.entries.mapNotNull { (key, value) ->
      if (value is String) key to value else null
    }.toMap()
    val message = AndroidNotifications.content(data) ?: return Result.failure()
    val epoch = inputData.getLong("ownerEpoch", -1)
    if (isStopped || !AndroidNotifications.mayDisplay(applicationContext, message, epoch)) return Result.success()
    val imageUrl = message.imageUrl ?: return Result.failure()
    val image = NotificationImage.load(imageUrl, message.expiresAtMs) ?: return Result.failure()
    if (!isStopped) AndroidNotifications.present(applicationContext, message, epoch, image)
    return Result.success()
  }
}
