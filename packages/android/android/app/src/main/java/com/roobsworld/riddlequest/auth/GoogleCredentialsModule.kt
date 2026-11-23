package com.roobsworld.riddlequest.auth

import android.os.CancellationSignal
import android.util.Base64
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.Executor

/** Retrieves a nonce-bound Google ID token; the existing Firebase JS SDK verifies and links it. */
class GoogleCredentialsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val manager = CredentialManager.create(context)
  private var pending: Promise? = null
  private var cancellation: CancellationSignal? = null
  override fun getName(): String = NAME

  @ReactMethod
  fun getIdToken(webClientId: String, promise: Promise) {
    if (!webClientId.matches(Regex("[A-Za-z0-9._-]+\\.apps\\.googleusercontent\\.com"))) {
      promise.reject("google-sign-in-unavailable", "Google sign-in is not configured."); return
    }
    val activity = context.currentActivity
    if (activity == null) {promise.reject("google-sign-in-unavailable", "No active activity."); return}
    val signal = CancellationSignal()
    synchronized(this) {
      if (pending != null) {promise.reject("google-sign-in-busy", "Google sign-in is already open."); return}
      pending = promise; cancellation = signal
    }
    val nonce = Base64.encodeToString(ByteArray(32).also {SecureRandom().nextBytes(it)}, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    activity.runOnUiThread {
      try {
        val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        manager.getCredentialAsync(activity, request, signal, Executor {activity.runOnUiThread(it)},
          object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
            override fun onResult(result: GetCredentialResponse) {
              try {
                val credential = result.credential
                require(credential is CustomCredential && credential.type in setOf(GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL, GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL))
                val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                val parts = token.split('.')
                require(parts.size == 3)
                // Nonce comparison binds this response to the current native request; Firebase verifies the signature.
                val payload = JSONObject(String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP), Charsets.UTF_8))
                require(payload.optString("nonce") == nonce)
                complete(promise, token)
              } catch (_: Exception) {fail(promise, "google-credential-invalid")}
            }
            override fun onError(error: GetCredentialException) {
              if (error is GetCredentialCancellationException) complete(promise, null)
              else fail(promise, "google-sign-in-failed")
            }
          })
      } catch (_: Exception) {fail(promise, "google-sign-in-failed")}
    }
  }

  private fun complete(promise: Promise, token: String?) {
    val owned = synchronized(this) {if (pending === promise) {pending = null; cancellation = null; true} else false}
    if (owned) promise.resolve(token)
  }
  private fun fail(promise: Promise, code: String) {
    val owned = synchronized(this) {if (pending === promise) {pending = null; cancellation = null; true} else false}
    if (owned) promise.reject(code, "Google sign-in could not finish.")
  }

  /** Clears only the provider's active session, never the linked Google account or game progress. */
  @ReactMethod
  fun clearSession(promise: Promise) {
    val executor = Executor {context.runOnUiQueueThread(it)}
    manager.clearCredentialStateAsync(ClearCredentialStateRequest(), null, executor,
      object : CredentialManagerCallback<Void?, ClearCredentialException> {
        override fun onResult(result: Void?) {promise.resolve(null)}
        override fun onError(error: ClearCredentialException) {promise.reject("google-session-clear-failed", "Google session could not be cleared.")}
      })
  }

  override fun invalidate() {
    val selected = synchronized(this) {pending.also {pending = null; cancellation?.cancel(); cancellation = null}}
    selected?.reject("google-sign-in-closed", "Google sign-in closed.")
    super.invalidate()
  }
  companion object {const val NAME = "RiddleQuestGoogleCredentials"}
}
