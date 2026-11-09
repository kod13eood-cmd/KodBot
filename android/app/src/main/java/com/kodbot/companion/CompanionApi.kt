package com.kodbot.companion

import android.content.ContentResolver
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder

data class CompanionConnection(
    val baseUrl: String,
    val serverName: String,
    val token: String,
    /** "session" = email/password gateway session; "device" = QR pairing. */
    val kind: String = "device",
)

/** One local file the phone is about to hand to the host. The content URI
 * stays valid only while the app has permission, so the bytes are uploaded
 * when the message is sent rather than at pick time. */
data class PendingAttachment(
    val uri: String,
    val name: String,
    val size: Long,
    val mimeType: String,
) : java.io.Serializable

/** A file that now exists on the host. `path` is what the prompt names. */
data class UploadedFile(
    val path: String,
    val name: String,
    val size: Long,
)

/** The same tagged block the desktop composer sends, so every engine sees
 * one attachment shape whether the prompt came from a laptop or a phone. */
fun composeMessage(text: String, files: List<UploadedFile>): String {
    val parts = mutableListOf(text.trim())
    for (file in files) {
        parts += "<attached-file path=\"${escapeAttachmentValue(file.path)}\" />"
    }
    return parts.filter { it.isNotEmpty() }.joinToString("\n\n")
}

private fun escapeAttachmentValue(value: String): String = value
    .replace("&", "&amp;")
    .replace("\"", "&quot;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\t", "&#9;")
    .replace("\r", "&#13;")
    .replace("\n", "&#10;")

data class ApprovalCard(
    val title: String,
    val subtitle: String,
    val options: List<String>,
    val requestId: String?,
    val tool: String?,
    val explanation: String?,
    val overdueAt: Long?,
    val answered: String?,
    val dismissed: Boolean,
) {
    val pending: Boolean get() = requestId != null && answered == null && !dismissed
    val permission: Boolean get() = !tool.isNullOrBlank()
}

data class TranscriptMessage(
    val id: String,
    val role: String,
    val kind: String,
    val text: String,
    val toolName: String,
    val senderName: String?,
    val card: ApprovalCard?,
)

data class ModelSelectionRecord(
    val instanceId: String,
    val model: String,
    val effort: String?,
)

data class ModelOptionRecord(
    val id: String,
    val label: String,
    val custom: Boolean,
    val free: Boolean,
    val group: String?,
)

data class EngineRecord(
    val instanceId: String,
    val displayName: String,
    val driverKind: String,
    val state: String,
    val reason: String?,
    val authenticated: Boolean?,
    val defaultModel: String,
    val models: List<ModelOptionRecord>,
) {
    val ready: Boolean get() = state == "available" && authenticated != false
}

data class ServerCheck(val serverName: String, val engines: List<EngineRecord>) {
    val readyEngines: Int get() = engines.count { it.ready }
}

data class ConversationRecord(
    val id: String,
    val threadId: String,
    val name: String,
    val kind: String,
    val busy: Boolean,
    val unread: Boolean,
    val hidden: Boolean,
    val memberCount: Int,
    val modelSelection: ModelSelectionRecord?,
    val messages: List<TranscriptMessage>,
    val color: String = "green",
    val role: String? = null,
    val mascotShape: String? = null,
    val teamId: String? = null,
    val teamName: String? = null,
    val teamIsLeader: Boolean = false,
    val autoModel: Boolean = false,
    val autoModelPool: List<ModelSelectionRecord> = emptyList(),
    val busyBotId: String? = null,
) {
    val key: String get() = "$kind:$id"
}

data class AgentNotification(
    val kind: String,
    val botId: String,
    val botName: String,
    val threadId: String,
    val title: String,
    val body: String,
)

