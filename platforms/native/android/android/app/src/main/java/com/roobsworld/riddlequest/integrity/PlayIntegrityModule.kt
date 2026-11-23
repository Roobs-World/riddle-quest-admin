package com.roobsworld.riddlequest.integrity

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityServiceException
import com.google.android.play.core.integrity.IntegrityTokenRequest

/**
 * Play Integrity for App Check attestation (`NativeModules.RiddleQuestPlayIntegrity`).
 *
 * The token is opaque to the app: the backend decodes it with Google, checks it carries the
 * nonce the backend issued, and only then mints an App Check token.
 */
class PlayIntegrityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = NAME

  /** Requests an integrity token bound to [nonce] for the Firebase project's Cloud project number. */
  @ReactMethod
  fun requestIntegrityToken(nonce: String, cloudProjectNumber: String, promise: Promise) {
    val projectNumber = cloudProjectNumber.toLongOrNull()
    if (projectNumber == null) {
      promise.reject("integrity-invalid-project", "Cloud project number must be numeric.")
      return
    }
    IntegrityManagerFactory.create(reactApplicationContext)
      .requestIntegrityToken(IntegrityTokenRequest.builder().setNonce(nonce).setCloudProjectNumber(projectNumber).build())
      .addOnSuccessListener { response -> promise.resolve(response.token()) }
      .addOnFailureListener { error ->
        val code = (error as? IntegrityServiceException)?.errorCode ?: 0
        promise.reject("integrity-error-$code", error.message, error)
      }
  }

  companion object {
    /** JavaScript module name. */
    const val NAME = "RiddleQuestPlayIntegrity"
  }
}
