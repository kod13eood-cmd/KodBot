package com.opencrew.companion

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject

/** In-process bridge from the foreground stream service to the visible UI. */
object CompanionSignals {
    // Streaming turns can emit bursts of message patches. Keep enough slack
    // that the frame which settles a turn cannot be squeezed out by a burst
    // the main thread has not drained yet.
    private val mutableFrames = MutableSharedFlow<JSONObject>(extraBufferCapacity = 256)
    val frames = mutableFrames.asSharedFlow()

    fun publish(frame: JSONObject) {
        mutableFrames.tryEmit(frame)
    }
}