data class PairingInvite(
    val address: String,
    val credential: String,
    val computerName: String?,
    val hosts: List<String>,
) {
    companion object {
        fun parse(raw: String?): PairingInvite? {
            val uri = raw?.let { runCatching { URI(it) }.getOrNull() } ?: return null
            // `kodbot` is the current link; `opencrew` is accepted so phones
            // and desktop installs from the previous name can still pair.
            val scheme = uri.scheme?.lowercase()
            if ((scheme != "kodbot" && scheme != "opencrew") || uri.host?.equals("pair", ignoreCase = true) != true) return null

            val values = mutableMapOf<String, String>()
            for (part in uri.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }) {
                val separator = part.indexOf('=')
                val rawKey = if (separator < 0) part else part.substring(0, separator)
                val rawValue = if (separator < 0) "" else part.substring(separator + 1)
                val key = decode(rawKey) ?: return null
                val value = decode(rawValue) ?: return null
                if (values.putIfAbsent(key, value) != null) return null
            }

            val address = values["address"]?.let { raw ->
                runCatching { CompanionAddress.normalize(raw) }.getOrNull()
                    ?: runCatching { CompanionAddress.normalizeGateway(raw) }.getOrNull()
            } ?: return null
            val token = values["token"]
            val credential = if (token != null) {
                if (!PAIRING_TOKEN.matches(token)) return null
                token
            } else {
                values["code"]?.takeIf(PAIRING_CODE::matches) ?: return null
            }
            val computerName = values["name"]
                ?.filterNot { it.isISOControl() }
                ?.take(80)
                ?.trim()
                ?.takeIf { it.isNotBlank() }
            val hosts = values["hosts"].orEmpty()
                .split(',')
                .map { it.trim() }
                .filter { host ->
                    host.isNotEmpty() && host.length <= 253 &&
                        host.none { it.isWhitespace() || "?#".contains(it) }
                }
                .distinct()
                .take(8)
            return PairingInvite(address, credential, computerName, hosts)
        }

        private fun decode(value: String): String? =
            runCatching { URLDecoder.decode(value, Charsets.UTF_8.name()) }.getOrNull()

        private val PAIRING_TOKEN = Regex("^omb_pair_[A-Za-z0-9_-]{43}$")
        private val PAIRING_CODE = Regex("^\\d{6}$")
    }
}

data class SseMessage(val id: String?, val data: String)

/** SSE is line-oriented; comments are keepalives and blank lines end events. */
class SseParser {
    private var id: String? = null
    private val data = mutableListOf<String>()

    fun line(raw: String): SseMessage? {
        val line = raw.removeSuffix("\r")
        if (line.isEmpty()) {
            val event = if (data.isEmpty()) null else SseMessage(id, data.joinToString("\n"))
            id = null
            data.clear()
            return event
        }
        if (line.startsWith(':')) return null
        val colon = line.indexOf(':')
        if (colon < 0) return null
        val name = line.substring(0, colon)
        val value = line.substring(colon + 1).removePrefix(" ")
        when (name) {
            "id" -> id = value
            "data" -> data += value
        }
        return null
    }
}

object CompanionAddress {
    /** Accept host[:port], URL, or a bracketed IPv6 literal; default is :8810. */
    fun normalize(raw: String, defaultPort: Int = 8810): String {
        val input = raw.trim().let { value ->
            when {
                value.contains("://") -> value
                value.count { it == ':' } > 1 && !value.startsWith("[") -> "http://[$value]"
                else -> "http://$value"
            }
        }
        val uri = try {
            java.net.URI(input)
        } catch (_: Exception) {
            throw IllegalArgumentException("Enter a computer address such as 192.168.1.42:8810.")
        }
        val host = uri.host?.removePrefix("[")?.removeSuffix("]")
        require(uri.scheme.equals("http", ignoreCase = true) && !host.isNullOrBlank()) {
            "Use the Companion address shown on the Linux computer."
        }
        require(uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.isNullOrEmptyOrSlash()) {
            "Enter only the computer address and optional port."
        }
        val port = if (uri.port == -1) defaultPort else uri.port
        require(port in 1..65535) { "The port must be between 1 and 65535." }
        return java.net.URI("http", null, host, port, null, null, null).toASCIIString().trimEnd('/')
    }

