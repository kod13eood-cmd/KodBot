package com.kodbot.companion

import java.net.URI
import java.net.URLEncoder

/** Helpers for the optional WebView "desktop mode". The native service keeps
 * owning notifications; this only decides which URL the web UI should load
 * and whether the native session can be handed to the gateway as a cookie. */
object DesktopMode {
    private const val COMPANION_PORT = 8810
    private const val HARNESS_PORT = 8799
    private const val SESSION_COOKIE = "kodbot_session"

    /** A notification click handed to the WebView. `nonce` lets the page
     * acknowledge that its listener received the event; without it the shell
     * falls back to a URL deep link. */
    data class DesktopTarget(
        val botId: String?,
        val threadId: String?,
        val nonce: Long,
    ) {
        val hasTarget: Boolean get() = !botId.isNullOrBlank() || !threadId.isNullOrBlank()
    }

    /** Append the notification's bot/thread as query parameters. Used when
     * the WebView may still be loading and has no event listener yet. */
    fun deepLinkUrl(baseUrl: String, botId: String?, threadId: String?): String {
        val params = mutableListOf<String>()
        botId?.takeIf(String::isNotBlank)?.let {
            params += "bot=" + URLEncoder.encode(it, Charsets.UTF_8.name())
        }
        threadId?.takeIf(String::isNotBlank)?.let {
            params += "thread=" + URLEncoder.encode(it, Charsets.UTF_8.name())
        }
        if (params.isEmpty()) return baseUrl

        val base = baseUrl.trim()
        val hashAt = base.indexOf('#')
        val head = if (hashAt >= 0) base.substring(0, hashAt) else base
        val tail = if (hashAt >= 0) base.substring(hashAt) else ""
        val separator = if (head.contains('?')) "&" else "?"
        return head + separator + params.joinToString("&") + tail
    }

    /** Dispatch the same custom event the Electron bridge triggers. The
     * return value is 1 only when the page's listener acknowledged delivery,
     * so a cold WebView can be retried with [deepLinkUrl]. */
    fun openTargetScript(target: DesktopTarget): String {
        val fields = mutableListOf<String>()
        target.botId?.takeIf(String::isNotBlank)?.let { fields += "\"botId\":" + jsString(it) }
        target.threadId?.takeIf(String::isNotBlank)?.let { fields += "\"threadId\":" + jsString(it) }
        fields += "\"nonce\":" + target.nonce
        return "(function(){var d={" + fields.joinToString(",") + "};" +
            "window.dispatchEvent(new CustomEvent('kodbot:open',{detail:d}));" +
            "return window.__kodbotOpenAck===d.nonce?1:0;})()"
    }

    private fun jsString(value: String): String = buildString {
        append('"')
        for (ch in value) {
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                '\u2028' -> append("\\u2028")
                '\u2029' -> append("\\u2029")
                else -> if (ch.code < 0x20) append("\\u%04x".format(ch.code)) else append(ch)
            }
        }
        append('"')
    }

    /** Device pairing talks to the companion; the web UI lives on the
     * harness. Hosted/session connections already point at the gateway. */
    fun webUrl(baseUrl: String, kind: String): String {
        val value = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(value) }.getOrNull() ?: return value
        if (kind != "session" && (uri.port == COMPANION_PORT || uri.port == -1)) {
            return runCatching {
                URI(
                    uri.scheme ?: "http",
                    null,
                    uri.host,
                    HARNESS_PORT,
                    null,
                    null,
                    null,
                ).toString()
            }.getOrDefault(value)
        }
        return value
    }

    /** A gateway session token is accepted as a cookie by the same gateway.
     * Device tokens and hosted QR-only pairings do not get a cookie; those
     * connections show the normal gateway login once in the WebView. */
    fun sessionCookie(baseUrl: String, token: String, kind: String): String? {
        if (kind != "session" || token.isBlank()) return null
        val secure = baseUrl.startsWith("https://", ignoreCase = true)
        val value = URLEncoder.encode(token, Charsets.UTF_8.name())
        return buildString {
            append(SESSION_COOKIE).append('=').append(value)
            append("; Path=/; HttpOnly; SameSite=Strict")
            if (secure) append("; Secure")
        }
    }

    /** External links must leave the WebView; same-origin navigation stays
     * inside it. Missing ports are normalised so localhost:80 style URLs do
     * not open a browser by accident. */
    fun isSameOrigin(first: String, second: String): Boolean {
        val a = runCatching { URI(first) }.getOrNull() ?: return false
        val b = runCatching { URI(second) }.getOrNull() ?: return false
        return a.scheme.equals(b.scheme, ignoreCase = true) &&
            a.host.equals(b.host, ignoreCase = true) &&
            effectivePort(a) == effectivePort(b)
    }

    private fun effectivePort(uri: URI): Int = when {
        uri.port > 0 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
