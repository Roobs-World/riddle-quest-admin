package com.roobsworld.riddlequest.notifications

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.URI
import javax.net.ssl.HttpsURLConnection

internal object NotificationImage {
  private const val MAX_BYTES = 2 * 1024 * 1024
  private const val MAX_SOURCE_DIMENSION = 4096
  private const val MAX_DISPLAY_DIMENSION = 1024

  fun isPermittedUrl(value: String): Boolean {
    if (value.length > 2048 || value.any { it.code <= 31 || it.code == 127 }) return false
    return try {
      val url = URI(value)
      url.scheme.equals("https", ignoreCase = true) && !url.host.isNullOrEmpty() && url.rawUserInfo == null && url.rawFragment == null &&
        (url.port == -1 || url.port == 443)
    } catch (_: Exception) { false }
  }

  private fun isPublicAddress(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress ||
      address.isSiteLocalAddress || address.isMulticastAddress) return false
    val bytes = address.address
    if (bytes.size == 16 && (bytes[0].toInt() and 254) == 252) return false
    if (bytes.size == 4) {
      val first = bytes[0].toInt() and 255
      val second = bytes[1].toInt() and 255
      if (first == 0 || first >= 224 || first == 100 && second in 64..127 || first == 198 && second in 18..19) return false
    }
    return true
  }

  fun load(value: String, expiresAtMs: Long): Bitmap? {
    if (!isPermittedUrl(value) || expiresAtMs <= System.currentTimeMillis()) return null
    return try {
      val url = URI(value).toURL()
      val addresses = InetAddress.getAllByName(url.host)
      if (addresses.isEmpty() || addresses.any { !isPublicAddress(it) }) return null
      val started = SystemClock.elapsedRealtime()
      val connection = url.openConnection() as HttpsURLConnection
      try {
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 3000
        connection.readTimeout = 1000
        connection.useCaches = false
        connection.setRequestProperty("Accept", "image/png,image/jpeg,image/webp")
        if (connection.responseCode != 200 || connection.contentLengthLong > MAX_BYTES ||
          connection.contentType?.substringBefore(';')?.trim()?.lowercase() !in setOf("image/png", "image/jpeg", "image/webp")) return null
        val bytes = ByteArrayOutputStream().use { output ->
          connection.inputStream.use { input ->
            val buffer = ByteArray(8192)
            while (true) {
              if (SystemClock.elapsedRealtime() - started > 8000 || expiresAtMs <= System.currentTimeMillis()) return null
              val count = input.read(buffer)
              if (count < 0) break
              if (output.size() + count > MAX_BYTES) return null
              output.write(buffer, 0, count)
            }
          }
          output.toByteArray()
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth !in 1..MAX_SOURCE_DIMENSION || bounds.outHeight !in 1..MAX_SOURCE_DIMENSION ||
          bounds.outMimeType !in setOf("image/png", "image/jpeg", "image/webp")) return null
        var sample = 1
        while (bounds.outWidth / sample > MAX_DISPLAY_DIMENSION || bounds.outHeight / sample > MAX_DISPLAY_DIMENSION) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
      } finally { connection.disconnect() }
    } catch (_: Exception) { null }
  }
}
