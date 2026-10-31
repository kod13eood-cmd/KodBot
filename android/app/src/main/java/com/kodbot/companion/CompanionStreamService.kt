package com.kodbot.companion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import java.io.IOException
import java.net.HttpURLConnection
import org.json.JSONObject

/** Keeps the resumable companion stream alive while Android backgrounds the UI. */
class CompanionStreamService : Service() {
    @Volatile private var running = false
    @Volatile private var activeConnection: HttpURLConnection? = null
    private var streamThread: Thread? = null
    private lateinit var connectionStore: ConnectionStore

    override fun onCreate() {
        super.onCreate()
        connectionStore = ConnectionStore(this)
        CompanionStreamService.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopStream()
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val connection = runCatching { connectionStore.load() }.getOrNull()
        if (connection == null) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        startForeground(ONGOING_NOTIFICATION_ID, connectionNotification(connection.serverName))
        if (streamThread?.isAlive != true) {
            running = true
            streamThread = Thread({ streamLoop() }, "kodbot-companion-events").also { it.start() }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopStream()
        super.onDestroy()
    }

    private fun streamLoop() {
        var retryMs = 1_000L
        while (running && !Thread.currentThread().isInterrupted) {
            val saved = runCatching { connectionStore.load() }.getOrNull() ?: break
            val http = try {
                CompanionApi(saved).openEvents(connectionStore.cursor())
            } catch (_: Exception) {
                waitBeforeRetry(retryMs)
                retryMs = (retryMs * 2).coerceAtMost(MAX_RETRY_MS)
                continue
            }
            activeConnection = http
            try {
                val status = http.responseCode
                if (status != HttpURLConnection.HTTP_OK) {
                    val message = http.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                    if (status == HttpURLConnection.HTTP_UNAUTHORIZED) {
                        CompanionSignals.publish(JSONObject().put("kind", "unauthorized"))
                        stopSelf()
                        return
                    }
                    throw IOException(message.ifBlank { "The computer returned HTTP $status." })
                }

                retryMs = 1_000L
                val parser = SseParser()
                http.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                    while (running && !Thread.currentThread().isInterrupted) {
                        val line = reader.readLine() ?: break
                        val event = parser.line(line) ?: continue
                        val frame = runCatching { JSONObject(event.data) }.getOrNull() ?: continue
                        event.id?.takeIf(String::isNotBlank)?.let(connectionStore::saveCursor)
                        handleFrame(frame)
                    }
                }
            } catch (_: Exception) {
                // The stream is deliberately re-opened with its last cursor.
            } finally {
                if (activeConnection === http) activeConnection = null
                http.disconnect()
            }

            if (running) {
                waitBeforeRetry(retryMs)
                retryMs = (retryMs * 2).coerceAtMost(MAX_RETRY_MS)
            }
        }
        stopSelf()
    }

    private fun handleFrame(frame: JSONObject) {
        if (frame.optString("kind") == "hello") {
            frame.optString("cursor").takeIf(String::isNotBlank)?.let(connectionStore::saveCursor)
            CompanionSignals.publish(frame)
            return
        }

        CompanionApi.notification(frame)?.let(::showAgentNotification)
        when (frame.optString("kind")) {
            "message", "message.patch", "bot", "bot.deleted", "group", "group.deleted", "notify" ->
                CompanionSignals.publish(frame)
        }
    }

    private fun showAgentNotification(item: AgentNotification) {
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_BOT_ID, item.botId)
            putExtra(EXTRA_THREAD_ID, item.threadId)
        }
        val pending = PendingIntent.getActivity(
            this,
            item.threadId.hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = Notification.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(item.title)
            .setContentText(item.body)
            .setStyle(Notification.BigTextStyle().bigText(item.body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .build()
        val tag = "${item.threadId}:${item.kind}"
        manager().notify(tag, item.threadId.hashCode(), notification)
    }

    private fun connectionNotification(serverName: String): Notification =
        Notification.Builder(this, CONNECTION_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("KodBot connected")
            .setContentText("Listening for updates from $serverName")
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .build()

    private fun manager(): NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun waitBeforeRetry(delayMs: Long) {
        try {
            Thread.sleep(delayMs)
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        }
    }

    private fun stopStream() {
        running = false
        activeConnection?.disconnect()
        streamThread?.interrupt()
        streamThread = null
        activeConnection = null
    }

    companion object {
        const val ACTION_STOP = "com.kodbot.companion.STOP_STREAM"
        const val EXTRA_BOT_ID = "com.kodbot.companion.BOT_ID"
        const val EXTRA_THREAD_ID = "com.kodbot.companion.THREAD_ID"
        private const val CONNECTION_CHANNEL = "kodbot.connection"
        private const val ALERT_CHANNEL = "kodbot.agent-alerts"
        private const val ONGOING_NOTIFICATION_ID = 401
        private const val MAX_RETRY_MS = 15_000L

        fun start(context: Context) {
            val intent = Intent(context, CompanionStreamService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CompanionStreamService::class.java))
        }

        fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannels(
                listOf(
                    NotificationChannel(CONNECTION_CHANNEL, "KodBot connection", NotificationManager.IMPORTANCE_LOW).apply {
                        description = "Shows when KodBot is listening for agent updates."
                        setShowBadge(false)
                    },
                    NotificationChannel(ALERT_CHANNEL, "Agent alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                        description = "Approvals, questions, and completed agent work."
                        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                    },
                ),
            )
        }
    }
}
