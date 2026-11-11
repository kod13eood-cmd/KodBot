package com.kodbot.companion

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/** Hold-to-talk capture for the native composer.
 *
 * The native chat cannot use the browser `MediaRecorder`: the remote harness
 * is usually plain HTTP on a LAN, and Chromium hides `getUserMedia` outside a
 * secure context. Recording locally and uploading the clip to the harness's
 * existing `/api/voice/transcribe` endpoint keeps the same local Whisper
 * pipeline without exposing the mic to the WebView. */
class VoiceRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var output: File? = null

    fun start(): File {
        check(recorder == null) { "A recording is already running." }
        val file = File.createTempFile("kodbot-voice-", ".m4a", context.cacheDir)
        val media = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        try {
            media.setAudioSource(MediaRecorder.AudioSource.MIC)
            media.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            media.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            media.setAudioSamplingRate(44_100)
            media.setAudioEncodingBitRate(64_000)
            media.setOutputFile(file.absolutePath)
            media.prepare()
            media.start()
        } catch (error: Exception) {
            media.release()
            file.delete()
            throw error
        }
        recorder = media
        output = file
        return file
    }

    /** Stop and return the captured file. Null means the recorder produced no
     * usable audio (for example, the press was too short). */
    fun stop(): File? {
        val media = recorder ?: return null
        recorder = null
        val file = output
        output = null
        try {
            media.stop()
        } catch (_: RuntimeException) {
            file?.delete()
            return null
        } finally {
            media.release()
        }
        return file?.takeIf { it.length() > 0 }
    }

    fun cancel() {
        val media = recorder
        recorder = null
        if (media != null) {
            try {
                media.stop()
            } catch (_: RuntimeException) {
                // No frames were written; release below is all that matters.
            }
            media.release()
        }
        output?.delete()
        output = null
    }
}
