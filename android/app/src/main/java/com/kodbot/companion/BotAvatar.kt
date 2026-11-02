package com.kodbot.companion

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** A small vector mascot. The desktop app has ten silhouettes; the phone
 * draws the same set instead of shipping ten static PNGs. */
@Composable
fun BotAvatar(
    color: String,
    name: String,
    size: Dp,
    role: String? = null,
    shape: String? = null,
    modifier: Modifier = Modifier,
) {
    val glyph = roleGlyph(role)
    Box(modifier = modifier.size(size), contentAlignment = Alignment.BottomEnd) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .semantics { contentDescription = name },
        ) {
            val body = shapePath(normalizeShape(shape, role, color), this.size.width, this.size.height)
            val base = crewColor(color)
            drawPath(
                body,
                brush = Brush.verticalGradient(
                    colors = listOf(lighten(base, 0.42f), base, darken(base, 0.28f)),
                    startY = 0f,
                    endY = this.size.height,
                ),
            )
            drawFace(base)
        }
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

private fun DrawScope.drawFace(body: Color) {
    val unit = minOf(size.width, size.height)
    val left = (size.width - unit) / 2f
    val top = (size.height - unit) / 2f
    val eyeY = top + unit * 0.44f
    val eyeRadius = unit * 0.052f
    val dark = darken(body, 0.55f)
    for (x in listOf(0.38f, 0.62f)) {
        drawOval(
            color = Color.White,
            topLeft = Offset(left + unit * x - eyeRadius, eyeY - eyeRadius * 1.12f),
            size = Size(eyeRadius * 2f, eyeRadius * 2.24f),
        )
        drawCircle(
            color = dark,
            radius = eyeRadius * 0.48f,
            center = Offset(left + unit * x, eyeY),
        )
    }
    val mouth = Path().apply {
        moveTo(left + unit * 0.44f, top + unit * 0.62f)
        quadraticTo(
            left + unit * 0.50f,
            top + unit * 0.67f,
            left + unit * 0.56f,
            top + unit * 0.62f,
        )
    }
    drawPath(mouth, color = Color.White.copy(alpha = 0.92f), style = Stroke(width = unit * 0.035f))
}

