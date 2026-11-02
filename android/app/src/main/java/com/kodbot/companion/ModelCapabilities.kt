package com.kodbot.companion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The same conservative hints the desktop picker shows: every catalog entry
 * is text, and a known family name adds the rest. This is a UI label, not a
 * provider contract. */
data class ModelCapability(val key: String, val label: String, val glyph: String)

private val VISION = Regex("vision|multimodal|(?:^|[-_/ ])(?:vl|omni)(?:$|[-_/ .])|\\bclaude\\b|\\bgpt-[45]\\b|\\bgpt-4o\\b|\\bgemini\\b|\\bgrok\\b|nemotron.*vl", RegexOption.IGNORE_CASE)
private val AUDIO = Regex("audio|realtime|voice|speech|whisper|\\btts\\b|omni|gemini.*live", RegexOption.IGNORE_CASE)
private val IMAGE = Regex("image|imagine|dall-?e|flux|diffusion|sdxl|midjourney|ideogram|recraft|seedream", RegexOption.IGNORE_CASE)
private val VIDEO = Regex("video|sora|\\bveo\\b|kling|runway|heygen|pika|luma", RegexOption.IGNORE_CASE)
private val REASONING = Regex("thinking|reason|deepseek.*r1|(?:^|[-_/ ])o[134](?:$|[-_/ .])|gpt-5.*(?:pro|thinking)", RegexOption.IGNORE_CASE)

fun modelCapabilities(option: ModelOptionRecord): List<ModelCapability> {
    val name = "${option.id} ${option.label} ${option.group.orEmpty()}"
    val found = linkedSetOf("text")
    if (VISION.containsMatchIn(name)) found += "vision"
    if (AUDIO.containsMatchIn(name)) found += "audio"
    if (IMAGE.containsMatchIn(name)) found += "image"
    if (VIDEO.containsMatchIn(name)) found += "video"
    if (REASONING.containsMatchIn(name)) found += "reasoning"
    return found.mapNotNull { key ->
        when (key) {
            "text" -> ModelCapability(key, "Text", "T")
            "vision" -> ModelCapability(key, "Vision", "👁")
            "audio" -> ModelCapability(key, "Audio", "🔊")
            "image" -> ModelCapability(key, "Image generation", "🖼")
            "video" -> ModelCapability(key, "Video generation", "🎬")
            "reasoning" -> ModelCapability(key, "Reasoning", "🧠")
            else -> null
        }
    }
}

@Composable
fun ModelCapabilityBadges(option: ModelOptionRecord, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (capability in modelCapabilities(option)) {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.semantics { contentDescription = capability.label },
            ) {
                Text(
                    capability.glyph,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** The phone should say "OpenCode Zen" and "OpenCode Go" as separate
 * providers even when the harness names both "OpenCode". */
fun engineLabel(engine: EngineRecord): String = when (engine.driverKind) {
    "opencode" -> "OpenCode Zen"
    "opencodeGo" -> "OpenCode Go"
    else -> engine.displayName
}
