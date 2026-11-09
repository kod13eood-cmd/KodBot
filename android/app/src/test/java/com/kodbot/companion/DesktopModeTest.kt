package com.kodbot.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DesktopModeTest {
    @Test
    fun `local device pairing opens the harness web UI`() {
        assertEquals(
            "http://192.168.1.42:8799",
            DesktopMode.webUrl("http://192.168.1.42:8810", "device"),
        )
        assertEquals(
            "https://box.example.ts.net:8799",
            DesktopMode.webUrl("https://box.example.ts.net:8810", "device"),
        )
    }

    @Test
    fun `hosted sessions stay on the gateway`() {
        assertEquals(
            "https://kodbot.example.com",
            DesktopMode.webUrl("https://kodbot.example.com/", "session"),
        )
    }

    @Test
    fun `device pairings on a gateway keep the login URL`() {
        assertEquals(
            "http://kodbot.example.com:8780",
            DesktopMode.webUrl("http://kodbot.example.com:8780", "device"),
        )
    }

    @Test
    fun `only a session produces a cookie`() {
        val cookie = DesktopMode.sessionCookie("https://kodbot.example.com", "sess_abc", "session")
        assertTrue(cookie!!.contains("kodbot_session=sess_abc"))
        assertTrue(cookie.contains("HttpOnly"))
        assertTrue(cookie.contains("Secure"))
        assertNull(DesktopMode.sessionCookie("https://kodbot.example.com", "dev_abc", "device"))
    }

    @Test
    fun `notification deep links preserve existing query parameters`() {
        assertEquals(
            "http://host:8799?bot=bot-1&thread=task-1",
            DesktopMode.deepLinkUrl("http://host:8799", "bot-1", "task-1"),
        )
        assertEquals(
            "https://host/ui?login=1&thread=task-1",
            DesktopMode.deepLinkUrl("https://host/ui?login=1", null, "task-1"),
        )
        assertEquals(
            "https://host/ui?login=1&bot=bot-1#top",
            DesktopMode.deepLinkUrl("https://host/ui?login=1#top", "bot-1", null),
        )
        assertEquals("https://host", DesktopMode.deepLinkUrl("https://host", null, null))
    }

    @Test
    fun `notification event carries escaped ids and an acknowledgement nonce`() {
        val script = DesktopMode.openTargetScript(
            DesktopMode.DesktopTarget("bot\"1", "task\n2", 42),
        )
        assertTrue(script.contains("\"botId\":\"bot\\\"1\""))
        assertTrue(script.contains("\"threadId\":\"task\\n2\""))
        assertTrue(script.contains("\"nonce\":42"))
        assertTrue(script.contains("__kodbotOpenAck"))
        assertTrue(script.contains("CustomEvent('kodbot:open'"))
    }

    @Test
    fun `same-origin checks include the effective port`() {
        assertTrue(DesktopMode.isSameOrigin("https://example.com/a", "https://example.com:443/b"))
        assertTrue(DesktopMode.isSameOrigin("http://127.0.0.1:8799", "http://127.0.0.1:8799/x"))
        assertFalse(DesktopMode.isSameOrigin("http://example.com:8799", "https://example.com:8799"))
        assertFalse(DesktopMode.isSameOrigin("http://example.com:8799", "http://example.com:8800"))
    }
}
