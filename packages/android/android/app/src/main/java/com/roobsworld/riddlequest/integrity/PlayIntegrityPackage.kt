package com.roobsworld.riddlequest.integrity

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers [PlayIntegrityModule] with React Native. */
class PlayIntegrityPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == PlayIntegrityModule.NAME) PlayIntegrityModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      PlayIntegrityModule.NAME to ReactModuleInfo(
        PlayIntegrityModule.NAME,
        PlayIntegrityModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        false, // isTurboModule
      ),
    )
  }
}
