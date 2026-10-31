package com.kodbot.companion

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(
    connection: CompanionConnection,
    chats: List<ConversationRecord>,
    engines: List<EngineRecord>,
    showHiddenBots: Boolean,
    showGroups: Boolean,
    busy: Boolean,
    message: String?,
    error: String?,
    onBack: () -> Unit,
    onTestServer: (String) -> Unit,
    onSaveServerAddress: (String) -> Unit,
    onRefreshEngines: () -> Unit,
    onShowHiddenBots: (Boolean) -> Unit,
    onShowGroups: (Boolean) -> Unit,
    onSelectModel: (ConversationRecord, EngineRecord, ModelOptionRecord) -> Unit,
    onDisconnect: () -> Unit,
) {
    var address by rememberSaveable(connection.baseUrl) { mutableStateOf(connection.baseUrl) }
    var modelBotKey by rememberSaveable { mutableStateOf<String?>(null) }
    val bots = chats.filter { it.kind == "bot" }
    val modelBot = bots.firstOrNull { it.key == modelBotKey }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("‹ Back") }
                Text("Settings", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (error != null) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF4A211F))) {
                        Text(error, modifier = Modifier.padding(14.dp), color = Color(0xFFFFDAD6))
                    }
                }
                if (message != null) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF153627))) {
                        Text(message, modifier = Modifier.padding(14.dp), color = Color(0xFFD6F5E2))
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Connection", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("Computer: ${connection.serverName}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedTextField(
                            value = address,
                            onValueChange = { address = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Server address") },
                            placeholder = { Text("host-or-ip:8810") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { onTestServer(address) },
                                enabled = !busy && address.isNotBlank(),
                                modifier = Modifier.weight(1f),
                            ) {
                                Text("Test server")
                            }
                            Button(
                                onClick = { onSaveServerAddress(address) },
                                enabled = !busy && address.isNotBlank(),
                                modifier = Modifier.weight(1f),
                            ) {
                                if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                else Text("Save address")
                            }
                        }
                        Text(
                            "Use the LAN address on trusted Wi-Fi or a Tailscale name when away. Saving changes this phone only; it doesn't expose new ports on the computer.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("This phone", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Unpairing removes the saved credential from this phone. You can pair again with a QR code or six-digit code.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        OutlinedButton(
                            onClick = onDisconnect,
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFFF8A80)),
                        ) {
                            Text("Disconnect this phone")
                        }
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Text("What to show", modifier = Modifier.padding(top = 10.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        SettingSwitch(
                            title = "Show hidden bots",
                            subtitle = "Include bots hidden on the desktop.",
                            checked = showHiddenBots,
                            onCheckedChange = onShowHiddenBots,
                        )
                        SettingSwitch(
                            title = "Show group chats",
                            subtitle = "Include rooms and group conversations in the chat list.",
                            checked = showGroups,
                            onCheckedChange = onShowGroups,
                        )
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Models", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${engines.count { it.ready }} of ${engines.size} engines ready",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            TextButton(onClick = onRefreshEngines, enabled = !busy) { Text("Refresh") }
                        }
                        Text(
                            "Choose a model for a bot. API keys and engine sign-in stay on the Linux computer.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (bots.isEmpty()) {
                            Text("No bots available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            bots.forEach { bot ->
                                val selection = bot.modelSelection
                                val engine = engines.firstOrNull { it.instanceId == selection?.instanceId }
                                val selectedModel = engine?.models?.firstOrNull { it.id == selection?.model }?.label
                                    ?: selection?.model.orEmpty()
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    BotAvatar(color = bot.color, name = bot.name, size = 30.dp)
                                    Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                                        Text(bot.name, fontWeight = FontWeight.Medium)
                                        Text(
                                            if (selection == null) "No model selected" else "${engine?.displayName ?: selection.instanceId} · $selectedModel",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                    TextButton(
                                        onClick = { modelBotKey = bot.key },
                                        enabled = !busy && engines.any { it.ready && it.models.isNotEmpty() },
                                    ) { Text("Choose") }
                                }
                            }
                        }
                        if (engines.any { !it.ready }) {
                            Text(
                                "Some engines need setup on the computer before they can be selected.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }

    val selectedModelBot = modelBot
    if (selectedModelBot != null) {
        ModelChoiceDialog(
            bot = selectedModelBot,
            engines = engines,
            onDismiss = { modelBotKey = null },
            onSelect = { engine, model ->
                onSelectModel(selectedModelBot, engine, model)
                modelBotKey = null
            },
        )
    }
}

@Composable
private fun SettingSwitch(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Medium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun ModelChoiceDialog(
    bot: ConversationRecord,
    engines: List<EngineRecord>,
    onDismiss: () -> Unit,
    onSelect: (EngineRecord, ModelOptionRecord) -> Unit,
) {
    val choices = engines.filter { it.ready }.flatMap { engine -> engine.models.map { engine to it } }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose a model for ${bot.name}") },
        text = {
            if (choices.isEmpty()) {
                Text("No ready model catalog is available. Check the server connection or sign in to an engine on the computer.")
            } else {
                LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp)) {
                    items(choices, key = { (engine, model) -> "${engine.instanceId}:${model.id}" }) { (engine, model) ->
                        val selection = bot.modelSelection
                        val selected = selection != null && selection.instanceId == engine.instanceId && selection.model == model.id
                        TextButton(
                            onClick = { onSelect(engine, model) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "${engine.displayName} · ${model.label}${if (selected) " ✓" else ""}",
                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                )
                                if (model.group != null || model.free || model.custom) {
                                    Text(
                                        listOfNotNull(model.group, if (model.free) "Free" else null, if (model.custom) "Custom" else null).joinToString(" · "),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}
