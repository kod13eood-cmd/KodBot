package com.kodbot.companion

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
        assertEquals("http://kodbot.tail1234.ts.net:8810", CompanionAddress.normalize("kodbot.tail1234.ts.net:8810"))
        assertEquals("http://kodbot.local:8811", CompanionAddress.normalize("http://kodbot.local:8811/"))
        assertEquals("http://[2001:db8::2]:8810", CompanionAddress.normalize("2001:db8::2"))
    }

    @Test
    fun addressRejectsOtherSchemesAndPaths() {
        assertThrows(IllegalArgumentException::class.java) { CompanionAddress.normalize("https://kodbot.local") }
        assertThrows(IllegalArgumentException::class.java) { CompanionAddress.normalize("kodbot.local/api") }
    }

    @Test
    fun gatewayAddressKeepsHttpsAndUsesTheSchemeDefaultPort() {
        assertEquals("https://kodbot.example.com:443", CompanionAddress.normalizeGateway("https://kodbot.example.com"))
        assertEquals("https://kodbot.example.com:8780", CompanionAddress.normalizeGateway("kodbot.example.com:8780"))
        assertEquals("http://127.0.0.1:8780", CompanionAddress.normalizeGateway("http://127.0.0.1:8780/"))
        assertThrows(IllegalArgumentException::class.java) { CompanionAddress.normalizeGateway("ftp://kodbot.example.com") }
    }

    @Test
    fun desktopQrDeepLinkOpensAConfirmedPairingInvite() {
        val token = "omb_pair_${"a".repeat(43)}"
        val invite = PairingInvite.parse(
            "kodbot://pair?address=linux.tail1234.ts.net%3A8810" +
                "&token=$token&code=004209&name=KodBot%20Linux" +
                "&hosts=linux.tail1234.ts.net%2C192.168.1.42",
        )

        assertEquals("http://linux.tail1234.ts.net:8810", invite?.address)
        assertEquals(token, invite?.credential)
        assertEquals("KodBot Linux", invite?.computerName)
        assertEquals(listOf("linux.tail1234.ts.net", "192.168.1.42"), invite?.hosts)
    }

    @Test
    fun hostedQrAcceptsAnHttpsGatewayAddress() {
        val token = "omb_pair_${"b".repeat(43)}"
        val invite = PairingInvite.parse(
            "kodbot://pair?address=https%3A%2F%2Fgateway.example.com" +
                "&token=$token&name=KodBot&hosts=https%3A%2F%2Fgateway.example.com",
        )
        assertEquals("https://gateway.example.com:443", invite?.address)
        assertEquals(listOf("https://gateway.example.com"), invite?.hosts)
    }

    @Test
    fun malformedOrAmbiguousPairingLinksAreRejected() {
        assertNull(PairingInvite.parse("https://example.test/pair?address=linux&code=123456"))
        assertNull(PairingInvite.parse("kodbot://pair?address=linux&code=123456&code=654321"))
        assertNull(PairingInvite.parse("kodbot://pair?address=linux&token=bad&code=123456"))
    }

    @Test
    fun attachmentsUseTheSameTaggedBlockAsTheDesktopComposer() {
        val composed = composeMessage(
            "  look at this  ",
            listOf(
                UploadedFile("/home/me/Report & Notes.pdf", "Report & Notes.pdf", 12),
                UploadedFile("/home/me/plain.png", "plain.png", 3),
            ),
        )

        assertEquals(
            "look at this\n\n" +
                "<attached-file path=\"/home/me/Report &amp; Notes.pdf\" />\n\n" +
                "<attached-file path=\"/home/me/plain.png\" />",
            composed,
        )
    }

    @Test
    fun anAttachmentCanStandWithoutAnyTypedText() {
        assertEquals(
            "<attached-file path=\"/tmp/a.txt\" />",
            composeMessage("   ", listOf(UploadedFile("/tmp/a.txt", "a.txt", 1))),
        )
    }
}