    /** Hosted gateway addresses may be HTTPS. The scheme is kept, and a bare
     * hostname defaults to HTTPS on 443; local installs can type http://. */
    fun normalizeGateway(raw: String): String {
        val value = raw.trim()
        require(value.isNotEmpty()) { "Enter the KodBot server address." }
        val input = if (value.contains("://")) value else "https://$value"
        val uri = try {
            java.net.URI(input)
        } catch (_: Exception) {
            throw IllegalArgumentException("Enter an address such as https://kodbot.example.com.")
        }
        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.removePrefix("[")?.removeSuffix("]")
        require((scheme == "https" || scheme == "http") && !host.isNullOrBlank()) {
            "Use an http:// or https:// server address."
        }
        require(uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.isNullOrEmptyOrSlash()) {
            "Enter only the server address and optional port."
        }
        val port = if (uri.port == -1) (if (scheme == "https") 443 else 80) else uri.port
        require(port in 1..65535) { "The port must be between 1 and 65535." }
        return java.net.URI(scheme, null, host, port, null, null, null).toASCIIString().trimEnd('/')
    }

    private fun String?.isNullOrEmptyOrSlash(): Boolean = this.isNullOrEmpty() || this == "/"
}

class CompanionApi(private val connection: CompanionConnection) {
    suspend fun fleet(): List<ConversationRecord> = withContext(Dispatchers.IO) {
        val root = JSONObject(request("GET", "/api/bots?messages=50"))
        val bots = root.optJSONArray("bots") ?: JSONArray()
        val groups = root.optJSONArray("groups") ?: JSONArray()
        val teams = root.optJSONArray("teams") ?: JSONArray()
        val teamByBot = mutableMapOf<String, TeamInfo>()
        for (index in 0 until teams.length()) {
            val team = teams.optJSONObject(index) ?: continue
            val id = team.optString("id")
            val name = team.optString("name")
            val leader = team.optString("leaderBotId")
            val members = team.optJSONArray("memberIds") ?: JSONArray()
            for (memberIndex in 0 until members.length()) {
                val botId = members.optString(memberIndex)
                if (botId.isNotBlank()) teamByBot[botId] = TeamInfo(id, name, leader)
            }
        }
        val botChats = (0 until bots.length()).mapNotNull { index ->
            val bot = bots.optJSONObject(index) ?: return@mapNotNull null
            bot.toBotConversation(teamByBot[bot.optString("id")])
        }
        val groupChats = (0 until groups.length()).mapNotNull { index -> groups.optJSONObject(index)?.toGroupConversation() }
        (botChats + groupChats).filterNot { it.id.isBlank() }
    }

    suspend fun instances(): List<EngineRecord> = withContext(Dispatchers.IO) {
        val root = JSONObject(request("GET", "/api/instances"))
        val instances = root.optJSONArray("instances") ?: JSONArray()
        (0 until instances.length()).mapNotNull { index -> instances.optJSONObject(index)?.toEngine() }
    }

    suspend fun testServer(): ServerCheck = withContext(Dispatchers.IO) {
        val health = JSONObject(request("GET", "/api/health"))
        if (health.optString("app") != "kodbot") throw IOException("That address isn't a KodBot server.")
        ServerCheck(connection.serverName, instances())
    }

    suspend fun send(chat: ConversationRecord, text: String) = withContext(Dispatchers.IO) {
        val route = if (chat.kind == "group") "/api/groups" else "/api/bots"
        request("POST", "$route/${encodePath(chat.id)}/messages", JSONObject().put("text", text))
    }

