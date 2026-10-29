package com.opencrew.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class CompanionProtocolTest {
    @Test
    fun sseParserJoinsDataAndIgnoresKeepalives() {
        val parser = SseParser()
        assertNull(parser.line("id: stream-1:8"))
        assertNull(parser.line(": keepalive"))
        assertNull(parser.line("data: {\"kind\":"))
        assertNull(parser.line("data: \"message\"}"))

        assertEquals(SseMessage("stream-1:8", "{\"kind\":\n\"message\"}"), parser.line(""))
    }

    @Test
    fun blankEventDoesNotLeakItsIdToTheNextEvent() {
        val parser = SseParser()
        parser.line("id: stream-1:9")
        parser.line("data: first")
        assertEquals(SseMessage("stream-1:9", "first"), parser.line(""))
        parser.line("data: second")
        assertEquals(SseMessage(null, "second"), parser.line(""))
    }

    @Test
    fun addressDefaultsToCompanionPortAndPreservesAnExplicitPort() {
        assertEquals("http://192.168.1.42:8810", CompanionAddress.normalize("192.168.1.42"))
        assertEquals("http://192.168.1.42:8811", CompanionAddress.normalize("192.168.1.42", 8811))
        assertEquals("http://opencrew.tail1234.ts.net:8810", CompanionAddress.normalize("opencrew.tail1234.ts.net:8810"))
        assertEquals("http://opencrew.local:8811", CompanionAddress.normalize("http://opencrew.local:8811/"))
        assertEquals("http://[2001:db8::2]:8810", CompanionAddress.normalize("2001:db8::2"))
    }

    @Test
    fun addressRejectsOtherSchemesAndPaths() {
        assertThrows(IllegalArgumentException::class.java) { CompanionAddress.normalize("https://opencrew.local") }
        assertThrows(IllegalArgumentException::class.java) { CompanionAddress.normalize("opencrew.local/api") }
    }

    @Test
    fun desktopQrDeepLinkOpensAConfirmedPairingInvite() {
        val token = "omb_pair_${"a".repeat(43)}"
        val invite = PairingInvite.parse(
            "opencrew://pair?address=linux.tail1234.ts.net%3A8810" +
                "&token=$token&code=004209&name=KodBot%20Linux" +
                "&hosts=linux.tail1234.ts.net%2C192.168.1.42",
        )

        assertEquals("http://linux.tail1234.ts.net:8810", invite?.address)
        assertEquals(token, invite?.credential)
        assertEquals("KodBot Linux", invite?.computerName)
        assertEquals(listOf("linux.tail1234.ts.net", "192.168.1.42"), invite?.hosts)
    }

    @Test
    fun malformedOrAmbiguousPairingLinksAreRejected() {
        assertNull(PairingInvite.parse("https://example.test/pair?address=linux&code=123456"))
        assertNull(PairingInvite.parse("opencrew://pair?address=linux&code=123456&code=654321"))
        assertNull(PairingInvite.parse("opencrew://pair?address=linux&token=bad&code=123456"))
    }
}
