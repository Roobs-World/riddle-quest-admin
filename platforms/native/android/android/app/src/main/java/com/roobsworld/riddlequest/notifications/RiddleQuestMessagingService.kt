package com.roobsworld.riddlequest.notifications

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class RiddleQuestMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) { AndroidNotifications.display(this, message.data) }
}