    /** Copy one picked file to the host and return the path an agent can
     * open. Chunked on purpose: a content provider may report no size, and a
     * fixed-length stream would then truncate or fail before the request. */
    suspend fun upload(attachment: PendingAttachment, resolver: ContentResolver): UploadedFile =
        withContext(Dispatchers.IO) {
            require(attachment.size <= MAX_ATTACHMENT_BYTES) {
                "${attachment.name} is larger than ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB."
            }
            val input = resolver.openInputStream(Uri.parse(attachment.uri))
                ?: throw IOException("Couldn't open ${attachment.name}.")
            val http = URL(connection.baseUrl + "/api/uploads").openConnection() as HttpURLConnection
            try {
                http.requestMethod = "POST"
                http.connectTimeout = 15_000
                http.readTimeout = 120_000
                http.doOutput = true
                http.setChunkedStreamingMode(64 * 1024)
                http.setRequestProperty("Accept", "application/json")
                http.setRequestProperty("Authorization", "Bearer ${connection.token}")
                http.setRequestProperty(
                    "Content-Type",
                    attachment.mimeType.takeIf(String::isNotBlank) ?: "application/octet-stream",
                )
                http.setRequestProperty("X-KodBot-Filename", Uri.encode(attachment.name))
                input.use { source ->
                    http.outputStream.use { target -> source.copyTo(target, 64 * 1024) }
                }
                val status = http.responseCode
                val stream = if (status in 200..299) http.inputStream else http.errorStream
                val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                if (status !in 200..299) {
                    val detail = runCatching { JSONObject(response).optString("error") }.getOrNull()
                    throw IOException(
                        detail?.takeIf(String::isNotBlank)
                            ?: "The computer couldn't accept ${attachment.name} (HTTP $status).",
                    )
                }
                val saved = JSONObject(response)
                UploadedFile(
                    path = saved.optString("path").takeIf(String::isNotBlank)
                        ?: throw IOException("The computer didn't return a path for ${attachment.name}."),
                    name = saved.optString("name", attachment.name),
                    size = saved.optLong("size", attachment.size),
                )
            } finally {
                input.close()
                http.disconnect()
            }
        }

    suspend fun createBot(): ConversationRecord = withContext(Dispatchers.IO) {
        val response = JSONObject(request("POST", "/api/bots", JSONObject()))
        response.getJSONObject("bot").toBotConversation()
            ?: throw IOException("The computer didn't return the new bot.")
    }

    suspend fun markRead(chat: ConversationRecord) = withContext(Dispatchers.IO) {
        val route = if (chat.kind == "group") "/api/groups" else "/api/bots"
        request("POST", "$route/${encodePath(chat.id)}/read")
    }

    suspend fun interrupt(chat: ConversationRecord) = withContext(Dispatchers.IO) {
        val botId = when (chat.kind) {
            "bot" -> chat.id
            "group" -> chat.busyBotId ?: throw IOException("This room isn't working right now.")
            else -> throw IllegalArgumentException("This conversation can't be interrupted.")
        }
        request("POST", "/api/bots/${encodePath(botId)}/interrupt")
    }

    suspend fun selectModel(botId: String, instanceId: String, model: String) = withContext(Dispatchers.IO) {
        request(
            "PATCH",
            "/api/bots/${encodePath(botId)}/model",
            JSONObject().put("instanceId", instanceId).put("model", model),
        )
    }

    /** Auto routing is a per-bot model pool. An empty pool keeps Auto inside
     * the bot's current engine; a populated one is explicit consent to route
     * across the listed models, and nothing else. */
    suspend fun setAutoModel(botId: String, autoModel: Boolean, pool: List<ModelSelectionRecord>) =
        withContext(Dispatchers.IO) {
            val entries = JSONArray()
            for (entry in pool.take(24)) {
                entries.put(JSONObject().put("instanceId", entry.instanceId).put("model", entry.model))
            }
            request(
                "PATCH",
                "/api/bots/${encodePath(botId)}/auto-model",
                JSONObject().put("autoModel", autoModel).put("autoModelPool", entries),
            )
        }

    suspend fun createTeam(name: String, creatorBotId: String) = withContext(Dispatchers.IO) {
        request(
            "POST",
            "/api/teams",
            JSONObject().put("name", name).put("creatorBotId", creatorBotId),
        )
    }

    suspend fun joinTeam(teamId: String, botId: String) = withContext(Dispatchers.IO) {
        request("POST", "/api/teams/${encodePath(teamId)}/members", JSONObject().put("botId", botId))
    }

    suspend fun leaveTeam(teamId: String, botId: String) = withContext(Dispatchers.IO) {
        request("DELETE", "/api/teams/${encodePath(teamId)}/members/${encodePath(botId)}")
    }

    suspend fun setTeamLeader(teamId: String, botId: String) = withContext(Dispatchers.IO) {
        request("PATCH", "/api/teams/${encodePath(teamId)}", JSONObject().put("leaderBotId", botId))
    }

