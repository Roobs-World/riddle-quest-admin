package com.roobsworld.riddlequest.installreferrer

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the optional local Play Store installation-entry bridge. */
class InstallReferrerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == InstallReferrerModule.NAME) InstallReferrerModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      InstallReferrerModule.NAME to ReactModuleInfo(
        InstallReferrerModule.NAME,
        InstallReferrerModule::class.java.name,
        false,
        false,
        false,
        false,
      ),
    )
  }
}
