package com.roobsworld.riddlequest.avatar

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the system image picker without a media-library permission. */
class AvatarPickerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == AvatarPickerModule.NAME) AvatarPickerModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(AvatarPickerModule.NAME to ReactModuleInfo(
      AvatarPickerModule.NAME, AvatarPickerModule::class.java.name, false, false, false, false,
    ))
  }
}