    suspend fun respond(threadId: String, card: ApprovalCard, answer: String) = withContext(Dispatchers.IO) {
        val requestId = card.requestId ?: throw IllegalArgumentException("This request is no longer pending.")
        val behavior = if (card.permission) {
            if (answer.equals("deny", ignoreCase = true)) "deny" else "allow"
        } else {
            "answer"
        }
        val body = JSONObject()
            .put("requestId", requestId)
            .put("behavior", behavior)
        if (behavior == "answer") body.put("message", answer)
        request("POST", "/api/threads/${encodePath(threadId)}/respond", body)
    }

    fun openEvents(cursor: String?): HttpURLConnection {
        val query = buildString {
            append("?screens=off")
            if (!cursor.isNullOrBlank()) {
                append("&since=")
                append(URLEncoder.encode(cursor, Charsets.UTF_8.name()))
            }
        }
        val stream = URL(connection.baseUrl + "/api/events$query").openConnection() as HttpURLConnection
        stream.requestMethod = "GET"
        stream.connectTimeout = 10_000
        stream.readTimeout = 90_000 // Host keepalives arrive every 25 seconds; still detect dead links.
        stream.useCaches = false
        stream.setRequestProperty("Accept", "text/event-stream")
        stream.setRequestProperty("Authorization", "Bearer ${connection.token}")
        return stream
    }

    private fun request(method: String, path: String, body: JSONObject? = null): String {
        val url = URL(connection.baseUrl + path)
        val http = url.openConnection() as HttpURLConnection
        try {
            http.requestMethod = method
            http.connectTimeout = 10_000
            http.readTimeout = 20_000
            http.setRequestProperty("Accept", "application/json")
            http.setRequestProperty("Authorization", "Bearer ${connection.token}")
            if (body != null) {
                http.doOutput = true
                http.setRequestProperty("Content-Type", "application/json")
                http.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = http.responseCode
            val stream = if (status in 200..299) http.inputStream else http.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val detail = runCatching { JSONObject(response).optString("error") }.getOrNull()
                throw IOException(
                    detail?.takeIf(String::isNotBlank)?.let { "HTTP $status: $it" }
                        ?: "The computer returned HTTP $status.",
                )
            }
            return response
        } finally {
            http.disconnect()
        }
    }

