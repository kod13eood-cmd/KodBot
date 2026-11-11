package com.kodbot.companion

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.ServerSocket
import kotlin.concurrent.thread

class VoiceTranscribeTest {
    private data class CapturedRequest(
        val requestLine: String,
        val headers: Map<String, String>,
        val body: ByteArray,
    )

    /** A one-shot HTTP/1.1 server. Android's unit-test classpath does not
     * include com.sun.net.httpserver, so the test speaks just enough HTTP
     * to observe the headers and body the phone would send. */
    private fun serveOnce(
        status: Int,
        response: String,
        onRequest: (CapturedRequest) -> Unit,
    ): Pair<ServerSocket, Thread> {
        val server = ServerSocket(0)
        val worker = thread(start = true) {
            server.accept().use { socket ->
                val input = BufferedInputStream(socket.getInputStream())
                val head = readHead(input)
                val lines = head.split("\r\n")
                val requestLine = lines.firstOrNull().orEmpty()
                val headers = lines.drop(1).mapNotNull { line ->
                    val colon = line.indexOf(':')
                    if (colon <= 0) null
                    else line.substring(0, colon).trim().lowercase() to line.substring(colon + 1).trim()
                }.toMap()
                val length = headers["content-length"]?.toIntOrNull() ?: 0
                onRequest(CapturedRequest(requestLine, headers, input.readExactly(length)))
                val payload = response.toByteArray(Charsets.UTF_8)
                val reason = if (status in 200..299) "OK" else "Conflict"
                val reply = "HTTP/1.1 $status $reason\r\n" +
                    "Content-Type: application/json\r\n" +
                    "Content-Length: ${payload.size}\r\n" +
                    "Connection: close\r\n\r\n"
                socket.getOutputStream().use { output ->
                    output.write(reply.toByteArray(Charsets.US_ASCII))
                    output.write(payload)
                    output.flush()
                }
            }
        }
        return server to worker
    }

    private fun readHead(input: InputStream): String {
        val bytes = ByteArrayOutputStream()
        while (!bytes.toString(Charsets.ISO_8859_1.name()).endsWith("\r\n\r\n")) {
            val next = input.read()
            if (next < 0) break
            bytes.write(next)
        }
        return bytes.toString(Charsets.ISO_8859_1.name())
    }

    private fun InputStream.readExactly(length: Int): ByteArray {
        val bytes = ByteArray(length)
        var offset = 0
        while (offset < length) {
            val read = read(bytes, offset, length - offset)
            if (read < 0) break
            offset += read
        }
        return if (offset == length) bytes else bytes.copyOf(offset)
    }

    private fun api(port: Int) = CompanionApi(
        CompanionConnection(
            baseUrl = "http://127.0.0.1:$port",
            serverName = "test",
            token = "device-token",
        ),
    )

    @Test
    fun `push-to-talk uploads AAC audio to the local voice endpoint`() = runBlocking {
        var captured: CapturedRequest? = null
        val (server, worker) = serveOnce(200, """{"text":"  Отвори настройките.  "}""") {
            captured = it
        }
        val file = File.createTempFile("kodbot-voice-test-", ".m4a").apply {
            writeBytes(byteArrayOf(1, 2, 3, 4))
        }
        try {
            val text = api(server.localPort).transcribe(file)
            worker.join(5_000)
            assertEquals("Отвори настройките.", text)
            val request = captured ?: error("the server received no request")
            assertEquals("POST /api/voice/transcribe?language=auto HTTP/1.1", request.requestLine)
            assertEquals("Bearer device-token", request.headers["authorization"])
            assertEquals("audio/mp4", request.headers["content-type"])
            assertArrayEquals(byteArrayOf(1, 2, 3, 4), request.body)
        } finally {
            file.delete()
            server.close()
        }
    }

    @Test
    fun `a refused transcription surfaces the harness message`() = runBlocking {
        var captured: CapturedRequest? = null
        val (server, worker) = serveOnce(
            409,
            """{"error":"Local speech-to-text is not installed on the harness."}""",
        ) {
            captured = it
        }
        val file = File.createTempFile("kodbot-voice-test-", ".m4a").apply {
            writeBytes(byteArrayOf(9))
        }
        try {
            val error = runCatching { api(server.localPort).transcribe(file) }.exceptionOrNull()
            worker.join(5_000)
            assertTrue(error is java.io.IOException)
            assertTrue(error?.message?.contains("not installed") == true)
            assertTrue(captured != null)
        } finally {
            file.delete()
            server.close()
        }
    }
}
