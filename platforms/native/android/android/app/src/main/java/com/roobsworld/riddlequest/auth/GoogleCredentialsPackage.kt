package com.roobsworld.riddlequest.auth

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers native Credential Manager without introducing a second Firebase auth session. */
class GoogleCredentialsPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == GoogleCredentialsModule.NAME) GoogleCredentialsModule(reactContext) else null
  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(GoogleCredentialsModule.NAME to ReactModuleInfo(GoogleCredentialsModule.NAME,
      GoogleCredentialsModule::class.java.name, false, false, false, false))
  }
}
