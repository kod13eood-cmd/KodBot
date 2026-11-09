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
