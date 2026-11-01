package com.kodbot.companion

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The same cursor-mascot portrait the desktop app draws for each bot color,
 * with the job badge chosen in the bot's appearance settings. */
@Composable
fun BotAvatar(
    color: String,
    name: String,
    size: Dp,
    role: String? = null,
    modifier: Modifier = Modifier,
) {
    val glyph = roleGlyph(role)
    Box(modifier = modifier.size(size), contentAlignment = Alignment.BottomEnd) {
        Image(
            painter = painterResource(avatarResource(color)),
            contentDescription = name,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
        )
        if (glyph != null) {
            val badge = (size.value * 0.40f).dp
            Surface(
                modifier = Modifier.size(badge),
                shape = CircleShape,
                color = Color(0xFF202622),
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(glyph, fontSize = (size.value * 0.22f).sp)
                }
            }
        }
    }
}

/** Small, dependency-free job glyphs. Android renders these as emoji; the
 * desktop uses vector icons for the same roles. */
private fun roleGlyph(role: String?): String? = when (role) {
    "coordinator" -> "🧭"
    "researcher" -> "🔬"
    "builder" -> "🛠"
    "designer" -> "🎨"
    "writer" -> "✍"
    "operator" -> "🛰"
    "analyst" -> "📊"
    "guide" -> "💬"
    else -> null
}

private fun avatarResource(color: String): Int = when (color) {
    "blue" -> R.drawable.bot_avatar_blue
    "red" -> R.drawable.bot_avatar_red
    "orange" -> R.drawable.bot_avatar_orange
    "purple" -> R.drawable.bot_avatar_purple
    "cyan" -> R.drawable.bot_avatar_cyan
    "pink" -> R.drawable.bot_avatar_pink
    "yellow" -> R.drawable.bot_avatar_yellow
    "teal" -> R.drawable.bot_avatar_teal
    "coral" -> R.drawable.bot_avatar_coral
    else -> R.drawable.bot_avatar_green
}
