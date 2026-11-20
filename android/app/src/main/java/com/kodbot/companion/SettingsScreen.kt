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
import androidx.compose.material3.Checkbox
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
    desktopMode: Boolean,
    onDesktopModeChange: (Boolean) -> Unit,
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
    onSetAutoModel: (ConversationRecord, Boolean, List<ModelSelectionRecord>) -> Unit,
    onSetEconomyModel: (ConversationRecord, Boolean) -> Unit,
    onLanguageChange: (AppLanguage) -> Unit,
    onCreateTeam: (ConversationRecord, String) -> Unit,
    onJoinTeam: (ConversationRecord, String) -> Unit,
    onLeaveTeam: (ConversationRecord, String) -> Unit,
    onTransferTeam: (String, String) -> Unit,
    onDisconnect: () -> Unit,
    updateState: UpdateUiState,
    appVersion: String,
    onCheckForUpdates: () -> Unit,
    onInstallUpdate: () -> Unit,
    onDownloadApk: () -> Unit,
) {
    var address by rememberSaveable(connection.baseUrl) { mutableStateOf(connection.baseUrl) }
    var modelBotKey by rememberSaveable { mutableStateOf<String?>(null) }
    var teamBotKey by rememberSaveable { mutableStateOf<String?>(null) }
    var poolBotKey by rememberSaveable { mutableStateOf<String?>(null) }
    var knowledgeOpen by rememberSaveable { mutableStateOf(false) }
    val bots = chats.filter { it.kind == "bot" }
    val modelBot = bots.firstOrNull { it.key == modelBotKey }
    val teamBot = bots.firstOrNull { it.key == teamBotKey }
    val poolBot = bots.firstOrNull { it.key == poolBotKey }
    val teamGroups = bots
        .filter { !it.teamId.isNullOrBlank() }
        .groupBy { it.teamId.orEmpty() }
        .map { (id, members) -> TeamSummary(id, members.first().teamName.orEmpty(), members) }
        .sortedBy { it.name.lowercase() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text(tr("‹ Back")) }
                Text(tr("Settings"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (error != null) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF4A211F))) {
                        Text(tr(error), modifier = Modifier.padding(14.dp), color = Color(0xFFFFDAD6))
                    }
                }
                if (message != null) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF153627))) {
                        Text(tr(message), modifier = Modifier.padding(14.dp), color = Color(0xFFD6F5E2))
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(tr("Connection"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(tr("Computer: ${connection.serverName}"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedTextField(
                            value = address,
                            onValueChange = { address = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text(tr("Server address")) },
                            placeholder = { Text(tr("host-or-ip:8810")) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { onTestServer(address) },
                                enabled = !busy && address.isNotBlank(),
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(tr("Test server"))
                            }
                            Button(
                                onClick = { onSaveServerAddress(address) },
                                enabled = !busy && address.isNotBlank(),
                                modifier = Modifier.weight(1f),
                            ) {
                                if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                else Text(tr("Save address"))
                            }
                        }
                        Text(tr("Use the LAN address on trusted Wi-Fi or a Tailscale name when away. Saving changes this phone only; it doesn't expose new ports on the computer."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(tr("This phone"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(tr("Unpairing removes the saved credential from this phone. You can pair again with a QR code or six-digit code."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        OutlinedButton(
                            onClick = onDisconnect,
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFFF8A80)),
                        ) {
                            Text(tr("Disconnect this phone"))
                        }
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(tr("App updates"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        val update = updateState.info
                        val status = when {
                            updateState.checking -> "Checking for updates…"
                            updateState.downloading -> "Downloading KodBot ${update?.versionName.orEmpty()}…"
                            update != null -> "KodBot ${update.versionName} is available."
                            updateState.message != null -> updateState.message.orEmpty()
                            else -> "Installed version $appVersion."
                        }
                        Text(tr(status), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        update?.notes?.takeIf(String::isNotBlank)?.let {
                            Text(tr(it), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        updateState.error?.let {
                            Text(tr(it), style = MaterialTheme.typography.bodySmall, color = Color(0xFFFF8A80))
                        }
                        Button(
                            onClick = if (update != null) onInstallUpdate else onCheckForUpdates,
                            enabled = !updateState.checking && !updateState.downloading && !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (updateState.checking || updateState.downloading) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Text(tr(if (update != null) "Download and install" else "Check for updates"))
                            }
                        }
                        TextButton(
                            onClick = onDownloadApk,
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(tr("Download APK directly"))
                        }
                        Text(tr("Use this if Check for updates can't reach the update server."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(tr("Language"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(tr("Choose the language for the app. Changes apply immediately."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val current = LocalAppLanguage.current
                            for (choice in listOf(AppLanguage.EN to "English", AppLanguage.BG to "Български")) {
                                if (choice.first == current) {
                                    Button(onClick = { onLanguageChange(choice.first) }, enabled = !busy) { Text(choice.second) }
                                } else {
                                    OutlinedButton(onClick = { onLanguageChange(choice.first) }, enabled = !busy) { Text(choice.second) }
                                }
                            }
                        }
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Text(tr("Display"), modifier = Modifier.padding(top = 10.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        SettingSwitch(
                            title = "Desktop mode (web view)",
                            subtitle = "Use the full web interface while native notifications keep running. System back returns to the native app.",
                            checked = desktopMode,
                            onCheckedChange = onDesktopModeChange,
                        )
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(tr("Knowledge"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(tr("Who you are, the mission, projects, skills, and team notes every bot can use."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Button(onClick = { knowledgeOpen = true }, enabled = !busy) {
                            Text(tr("Edit knowledge"))
                        }
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Text(tr("What to show"), modifier = Modifier.padding(top = 10.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
                                Text(tr("Teams"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(tr("${teamGroups.size} teams · ${bots.count { it.teamId != null }} of ${bots.size} bots grouped"),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text(tr("A bot belongs to one team. Only an ungrouped bot can create a team; the creator leads it, and the leader must hand over leadership before leaving."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (bots.isEmpty()) {
                            Text(tr("No bots available."), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            bots.forEach { bot ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    BotAvatar(color = bot.color, name = bot.name, size = 30.dp, role = bot.role, shape = bot.mascotShape)
                                    Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(bot.name, fontWeight = FontWeight.Medium)
                                            if (bot.teamIsLeader) {
                                                Text(tr("  leader"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                                            }
                                        }
                                        Text(
                                            bot.teamName ?: "Not in a team",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                    TextButton(
                                        onClick = { teamBotKey = bot.key },
                                        enabled = !busy,
                                    ) { Text(tr(if (bot.teamId == null) "Join" else "Manage")) }
                                }
                            }
                        }
                    }
                }

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(tr("Models"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(tr("${engines.count { it.ready }} of ${engines.size} engines ready"),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            TextButton(onClick = onRefreshEngines, enabled = !busy) { Text(tr("Refresh")) }
                        }
                        Text(tr("Choose a model for a bot. Auto routing uses only the models in its pool; an empty pool stays on the current engine. API keys and engine sign-in stay on the Linux computer."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (bots.isEmpty()) {
                            Text(tr("No bots available."), color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                                    BotAvatar(color = bot.color, name = bot.name, size = 30.dp, role = bot.role, shape = bot.mascotShape)
                                    Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                                        Text(bot.name, fontWeight = FontWeight.Medium)
                                        Text(
                                            if (selection == null) "No model selected"
                                            else "${engine?.let(::engineLabel) ?: selection.instanceId} · $selectedModel",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                    TextButton(
                                        onClick = { modelBotKey = bot.key },
                                        enabled = !busy && engines.any { it.ready && it.models.isNotEmpty() },
                                    ) { Text(tr("Choose")) }
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(start = 40.dp, bottom = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(tr("Auto"), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                                        Text(
                                            when {
                                                !bot.autoModel -> "Off"
                                                bot.autoModelPool.isEmpty() -> "On · current engine only"
                                                else -> "On · ${bot.autoModelPool.size} models"
                                            },
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Switch(
                                        checked = bot.autoModel,
                                        onCheckedChange = { onSetAutoModel(bot, it, bot.autoModelPool) },
                                        enabled = !busy,
                                    )
                                    TextButton(
                                        onClick = { poolBotKey = bot.key },
                                        enabled = !busy,
                                    ) { Text(tr("Pool")) }
                                }
                                if (bot.autoModel) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(start = 40.dp, bottom = 2.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(tr("Economy"), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                                            Text(tr("Short questions use a faster or free model. Code and the screen stay on a strong one."),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        Switch(
                                            checked = bot.economyModel,
                                            onCheckedChange = { onSetEconomyModel(bot, it) },
                                            enabled = !busy,
                                        )
                                    }
                                }
                            }
                        }
                        if (engines.any { !it.ready }) {
                            Text(tr("Some engines need setup on the computer before they can be selected."),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }

    if (knowledgeOpen) {
        KnowledgeDialog(connection = connection, onClose = { knowledgeOpen = false })
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

    val selectedTeamBot = teamBot
    if (selectedTeamBot != null) {
        BotTeamDialog(
            bot = selectedTeamBot,
            bots = bots,
            busy = busy,
            onDismiss = { teamBotKey = null },
            onCreate = { name ->
                onCreateTeam(selectedTeamBot, name)
                teamBotKey = null
            },
            onJoin = { teamId ->
                onJoinTeam(selectedTeamBot, teamId)
                teamBotKey = null
            },
            onLeave = { teamId ->
                onLeaveTeam(selectedTeamBot, teamId)
                teamBotKey = null
            },
            onTransfer = { teamId, leaderId ->
                onTransferTeam(teamId, leaderId)
                teamBotKey = null
            },
        )
    }

    val selectedPoolBot = poolBot
    if (selectedPoolBot != null) {
        AutoModelPoolDialog(
            bot = selectedPoolBot,
            engines = engines,
            onDismiss = { poolBotKey = null },
            onSave = { autoModel, pool ->
                onSetAutoModel(selectedPoolBot, autoModel, pool)
                poolBotKey = null
            },
        )
    }
}

private data class TeamSummary(
    val id: String,
    val name: String,
    val members: List<ConversationRecord>,
) {
    val leader: ConversationRecord? get() = members.firstOrNull { it.teamIsLeader }
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
            Text(tr(title), fontWeight = FontWeight.Medium)
            Text(tr(subtitle), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    var query by rememberSaveable(bot.key) { mutableStateOf("") }
    val needle = query.trim().lowercase()
    val ready = engines
        .filter { it.ready && it.models.isNotEmpty() }
        .map { engine ->
            engine to engine.models.filter { model ->
                needle.isEmpty() ||
                    "${model.label} ${model.id} ${model.group.orEmpty()} ${engineLabel(engine)}".lowercase().contains(needle)
            }
        }
        .filter { (_, models) -> models.isNotEmpty() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(tr("Choose a model for ${bot.name}")) },
        text = {
            if (ready.isEmpty()) {
                Text(tr("No ready model catalog is available. Check the server connection or sign in to an engine on the computer."))
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(tr("Search models")) },
                        singleLine = true,
                    )
                    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 380.dp)) {
                        for ((engine, filtered) in ready) {
                            item(key = "engine:${engine.instanceId}") {
                                Text(
                                    engineLabel(engine),
                                    modifier = Modifier.padding(top = 10.dp, bottom = 2.dp),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            for ((group, models) in filtered.groupBy { it.group.orEmpty() }) {
                                if (group.isNotBlank()) {
                                    item(key = "group:${engine.instanceId}:$group") {
                                        Text(tr("$group · ${models.size}"),
                                            modifier = Modifier.padding(top = 4.dp, bottom = 1.dp, start = 4.dp),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                                items(models, key = { "${engine.instanceId}:${it.id}" }) { model ->
                                    val selection = bot.modelSelection
                                    val selected = selection != null &&
                                        selection.instanceId == engine.instanceId &&
                                        selection.model == model.id
                                    TextButton(
                                        onClick = { onSelect(engine, model) },
                                        modifier = Modifier.fillMaxWidth(),
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    model.label,
                                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                                )
                                                if (model.group != null || model.free || model.custom) {
                                                    Text(
                                                        listOfNotNull(
                                                            model.group,
                                                            if (model.free) "Free" else null,
                                                            if (model.custom) "Custom" else null,
                                                        ).joinToString(" · "),
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    )
                                                }
                                            }
                                            ModelCapabilityBadges(model)
                                            if (selected) Text(tr("  ✓"), color = MaterialTheme.colorScheme.primary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(tr("Close")) } },
    )
}

@Composable
private fun BotTeamDialog(
    bot: ConversationRecord,
    bots: List<ConversationRecord>,
    busy: Boolean,
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit,
    onJoin: (String) -> Unit,
    onLeave: (String) -> Unit,
    onTransfer: (String, String) -> Unit,
) {
    var newTeamName by rememberSaveable(bot.key) { mutableStateOf("") }
    var confirmLeave by rememberSaveable(bot.key) { mutableStateOf(false) }
    val teams = bots
        .filter { !it.teamId.isNullOrBlank() }
        .groupBy { it.teamId.orEmpty() }
        .map { (id, members) -> TeamSummary(id, members.first().teamName.orEmpty(), members) }
        .sortedBy { it.name.lowercase() }
    val current = teams.firstOrNull { it.id == bot.teamId }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(tr("Team for ${bot.name}")) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                if (current != null) {
                    Text(current.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(tr("Leader: ${current.leader?.name ?: "unknown"}"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(tr("Members: ${current.members.joinToString { it.name }}"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (bot.teamIsLeader) {
                        Text(tr("Hand leadership to another member before leaving."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        current.members.filter { it.id != bot.id }.forEach { member ->
                            OutlinedButton(
                                onClick = { onTransfer(current.id, member.id) },
                                enabled = !busy,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(tr("Make ${member.name} leader"))
                            }
                        }
                    } else if (confirmLeave) {
                        Text(tr("Leave ${current.name}?"), fontWeight = FontWeight.Medium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { confirmLeave = false }, enabled = !busy) { Text(tr("Cancel")) }
                            Button(onClick = { onLeave(current.id) }, enabled = !busy) { Text(tr("Leave team")) }
                        }
                    } else {
                        OutlinedButton(
                            onClick = { confirmLeave = true },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(tr("Leave team"))
                        }
                    }
                } else {
                    Text(tr("Join a team"), fontWeight = FontWeight.SemiBold)
                    val joinable = teams.filter { team -> team.members.none { it.id == bot.id } }
                    if (joinable.isEmpty()) {
                        Text(tr("No other teams yet. Create one below."),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        joinable.forEach { team ->
                            OutlinedButton(
                                onClick = { onJoin(team.id) },
                                enabled = !busy,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = Alignment.Start,
                                ) {
                                    Text(team.name)
                                    Text(tr("${team.members.size} bots · leader ${team.leader?.name ?: "unknown"}"),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                    Text(tr("Create a new team"), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
                    OutlinedTextField(
                        value = newTeamName,
                        onValueChange = { newTeamName = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(tr("Team name")) },
                        singleLine = true,
                    )
                    Button(
                        onClick = { onCreate(newTeamName.trim()) },
                        enabled = !busy && newTeamName.trim().isNotEmpty(),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(tr("Create team"))
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(tr("Close")) } },
    )
}

@Composable
private fun AutoModelPoolDialog(
    bot: ConversationRecord,
    engines: List<EngineRecord>,
    onDismiss: () -> Unit,
    onSave: (Boolean, List<ModelSelectionRecord>) -> Unit,
) {
    var query by rememberSaveable(bot.key) { mutableStateOf("") }
    var selected by remember(bot.key) {
        mutableStateOf(bot.autoModelPool.map { "${it.instanceId}\u0000${it.model}" }.toSet())
    }
    val needle = query.trim().lowercase()
    val available = engines.filter { it.ready && it.models.isNotEmpty() }
    val ready = available
        .map { engine ->
            engine to engine.models.filter { model ->
                needle.isEmpty() ||
                    "${model.label} ${model.id} ${model.group.orEmpty()} ${engineLabel(engine)}".lowercase().contains(needle)
            }
        }
        .filter { (_, models) -> models.isNotEmpty() }

    fun toggle(key: String) {
        selected = if (key in selected) selected - key else selected + key
    }

    // The saved pool must include every checked model, not only the rows that
    // happen to match the current search string.
    val chosen = available.flatMap { engine ->
        engine.models
            .filter { "${engine.instanceId}\u0000${it.id}" in selected }
            .map { ModelSelectionRecord(engine.instanceId, it.id, null) }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(tr("Auto model pool for ${bot.name}")) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(tr("Auto may route only to the models selected here. An empty pool keeps Auto inside the current engine."),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(tr("Search models")) },
                    singleLine = true,
                )
                if (ready.isEmpty()) {
                    Text(tr("No ready model catalog is available. Check the computer connection or sign in to an engine."),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 340.dp)) {
                        for ((engine, models) in ready) {
                            item(key = "pool-engine:${engine.instanceId}") {
                                Text(
                                    engineLabel(engine),
                                    modifier = Modifier.padding(top = 8.dp, bottom = 2.dp),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            items(models, key = { "pool:${engine.instanceId}:${it.id}" }) { model ->
                                val key = "${engine.instanceId}\u0000${model.id}"
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { toggle(key) }
                                        .padding(vertical = 1.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Checkbox(
                                        checked = key in selected,
                                        onCheckedChange = { toggle(key) },
                                    )
                                    Text(
                                        model.label,
                                        modifier = Modifier.weight(1f),
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                    ModelCapabilityBadges(model)
                                }
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { onSave(true, emptyList()) }) { Text(tr("Use current engine only")) }
                    TextButton(onClick = { onSave(false, bot.autoModelPool) }) { Text(tr("Turn off Auto")) }
                }
                Text(tr("${chosen.size} selected"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(true, chosen) },
                enabled = available.isNotEmpty(),
            ) { Text(tr("Save pool")) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(tr("Cancel")) } },
    )
}
