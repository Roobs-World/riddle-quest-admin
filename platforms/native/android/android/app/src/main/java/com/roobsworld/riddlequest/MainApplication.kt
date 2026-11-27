package com.roobsworld.riddlequest

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.roobsworld.riddlequest.notifications.NotificationPackage
import com.roobsworld.riddlequest.notifications.AndroidNotifications
import com.roobsworld.riddlequest.auth.GoogleCredentialsPackage
import com.roobsworld.riddlequest.avatar.AvatarPickerPackage
import com.roobsworld.riddlequest.billing.PlayBillingPackage
import com.roobsworld.riddlequest.integrity.PlayIntegrityPackage
import com.roobsworld.riddlequest.installreferrer.InstallReferrerPackage
import com.roobsworld.riddlequest.analytics.AnalyticsPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(GoogleCredentialsPackage())
          add(AvatarPickerPackage())
          add(PlayBillingPackage())
          add(NotificationPackage())
          add(PlayIntegrityPackage())
          add(InstallReferrerPackage())
          add(AnalyticsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    AndroidNotifications.restore(this)
    loadReactNative(this)
  }
}
