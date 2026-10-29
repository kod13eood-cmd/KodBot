package com.opencrew.companion

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The same cursor-mascot portrait the desktop app draws for each bot color. */
@Composable
fun BotAvatar(
    color: String,
    name: String,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(avatarResource(color)),
        contentDescription = name,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
    )
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