    companion object {
        const val MAX_ATTACHMENT_BYTES = 30L * 1024 * 1024

        /** Sign in to a hosted gateway with email/password. The returned
         * connection stores the session token encrypted on the phone. */
        suspend fun login(
            address: String,
            email: String,
            password: String,
        ): CompanionConnection = withContext(Dispatchers.IO) {
            val baseUrl = CompanionAddress.normalizeGateway(address)
            val http = URL("$baseUrl/api/auth/token").openConnection() as HttpURLConnection
            try {
                http.requestMethod = "POST"
                http.connectTimeout = 10_000
                http.readTimeout = 20_000
                http.doOutput = true
                http.setRequestProperty("Accept", "application/json")
                http.setRequestProperty("Content-Type", "application/json")
                val body = JSONObject()
                    .put("email", email.trim())
                    .put("password", password)
                http.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val status = http.responseCode
                val stream = if (status in 200..299) http.inputStream else http.errorStream
                val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                if (status !in 200..299) {
                    val detail = runCatching { JSONObject(response).optString("error") }.getOrNull()
                    throw IOException(detail?.takeIf(String::isNotBlank) ?: "Sign-in failed with HTTP $status.")
                }
                val parsed = JSONObject(response)
                val token = parsed.getString("token")
                if (token.isBlank()) throw IOException("The server returned no session token.")
                val name = parsed.optJSONObject("user")?.optString("email")
                    ?.takeIf(String::isNotBlank) ?: "KodBot"
                CompanionConnection(
                    baseUrl = baseUrl,
                    serverName = name,
                    token = token,
                    kind = "session",
                )
            } finally {
                http.disconnect()
            }
        }

        suspend fun pair(
            address: String,
            code: String,
            deviceName: String,
            fallbackHosts: List<String> = emptyList(),
        ): CompanionConnection =
            withContext(Dispatchers.IO) {
                val baseUrl = runCatching { CompanionAddress.normalize(address) }
                    .getOrElse { CompanionAddress.normalizeGateway(address) }
                val port = URI(baseUrl).port
                val candidates = (listOf(baseUrl) + fallbackHosts.mapNotNull { host ->
                    runCatching {
                        if (host.contains("://")) CompanionAddress.normalizeGateway(host)
                        else CompanionAddress.normalize(host, port)
                    }.getOrNull()
                }).distinct()
                var lastTransportError: IOException? = null
                var reachable: String? = null
                for (candidate in candidates) {
                    try {
                        if (isKodBotHost(candidate)) {
                            reachable = candidate
                            break
                        }
                    } catch (error: IOException) {
                        lastTransportError = error
                    }
                }
                val selected = reachable
                    ?: throw lastTransportError
                    ?: IOException("Couldn't reach the Companion address. Check that the phone is on the same Wi-Fi or Tailscale network as the computer.")
                // Only redeem the one-time credential once. Probing candidate
                // hosts first avoids replaying a token if a pairing response
                // is lost after the desktop has already consumed it.
                pairAt(selected, code, deviceName)
            }

        private fun isKodBotHost(baseUrl: String): Boolean {
            val http = URL("$baseUrl/api/health").openConnection() as HttpURLConnection
            try {
                http.requestMethod = "GET"
                http.connectTimeout = 3_000
                http.readTimeout = 3_000
                http.useCaches = false
                if (http.responseCode != HttpURLConnection.HTTP_OK) return false
                val response = http.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                return JSONObject(response).optString("app") == "kodbot"
            } finally {
                http.disconnect()
            }
        }

        private fun pairAt(baseUrl: String, code: String, deviceName: String): CompanionConnection {
            val http = URL("$baseUrl/api/pair").openConnection() as HttpURLConnection
            try {
                http.requestMethod = "POST"
                http.connectTimeout = 10_000
                http.readTimeout = 20_000
                http.doOutput = true
                http.setRequestProperty("Accept", "application/json")
                http.setRequestProperty("Content-Type", "application/json")
                val credential = code.trim()
                val field = if (credential.length == 6 && credential.all(Char::isDigit)) "code" else "credential"
                val body = JSONObject()
                    .put(field, credential)
                    .put("deviceName", android.os.Build.MODEL.ifBlank { deviceName })
                http.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val status = http.responseCode
                val stream = if (status in 200..299) http.inputStream else http.errorStream
                val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                if (status !in 200..299) {
                    val detail = runCatching { JSONObject(response).optString("error") }.getOrNull()
                    throw IOException(
                        detail?.takeIf(String::isNotBlank) ?: "Pairing failed with HTTP $status.",
                    )
                }
                val paired = JSONObject(response)
                return CompanionConnection(
                    baseUrl = baseUrl,
                    serverName = paired.optString("serverName").ifBlank { baseUrl },
                    token = paired.getString("token"),
                )
            } finally {
                http.disconnect()
            }
        }

        fun notification(frame: JSONObject): AgentNotification? {
            if (frame.optString("kind") != "notify") return null
            val payload = frame.optJSONObject("notification") ?: return null
            return AgentNotification(
                kind = payload.optString("kind"),
                botId = payload.optString("botId"),
                botName = payload.optString("botName", "KodBot"),
                threadId = payload.optString("threadId"),
                title = payload.optString("title", "KodBot update"),
                body = payload.optString("body"),
            )
        }

        private fun encodePath(value: String): String = Uri.encode(value)

        private data class TeamInfo(val id: String, val name: String, val leaderBotId: String)

        private fun JSONObject.toBotConversation(team: TeamInfo? = null): ConversationRecord? {
            val messages = optJSONArray("messages") ?: JSONArray()
            val selection = optJSONObject("modelSelection")?.let {
                ModelSelectionRecord(
                    instanceId = it.optString("instanceId"),
                    model = it.optString("model"),
                    effort = it.optString("effort").takeIf(String::isNotBlank),
                )
            }
            return ConversationRecord(
                id = optString("id"),
                threadId = optString("threadId"),
                name = optString("name", "Bot"),
                kind = "bot",
                busy = optBoolean("busy"),
                unread = optBoolean("unread"),
                hidden = optBoolean("hidden"),
                memberCount = 0,
                modelSelection = selection,
                messages = (0 until messages.length()).mapNotNull { messages.optJSONObject(it)?.toMessage() },
                color = optString("color", "green"),
                role = optString("role").takeIf(String::isNotBlank),
                mascotShape = optString("mascotShape").takeIf(String::isNotBlank),
                teamId = team?.id,
                teamName = team?.name,
                teamIsLeader = team?.leaderBotId == optString("id"),
                autoModel = optBoolean("autoModel"),
                autoModelPool = optJSONArray("autoModelPool")?.let { pool ->
                    (0 until pool.length()).mapNotNull { index ->
                        pool.optJSONObject(index)?.let { entry ->
                            val instanceId = entry.optString("instanceId")
                            val model = entry.optString("model")
                            if (instanceId.isBlank() || model.isBlank()) null
                            else ModelSelectionRecord(instanceId, model, null)
                        }
                    }
                }.orEmpty(),
            )
        }

        private fun JSONObject.toGroupConversation(): ConversationRecord {
            val messages = optJSONArray("messages") ?: JSONArray()
            val members = optJSONArray("memberIds") ?: JSONArray()
            // `optString` turns a JSON null into the literal "null"; read the
            // raw value so an idle room is never mistaken for a working one.
            val busyBotId = (opt("busyBotId") as? String)?.takeIf(String::isNotBlank)
            return ConversationRecord(
                id = optString("id"),
                threadId = optString("threadId"),
                name = optString("name", "Group"),
                kind = "group",
                busy = busyBotId != null,
                unread = optBoolean("unread"),
                hidden = false,
                memberCount = members.length(),
                modelSelection = null,
                messages = (0 until messages.length()).mapNotNull { messages.optJSONObject(it)?.toMessage() },
                busyBotId = busyBotId,
            )
        }

        private fun JSONObject.toEngine(): EngineRecord {
            val snapshot = optJSONObject("snapshot") ?: JSONObject()
            val catalog = optJSONObject("models") ?: JSONObject()
            val options = catalog.optJSONArray("options") ?: JSONArray()
            return EngineRecord(
                instanceId = optString("instanceId"),
                displayName = optString("displayName", optString("driverKind", "Engine")),
                driverKind = optString("driverKind"),
                state = snapshot.optString("state", "unavailable"),
                reason = snapshot.optString("reason").takeIf(String::isNotBlank),
                authenticated = if (snapshot.has("authenticated") && !snapshot.isNull("authenticated")) {
                    snapshot.optBoolean("authenticated")
                } else null,
                defaultModel = catalog.optString("default"),
                models = (0 until options.length()).mapNotNull { index ->
                    options.optJSONObject(index)?.let { option ->
                        ModelOptionRecord(
                            id = option.optString("id"),
                            label = option.optString("label", option.optString("id")),
                            custom = option.optBoolean("custom"),
                            free = option.optBoolean("free"),
                            group = option.optString("group").takeIf(String::isNotBlank),
                        )
                    }
                },
            )
        }

        private fun JSONObject.toMessage(): TranscriptMessage {
            val cardJson = optJSONObject("card")
            val toolJson = optJSONObject("tool")
            val senderJson = optJSONObject("from")
            val card = cardJson?.let {
                val optionsJson = it.optJSONArray("options") ?: JSONArray()
                ApprovalCard(
                    title = it.optString("title"),
                    subtitle = it.optString("subtitle"),
                    options = (0 until optionsJson.length()).mapNotNull { index -> optionsJson.optString(index).takeIf(String::isNotBlank) },
                    requestId = it.optString("requestId").takeIf(String::isNotBlank),
                    tool = it.optString("tool").takeIf(String::isNotBlank),
                    explanation = it.optString("explanation").takeIf(String::isNotBlank),
                    overdueAt = it.optLong("overdueAt", 0L).takeIf { value -> value > 0L },
                    answered = it.optString("answered").takeIf(String::isNotBlank),
                    dismissed = it.optBoolean("dismissed"),
                )
            }
            return TranscriptMessage(
                id = optString("id"),
                role = optString("role", "bot"),
                kind = optString("kind", "unknown"),
                text = optString("text"),
                toolName = toolJson?.optString("name").orEmpty(),
                senderName = senderJson?.optString("name")?.takeIf(String::isNotBlank),
                card = card,
            )
        }
    }
}
