package com.kodbot.companion

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class AppUpdate(
    val versionCode: Long,
    val versionName: String,
    val apkUrl: String,
    val notes: String,
)

/** Fetches the small public update manifest from the KodBot repository and
 * installs the APK the manifest points at. The manifest is intentionally
 * separate from the app build so a new release does not need a desktop
 * server or a rebuilt UI. */
object AppUpdateChecker {
    private const val MANIFEST_URL =
        "https://raw.githubusercontent.com/kod13eood-cmd/KodBot/main/android/latest.json"

    suspend fun latest(installedVersionCode: Long): AppUpdate? = withContext(Dispatchers.IO) {
        val connection = (URL(MANIFEST_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "KodBot-Android")
        }
        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                throw IllegalStateException("Update server returned HTTP ${connection.responseCode}.")
            }
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(body)
            val versionCode = json.optLong("versionCode", 0)
            val versionName = json.optString("versionName").trim()
            val apkUrl = json.optString("apkUrl").trim()
            if (versionCode <= 0 || versionName.isBlank() || !apkUrl.startsWith("https://")) return@withContext null
            if (versionCode <= installedVersionCode) return@withContext null
            AppUpdate(
                versionCode = versionCode,
                versionName = versionName,
                apkUrl = apkUrl,
                notes = json.optString("notes").trim(),
            )
        } finally {
            connection.disconnect()
        }
    }

    suspend fun download(context: Context, update: AppUpdate): File = withContext(Dispatchers.IO) {
        val directory = File(context.cacheDir, "updates").apply { mkdirs() }
        val target = File(directory, "kodbot-${update.versionCode}.apk")
        val temporary = File(directory, "kodbot-${update.versionCode}.part")
        temporary.delete()
        val connection = (URL(update.apkUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            requestMethod = "GET"
            setRequestProperty("User-Agent", "KodBot-Android")
        }
        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                throw IllegalStateException("Download failed (HTTP ${connection.responseCode}).")
            }
            val expected = connection.contentLengthLong
            if (expected in 1 until 1_000_000) throw IllegalStateException("The update file is unexpectedly small.")
            connection.inputStream.use { input ->
                temporary.outputStream().use { output -> input.copyTo(output) }
            }
            if (temporary.length() < 1_000_000) throw IllegalStateException("The downloaded update is incomplete.")
            if (!temporary.renameTo(target)) {
                temporary.copyTo(target, overwrite = true)
                temporary.delete()
            }
            target
        } finally {
            connection.disconnect()
        }
    }

    fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
