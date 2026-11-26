package com.roobsworld.riddlequest.avatar

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/** Permission-free file selection and bounded avatar decoding; profile grants stay on the server. */
class AvatarPickerModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var pending: Promise? = null
  private val decoder = Executors.newSingleThreadExecutor()
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_CODE) return
      val promise = synchronized(this@AvatarPickerModule) {pending} ?: return
      val uri = data?.data
      if (resultCode != Activity.RESULT_OK || uri == null) {finish(promise, null); return}
      try {
        decoder.execute {
          try {finish(promise, prepare(uri))}
          catch (failure: Exception) {fail(promise, "invalid-avatar-file", failure)}
        }
      } catch (failure: Exception) {fail(promise, "avatar-picker-closed", failure)}
    }
  }

  init {context.addActivityEventListener(listener)}
  override fun getName(): String = NAME

  /** The system document picker grants read access to only the player's chosen image. */
  @ReactMethod
  fun pickAvatar(promise: Promise) {
    synchronized(this) {
      if (pending != null) {promise.reject("avatar-picker-busy", "An image selection is already open."); return}
      pending = promise
    }
    val activity = context.currentActivity
    if (activity == null) {fail(promise, "avatar-picker-unavailable", IllegalStateException("No active activity")); return}
    activity.runOnUiThread {
      try {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "image/*"
          putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp"))
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivityForResult(intent, REQUEST_CODE)
      } catch (failure: Exception) {fail(promise, "avatar-picker-unavailable", failure)}
    }
  }

  private fun finish(promise: Promise, value: String?) {
    val owned = synchronized(this) {if (pending === promise) {pending = null; true} else false}
    if (owned) promise.resolve(value)
  }

  private fun fail(promise: Promise, code: String, failure: Exception) {
    val owned = synchronized(this) {if (pending === promise) {pending = null; true} else false}
    if (owned) promise.reject(code, failure)
  }

  /** Source bytes are bounded before decoding, then sampled to at most 1024 pixels per side. */
  private fun prepare(uri: Uri): String {
    require(uri.scheme == "content")
    val mime = context.contentResolver.getType(uri)
    require(mime in setOf("image/jpeg", "image/png", "image/webp"))
    val bytes = context.contentResolver.openInputStream(uri)?.use {input ->
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(8192)
      var count = input.read(buffer)
      while (count != -1) {
        require(output.size() + count <= MAX_SOURCE_BYTES)
        output.write(buffer, 0, count)
        count = input.read(buffer)
      }
      output.toByteArray()
    } ?: throw IllegalArgumentException("Unreadable image")
    require(bytes.isNotEmpty())
    val bounds = BitmapFactory.Options().apply {inJustDecodeBounds = true}
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    require(bounds.outWidth > 0 && bounds.outHeight > 0)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply {inSampleSize = sample})
      ?: throw IllegalArgumentException("Invalid image")
    var oriented = decoded
    var cropped: Bitmap? = null
    var scaled: Bitmap? = null
    try {
      val orientation = try {ExifInterface(ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)}
        catch (_: Exception) {ExifInterface.ORIENTATION_NORMAL}
      val matrix = Matrix().apply {
        when (orientation) {
          ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
          ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
          ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
          ExifInterface.ORIENTATION_TRANSPOSE -> {setRotate(90f); postScale(-1f, 1f)}
          ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
          ExifInterface.ORIENTATION_TRANSVERSE -> {setRotate(-90f); postScale(-1f, 1f)}
          ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
        }
      }
      oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
      val size = minOf(oriented.width, oriented.height)
      cropped = Bitmap.createBitmap(oriented, (oriented.width - size) / 2, (oriented.height - size) / 2, size, size)
      scaled = Bitmap.createScaledBitmap(cropped, 256, 256, true)
      val output = ByteArrayOutputStream()
      val format = if (Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP
      check(scaled.compress(format, 82, output))
      require(output.size() <= MAX_OUTPUT_BYTES)
      return "data:image/webp;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
    } finally {
      setOfNotNull(scaled, cropped, oriented, decoded).forEach {it.recycle()}
    }
  }

  override fun invalidate() {
    val promise = synchronized(this) {pending.also {pending = null}}
    promise?.reject("avatar-picker-closed", "Image selection closed.")
    context.removeActivityEventListener(listener)
    decoder.shutdownNow()
    super.invalidate()
  }

  companion object {
    const val NAME = "RiddleQuestAvatarPicker"
    private const val REQUEST_CODE = 7126
    private const val MAX_SOURCE_BYTES = 5 * 1024 * 1024
    private const val MAX_OUTPUT_BYTES = 512 * 1024
  }
}