private fun shapePath(shape: String, width: Float, height: Float): Path {
    val unit = minOf(width, height)
    val left = (width - unit) / 2f
    val top = (height - unit) / 2f
    fun x(value: Float) = left + unit * value
    fun y(value: Float) = top + unit * value
    return Path().apply {
        when (shape) {
            "orb" -> addOval(Rect(x(0.04f), y(0.04f), x(0.96f), y(0.96f)))
            "bubble" -> addRoundRect(RoundRect(Rect(x(0.07f), y(0.07f), x(0.93f), y(0.93f)), unit * 0.24f, unit * 0.24f))
            "pill" -> addRoundRect(RoundRect(Rect(x(0.03f), y(0.20f), x(0.97f), y(0.80f)), unit * 0.30f, unit * 0.30f))
            "hex" -> {
                moveTo(x(0.50f), y(0.04f)); lineTo(x(0.90f), y(0.27f)); lineTo(x(0.90f), y(0.73f))
                lineTo(x(0.50f), y(0.96f)); lineTo(x(0.10f), y(0.73f)); lineTo(x(0.10f), y(0.27f)); close()
            }
            "diamond" -> {
                moveTo(x(0.50f), y(0.03f)); lineTo(x(0.97f), y(0.50f)); lineTo(x(0.50f), y(0.97f))
                lineTo(x(0.03f), y(0.50f)); close()
            }
            "star" -> {
                val outer = unit * 0.47f
                val inner = unit * 0.21f
                repeat(10) { index ->
                    val angle = -PI / 2 + index * PI / 5
                    val radius = if (index % 2 == 0) outer else inner
                    val px = x(0.50f) + (cos(angle) * radius).toFloat()
                    val py = y(0.50f) + (sin(angle) * radius).toFloat()
                    if (index == 0) moveTo(px, py) else lineTo(px, py)
                }
                close()
            }
            "drop" -> {
                moveTo(x(0.50f), y(0.04f))
                cubicTo(x(0.72f), y(0.30f), x(0.90f), y(0.47f), x(0.90f), y(0.68f))
                cubicTo(x(0.90f), y(0.87f), x(0.73f), y(0.97f), x(0.50f), y(0.97f))
                cubicTo(x(0.27f), y(0.97f), x(0.10f), y(0.87f), x(0.10f), y(0.68f))
                cubicTo(x(0.10f), y(0.47f), x(0.28f), y(0.30f), x(0.50f), y(0.04f))
                close()
            }
            "shield" -> {
                moveTo(x(0.50f), y(0.04f)); lineTo(x(0.92f), y(0.21f)); lineTo(x(0.86f), y(0.70f))
                cubicTo(x(0.82f), y(0.88f), x(0.65f), y(0.96f), x(0.50f), y(0.98f))
                cubicTo(x(0.35f), y(0.96f), x(0.18f), y(0.88f), x(0.14f), y(0.70f))
                lineTo(x(0.08f), y(0.21f)); close()
            }
            "ghost" -> {
                moveTo(x(0.16f), y(0.95f)); lineTo(x(0.16f), y(0.48f))
                cubicTo(x(0.16f), y(0.22f), x(0.30f), y(0.04f), x(0.50f), y(0.04f))
                cubicTo(x(0.70f), y(0.04f), x(0.84f), y(0.22f), x(0.84f), y(0.48f))
                lineTo(x(0.84f), y(0.95f)); lineTo(x(0.71f), y(0.86f)); lineTo(x(0.59f), y(0.95f))
                lineTo(x(0.47f), y(0.86f)); lineTo(x(0.35f), y(0.95f)); lineTo(x(0.24f), y(0.86f)); close()
            }
            else -> {
                // Classic cursor silhouette: a rounded pointer-like triangle.
                moveTo(x(0.50f), y(0.04f)); lineTo(x(0.91f), y(0.86f))
                quadraticTo(x(0.50f), y(0.76f), x(0.09f), y(0.86f)); close()
            }
        }
    }
}

private fun normalizeShape(shape: String?, role: String?, color: String): String {
    val known = setOf("orb", "bubble", "pill", "hex", "diamond", "star", "drop", "shield", "ghost", "classic")
    if (shape in known) return shape!!
    // Match the desktop fallback: a stable hash of role + color across the
    // nine automatic shapes. The server writes a shape for every bot, so this
    // only matters for older records that predate the migration.
    val automatic = listOf("orb", "bubble", "pill", "hex", "diamond", "star", "drop", "shield", "ghost")
    val value = "${role ?: ""}:$color"
    var hash = 2166136261L
    for (character in value) {
        hash = hash xor character.code.toLong()
        hash = (hash * 16777619L) and 0xffffffffL
    }
    return automatic[(hash % automatic.size).toInt()]
}

private fun crewColor(color: String): Color = when (color) {
    "blue" -> Color(0xFF377FE6)
    "red" -> Color(0xFFD94B52)
    "orange" -> Color(0xFFE78531)
    "purple" -> Color(0xFF8057C8)
    "cyan" -> Color(0xFF0EA5C6)
    "pink" -> Color(0xFFD84F8B)
    "yellow" -> Color(0xFFD8A729)
    "teal" -> Color(0xFF01A492)
    "coral" -> Color(0xFFE5634E)
    else -> Color(0xFF009957)
}

private fun lighten(color: Color, fraction: Float): Color = Color(
    red = color.red + (1f - color.red) * fraction,
    green = color.green + (1f - color.green) * fraction,
    blue = color.blue + (1f - color.blue) * fraction,
    alpha = color.alpha,
)

private fun darken(color: Color, fraction: Float): Color = Color(
    red = color.red * (1f - fraction),
    green = color.green * (1f - fraction),
    blue = color.blue * (1f - fraction),
    alpha = color.alpha,
)

/** Small, dependency-free job glyphs. */
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
