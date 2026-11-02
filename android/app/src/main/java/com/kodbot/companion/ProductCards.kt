package com.kodbot.companion

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import java.net.URI

/** Product cards are a rendering contract, not a checkout: the action opens
 * the merchant's page and never claims that KodBot collected a payment. */
data class ProductCardItem(
    val title: String,
    val url: String,
    val price: String? = null,
    val store: String? = null,
    val rating: Double? = null,
    val reviews: Int? = null,
    val note: String? = null,
)

data class ProductCardsBlock(val text: String, val items: List<ProductCardItem>)

private val PRODUCT_FENCE = Regex("```(?:products|shopping)\\s*\\r?\\n([\\s\\S]*?)```", RegexOption.IGNORE_CASE)
private const val MAX_PRODUCTS = 12

private fun clean(value: String?, max: Int): String? {
    val text = value?.trim()?.replace(Regex("\\s+"), " ") ?: return null
    return text.take(max).takeIf(String::isNotBlank)
}

private fun webUrl(value: String?): String? {
    val raw = clean(value, 2_000) ?: return null
    return runCatching {
        val uri = URI(raw)
        if ((uri.scheme == "https" || uri.scheme == "http") && !uri.host.isNullOrBlank()) uri.toString() else null
    }.getOrNull()
}

private fun textField(entry: org.json.JSONObject, name: String): String? =
    if (entry.has(name) && !entry.isNull(name)) entry.optString(name) else null

fun parseProductCards(raw: String): List<ProductCardItem>? {
    val array = runCatching { JSONArray(raw) }.getOrNull() ?: return null
    val items = mutableListOf<ProductCardItem>()
    for (index in 0 until array.length()) {
        val entry = array.optJSONObject(index) ?: continue
        val title = clean(textField(entry, "title"), 180) ?: continue
        val url = webUrl(textField(entry, "url")) ?: continue
        val rating = if (entry.has("rating") && !entry.isNull("rating")) {
            entry.optDouble("rating").takeIf(Double::isFinite)?.coerceIn(0.0, 5.0)
        } else null
        val reviews = if (entry.has("reviews") && !entry.isNull("reviews")) {
            entry.optInt("reviews", -1).takeIf { it >= 0 }?.coerceAtMost(100_000_000)
        } else null
        items += ProductCardItem(
            title = title,
            url = url,
            price = clean(textField(entry, "price"), 40),
            store = clean(textField(entry, "store"), 80),
            rating = rating,
            reviews = reviews,
            note = clean(textField(entry, "note"), 240),
        )
        if (items.size == MAX_PRODUCTS) break
    }
    return items.takeIf { it.isNotEmpty() }
}

/** Split a bot reply into its prose and the product lists it carries. An
 * invalid block stays in the prose instead of being swallowed. */
fun extractProductCards(text: String): ProductCardsBlock {
    val items = mutableListOf<ProductCardItem>()
    var remaining = text
    for (match in PRODUCT_FENCE.findAll(text)) {
        val parsed = parseProductCards(match.groupValues[1]) ?: continue
        items += parsed
        remaining = remaining.replace(match.value, "")
    }
    val unique = items.distinctBy { "${it.url}\u0000${it.title}" }
    return ProductCardsBlock(remaining.trim(), unique.take(MAX_PRODUCTS))
}

@Composable
fun ProductCards(items: List<ProductCardItem>, modifier: Modifier = Modifier) {
    if (items.isEmpty()) return
    val context = LocalContext.current
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (item in items) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(item.title, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        item.price?.let {
                            Text(it, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                        }
                        item.store?.let {
                            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        item.rating?.let { rating ->
                            val reviews = item.reviews?.let { " ($it)" }.orEmpty()
                            Text(
                                "★ ${"%.1f".format(rating)}$reviews",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    item.note?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                    TextButton(
                        onClick = {
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.url))) }
                        },
                    ) {
                        Text("Buy now ↗")
                    }
                }
            }
        }
    }
}
