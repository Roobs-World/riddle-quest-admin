package com.roobsworld.riddlequest.installreferrer

import android.os.Handler
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.util.concurrent.Future

/** Reads only the untrusted Play installation entry, without collecting attribution metadata. */
class InstallReferrerModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val reader = Executors.newSingleThreadExecutor()
  private var pending: PendingRead? = null
  @Volatile private var invalidated = false

  override fun getName(): String = NAME

  /** A single connection owns one promise, timeout and optional background Binder read. */
  private class PendingRead(val client: InstallReferrerClient, val promise: Promise) {
    var timeout: Runnable? = null
    var worker: Future<*>? = null
  }

  /** Resolves unavailable, unsupported and interrupted Play services without delaying startup. */
  @ReactMethod
  fun readInstallReferrer(promise: Promise) {
    mainHandler.post {
      if (invalidated || pending != null) {
        promise.resolve(null)
        return@post
      }
      val client = try {
        InstallReferrerClient.newBuilder(reactApplicationContext).build()
      } catch (_: Exception) {
        promise.resolve(null)
        return@post
      }
      val request = PendingRead(client, promise)
      pending = request
      val timeout = Runnable { complete(request, null) }
      request.timeout = timeout
      mainHandler.postDelayed(timeout, TIMEOUT_MS)
      try {
        client.startConnection(object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            mainHandler.post {
              if (pending !== request || request.worker != null) return@post
              if (invalidated || responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
                complete(request, null)
                return@post
              }
              try {
                request.worker = reader.submit {
                  val referrer = try { client.installReferrer.installReferrer } catch (_: Exception) { null }
                  mainHandler.post { complete(request, referrer) }
                }
              } catch (_: Exception) {
                complete(request, null)
              }
            }
          }

          override fun onInstallReferrerServiceDisconnected() {
            mainHandler.post { complete(request, null) }
          }
        })
      } catch (_: Exception) {
        complete(request, null)
      }
    }
  }

  /** Retires the current connection before resolving, so late callbacks cannot settle another read. */
  private fun complete(request: PendingRead, referrer: String?) {
    if (pending !== request) return
    pending = null
    request.timeout?.let(mainHandler::removeCallbacks)
    request.worker?.cancel(true)
    try { request.client.endConnection() } catch (_: Exception) { }
    request.promise.resolve(referrer?.takeIf { it.isNotEmpty() && it.length <= MAX_REFERRER_LENGTH })
  }

  /** Releases the Play service and every pending promise when React Native destroys the module. */
  override fun invalidate() {
    invalidated = true
    mainHandler.post { pending?.let { complete(it, null) } }
    reader.shutdownNow()
    super.invalidate()
  }

  companion object {
    const val NAME = "RiddleQuestInstallReferrer"
    private const val TIMEOUT_MS = 5_000L
    private const val MAX_REFERRER_LENGTH = 4_096
  }
}
