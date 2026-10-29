package com.opencrew.companion

import android.Manifest
import android.content.SharedPreferences
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.URI

class MainActivity : ComponentActivity() {
    private lateinit var connectionStore: ConnectionStore
    private lateinit var displayPreferences: SharedPreferences
    private var connection by mutableStateOf<CompanionConnection?>(null)
    private var chats by mutableStateOf<List<ConversationRecord>>(emptyList())
    private var activeChatKey by mutableStateOf<String?>(null)
    private var pendingThreadId: String? = null
    private var settingsOpen by mutableStateOf(false)
    private var showHiddenBots by mutableStateOf(false)
    private var showGroups by mutableStateOf(true)
    private var engines by mutableStateOf<List<EngineRecord>>(emptyList())
    private var settingsBusy by mutableStateOf(false)
    private var settingsMessage by mutableStateOf<String?>(null)
    private var settingsError by mutableStateOf<String?>(null)
    private var pairingInvite by mutableStateOf<PairingInvite?>(null)
    private var actionError by mutableStateOf<String?>(null)
    private var loading by mutableStateOf(false)
    private var refreshJob: Job? = null
    private var refreshQueued = false

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val qrScanner = registerForActivityResult(ScanContract()) { result ->
        result.contents?.let(::handleScannedQr)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        connectionStore = ConnectionStore(this)
        displayPreferences = getSharedPreferences("opencrew.mobile.display", MODE_PRIVATE)
        showHiddenBots = displayPreferences.getBoolean("showHiddenBots", false)
        showGroups = displayPreferences.getBoolean("showGroups", true)
        connection = try {
            connectionStore.load()
        } catch (_: Exception) {
            actionError = "Couldn't unlock the saved connection. Disconnect and pair again."
            null
        }
        handleIntent(intent)
        CompanionStreamService.ensureChannels(this)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = CrewGreen,
                    onPrimary = Color(0xFF07130D),
                    background = Color(0xFF101312),
                    surface = Color(0xFF191D1B),
                    surfaceVariant = Color(0xFF242A27),
                    onBackground = Color(0xFFF2F5F3),
                    onSurface = Color(0xFFF2F5F3),
                    onSurfaceVariant = Color(0xFFB9C3BD),
                ),
            ) {
                KodBotScreen(
                    connection = connection,
                    chats = chats,
                    activeChatKey = activeChatKey,
                    settingsOpen = settingsOpen,
                    showHiddenBots = showHiddenBots,
                    showGroups = showGroups,
                    engines = engines,
                    settingsBusy = settingsBusy,
                    settingsMessage = settingsMessage,
                    settingsError = settingsError,
                    pairingInvite = pairingInvite,
                    error = actionError,
                    loading = loading,
                    onDismissError = { actionError = null },
                    onPair = ::pair,
                    onScanQr = ::scanPairingQr,
                    onSelectChat = ::selectChat,
                    onBackToFleet = { activeChatKey = null },
                    onOpenSettings = ::openSettings,
                    onCloseSettings = { settingsOpen = false },
                    onRefresh = ::refreshFleet,
                    onRefreshEngines = ::refreshEngines,
                    onTestServer = ::testServer,
                    onSaveServerAddress = ::saveServerAddress,
                    onShowHiddenBots = ::updateShowHiddenBots,
                    onShowGroups = ::updateShowGroups,
                    onCreateBot = ::createBot,
                    onSend = ::send,
                    onRespond = ::respond,
                    onInterrupt = ::interrupt,
                    onSelectModel = ::selectModel,
                    onDisconnect = ::disconnect,
                )
            }
        }

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                CompanionSignals.frames.collect { frame -> handleFrame(frame) }
            }
        }
        // SSE is the fast path, not the only path. A dropped frame or a
        // half-open socket must not leave a finished turn looking active
        // forever, so reconcile with the computer while the app is visible.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    delay(10_000)
                    refreshFleet()
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (connection != null) {
            CompanionStreamService.start(this)
            // Frames published while the UI was stopped are deliberately
            // dropped, and a frame can also land while a fetch is in flight.
            // Refreshing here makes the visible fleet match the computer
            // again after a resume.
            refreshFleet()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        PairingInvite.parse(intent?.dataString)?.let { invite ->
            if (connection == null) pairingInvite = invite
            else actionError = "Disconnect this phone before pairing it with another computer."
        }
        val threadId = intent?.getStringExtra(CompanionStreamService.EXTRA_THREAD_ID)
        if (!threadId.isNullOrBlank()) {
            chats.firstOrNull { it.threadId == threadId }?.let { activeChatKey = it.key }
                ?: run { pendingThreadId = threadId }
        } else {
            intent?.getStringExtra(CompanionStreamService.EXTRA_BOT_ID)?.let { botId ->
                chats.firstOrNull { it.kind == "bot" && it.id == botId }?.let { activeChatKey = it.key }
            }
        }
    }

    private fun scanPairingQr() {
        qrScanner.launch(
            ScanOptions()
                .setCaptureActivity(KodBotCaptureActivity::class.java)
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("Center the QR shown in KodBot → Settings → Companion")
                .setBeepEnabled(true)
                .setOrientationLocked(true),
        )
    }

    private fun handleScannedQr(contents: String) {
        val invite = PairingInvite.parse(contents)
        when {
            invite == null -> actionError = "That isn't a KodBot pairing QR. Scan the one shown in KodBot → Settings → Companion."
            connection != null -> actionError = "Disconnect this phone before pairing it with another computer."
            else -> pairingInvite = invite
        }
    }

    private fun pair(address: String, credential: String) {
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                val paired = CompanionApi.pair(
                    address,
                    credential,
                    "Android Companion",
                    pairingInvite?.hosts.orEmpty(),
                )
                connectionStore.save(paired)
                connection = paired
                pairingInvite = null
                activeChatKey = null
                CompanionStreamService.start(this@MainActivity)
                refreshFleet()
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't pair with that computer."
            } finally {
                loading = false
            }
        }
    }

    private fun refreshFleet() {
        val saved = connection ?: return
        if (refreshJob?.isActive == true) {
            // A stream burst can arrive while the current fetch is running.
            // Remember it and fetch again instead of dropping the event that
            // usually carries the settled "idle" state and the final reply.
            refreshQueued = true
            return
        }
        refreshJob = lifecycleScope.launch {
            do {
                refreshQueued = false
                try {
                    chats = CompanionApi(saved).fleet()
                    pendingThreadId?.let { threadId ->
                        chats.firstOrNull { it.threadId == threadId }?.let {
                            activeChatKey = it.key
                            pendingThreadId = null
                        }
                    }
                    if (activeChatKey != null && chats.none { it.key == activeChatKey }) activeChatKey = null
                    actionError = null
                } catch (error: Exception) {
                    actionError = error.message ?: "Couldn't load the bots from the computer."
                }
                // Coalesce the tail of a burst without polling continuously.
                if (refreshQueued) delay(250)
            } while (refreshQueued)
        }
    }

    private fun openSettings() {
        settingsOpen = true
        settingsMessage = null
        settingsError = null
        refreshEngines()
    }

    private fun refreshEngines() {
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            try {
                engines = CompanionApi(saved).instances()
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't load the server's model catalog."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun connectionAt(address: String): CompanionConnection {
        val saved = connection ?: throw IllegalStateException("This phone isn't paired.")
        val port = runCatching { URI(saved.baseUrl).port }.getOrNull()?.takeIf { it > 0 } ?: 8810
        return saved.copy(baseUrl = CompanionAddress.normalize(address, port))
    }

    private fun testServer(address: String) {
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                val check = CompanionApi(connectionAt(address)).testServer()
                engines = check.engines
                settingsMessage = "Connected to ${check.serverName}; ${check.readyEngines} of ${check.engines.size} engines ready."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't reach the KodBot server."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun saveServerAddress(address: String) {
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                val updated = connectionAt(address)
                val check = CompanionApi(updated).testServer()
                connectionStore.save(updated)
                connection = updated
                engines = check.engines
                CompanionStreamService.stop(this@MainActivity)
                CompanionStreamService.start(this@MainActivity)
                refreshFleet()
                settingsMessage = "Address saved; connected to ${check.serverName}."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't connect to that address; the saved connection was kept."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun updateShowHiddenBots(show: Boolean) {
        showHiddenBots = show
        displayPreferences.edit().putBoolean("showHiddenBots", show).apply()
    }

    private fun updateShowGroups(show: Boolean) {
        showGroups = show
        displayPreferences.edit().putBoolean("showGroups", show).apply()
    }

    private fun selectModel(chat: ConversationRecord, engine: EngineRecord, model: ModelOptionRecord) {
        if (chat.kind != "bot") return
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).selectModel(chat.id, engine.instanceId, model.id)
                refreshFleet()
                settingsMessage = "${chat.name} will use ${engine.displayName} · ${model.label}."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't change this bot's model."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun createBot() {
        val saved = connection ?: return
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                val chat = CompanionApi(saved).createBot()
                chats = chats + chat
                activeChatKey = chat.key
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't create a bot."
            } finally {
                loading = false
            }
        }
    }

    private fun selectChat(chat: ConversationRecord) {
        activeChatKey = chat.key
        val saved = connection ?: return
        lifecycleScope.launch {
            try {
                CompanionApi(saved).markRead(chat)
                refreshFleet()
            } catch (_: Exception) {
                // Opening a chat should work even if marking it read fails.
            }
        }
    }

    private fun send(chat: ConversationRecord, text: String) {
        val saved = connection ?: return
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                CompanionApi(saved).send(chat, text)
                refreshFleet()
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't send the message."
            } finally {
                loading = false
            }
        }
    }

    private fun respond(chat: ConversationRecord, card: ApprovalCard, answer: String) {
        val saved = connection ?: return
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                CompanionApi(saved).respond(chat.threadId, card, answer)
                refreshFleet()
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't answer that request."
            } finally {
                loading = false
            }
        }
    }

    private fun interrupt(chat: ConversationRecord) {
        val saved = connection ?: return
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                CompanionApi(saved).interrupt(chat)
                refreshFleet()
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't stop the agent."
            } finally {
                loading = false
            }
        }
    }

    private fun disconnect() {
        CompanionStreamService.stop(this)
        connectionStore.clear()
        connection = null
        chats = emptyList()
        activeChatKey = null
        pendingThreadId = null
        pairingInvite = null
        settingsOpen = false
        actionError = null
    }

    private fun handleFrame(frame: JSONObject) {
        when (frame.optString("kind")) {
            "hello" -> if (!frame.optBoolean("resumed")) refreshFleet()
            "message", "message.patch", "bot", "bot.deleted", "group", "group.deleted", "notify" -> refreshFleet()
            "unauthorized" -> {
                CompanionStreamService.stop(this)
                connectionStore.clear()
                connection = null
                chats = emptyList()
                activeChatKey = null
                pendingThreadId = null
                actionError = "This phone was unpaired on the computer. Pair it again in KodBot Settings → Companion."
            }
        }
    }
}

private val CrewGreen = Color(0xFF38D591)

@Composable
private fun KodBotScreen(
    connection: CompanionConnection?,
    chats: List<ConversationRecord>,
    activeChatKey: String?,
    settingsOpen: Boolean,
    showHiddenBots: Boolean,
    showGroups: Boolean,
    engines: List<EngineRecord>,
    settingsBusy: Boolean,
    settingsMessage: String?,
    settingsError: String?,
    pairingInvite: PairingInvite?,
    error: String?,
    loading: Boolean,
    onDismissError: () -> Unit,
    onPair: (String, String) -> Unit,
    onScanQr: () -> Unit,
    onSelectChat: (ConversationRecord) -> Unit,
    onBackToFleet: () -> Unit,
    onOpenSettings: () -> Unit,
    onCloseSettings: () -> Unit,
    onRefresh: () -> Unit,
    onRefreshEngines: () -> Unit,
    onTestServer: (String) -> Unit,
    onSaveServerAddress: (String) -> Unit,
    onShowHiddenBots: (Boolean) -> Unit,
    onShowGroups: (Boolean) -> Unit,
    onCreateBot: () -> Unit,
    onSend: (ConversationRecord, String) -> Unit,
    onRespond: (ConversationRecord, ApprovalCard, String) -> Unit,
    onInterrupt: (ConversationRecord) -> Unit,
    onSelectModel: (ConversationRecord, EngineRecord, ModelOptionRecord) -> Unit,
    onDisconnect: () -> Unit,
) {
    var confirmDisconnect by rememberSaveable { mutableStateOf(false) }
    BackHandler(enabled = settingsOpen || activeChatKey != null) {
        if (settingsOpen) onCloseSettings() else onBackToFleet()
    }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().imePadding()) {
            if (error != null) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF4A211F)),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(error, modifier = Modifier.weight(1f), color = Color(0xFFFFDAD6))
                        TextButton(onClick = onDismissError) { Text("Dismiss") }
                    }
                }
            }

            if (connection == null) {
                PairingScreen(
                    invite = pairingInvite,
                    loading = loading,
                    onPair = onPair,
                    onScanQr = onScanQr,
                )
            } else if (settingsOpen) {
                SettingsScreen(
                    connection = connection,
                    chats = chats,
                    engines = engines,
                    showHiddenBots = showHiddenBots,
                    showGroups = showGroups,
                    busy = settingsBusy,
                    message = settingsMessage,
                    error = settingsError,
                    onBack = onCloseSettings,
                    onTestServer = onTestServer,
                    onSaveServerAddress = onSaveServerAddress,
                    onRefreshEngines = onRefreshEngines,
                    onShowHiddenBots = onShowHiddenBots,
                    onShowGroups = onShowGroups,
                    onSelectModel = onSelectModel,
                    onDisconnect = { confirmDisconnect = true },
                )
            } else {
                val activeChat = chats.firstOrNull { it.key == activeChatKey }
                if (activeChat == null) {
                    FleetScreen(
                        connection = connection,
                        chats = chats,
                        showHiddenBots = showHiddenBots,
                        showGroups = showGroups,
                        loading = loading,
                        onSelectChat = onSelectChat,
                        onRefresh = onRefresh,
                        onSettings = onOpenSettings,
                        onCreateBot = onCreateBot,
                    )
                } else {
                    ChatScreen(
                        chat = activeChat,
                        loading = loading,
                        onBack = onBackToFleet,
                        onSend = onSend,
                        onRespond = onRespond,
                        onInterrupt = onInterrupt,
                    )
                }
            }
        }
    }

    if (confirmDisconnect) {
        AlertDialog(
            onDismissRequest = { confirmDisconnect = false },
            title = { Text("Disconnect this phone?") },
            text = {
                Text("This removes the saved credential from this phone. If the phone is lost, also revoke it in KodBot → Settings → Companion.")
            },
            confirmButton = {
                TextButton(onClick = { confirmDisconnect = false; onDisconnect() }) { Text("Disconnect") }
            },
            dismissButton = { TextButton(onClick = { confirmDisconnect = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun PairingScreen(
    invite: PairingInvite?,
    loading: Boolean,
    onPair: (String, String) -> Unit,
    onScanQr: () -> Unit,
) {
    var address by rememberSaveable(invite?.address) { mutableStateOf(invite?.address.orEmpty()) }
    var credential by rememberSaveable(invite?.credential) { mutableStateOf(invite?.credential.orEmpty()) }
    val ready = address.isNotBlank() && credential.isNotBlank()

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start,
    ) {
        Text("KodBot", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Companion", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(12.dp))
        Text(
            "Your agents keep running on the Linux computer. Pair this phone to send work, follow replies, and handle approvals.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.size(24.dp))
        OutlinedButton(
            onClick = onScanQr,
            modifier = Modifier.fillMaxWidth(),
            enabled = !loading,
        ) {
            Text(if (invite == null) "Scan pairing QR" else "Scan a different QR")
        }
        Spacer(Modifier.size(12.dp))
        invite?.computerName?.takeIf(String::isNotBlank)?.let {
            Text("Pair with $it", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.size(8.dp))
        }
        OutlinedTextField(
            value = address,
            onValueChange = { address = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Companion address") },
            placeholder = { Text("192.168.1.42:8810") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
        )
        Spacer(Modifier.size(12.dp))
        if (invite?.credential?.startsWith("omb_pair_") == true) {
            Text("A one-time pairing invitation is ready. Confirm to pair with this computer.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            OutlinedTextField(
                value = credential,
                onValueChange = { credential = it.filter(Char::isDigit).take(6) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Six-digit pairing code") },
                placeholder = { Text("123456") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
            )
        }
        Spacer(Modifier.size(18.dp))
        Button(
            onClick = { onPair(address, credential) },
            modifier = Modifier.fillMaxWidth(),
            enabled = ready && !loading,
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("Pair with computer")
        }
        Spacer(Modifier.size(12.dp))
        Text(
            "On Linux: KodBot → Settings → Companion → Set up a phone. Use the shown LAN address on trusted Wi-Fi, or a Tailscale address when away.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun FleetScreen(
    connection: CompanionConnection,
    chats: List<ConversationRecord>,
    showHiddenBots: Boolean,
    showGroups: Boolean,
    loading: Boolean,
    onSelectChat: (ConversationRecord) -> Unit,
    onRefresh: () -> Unit,
    onSettings: () -> Unit,
    onCreateBot: () -> Unit,
) {
    val visibleChats = chats.filter { chat ->
        (chat.kind != "group" || showGroups) && (chat.kind != "bot" || showHiddenBots || !chat.hidden)
    }
    val workingCount = visibleChats.count { it.busy }
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("KodBot", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Connected to ${connection.serverName}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (workingCount > 0) {
                    Row(
                        modifier = Modifier.padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        WorkingDots(dotSize = 5.dp)
                        Spacer(Modifier.width(7.dp))
                        Text(
                            if (workingCount == 1) "1 working now" else "$workingCount working now",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = CrewGreen,
                        )
                    }
                }
            }
            IconButton(onClick = onCreateBot, enabled = !loading) {
                Icon(Icons.Filled.Add, contentDescription = "New bot")
            }
            IconButton(onClick = onRefresh, enabled = !loading) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
            }
            IconButton(onClick = onSettings) {
                Icon(Icons.Filled.Settings, contentDescription = "Settings")
            }
        }
        if (visibleChats.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    when {
                        loading -> "Loading chats…"
                        chats.isEmpty() -> "No bots or groups yet"
                        else -> "Nothing matches these filters"
                    },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    if (chats.isEmpty()) "Create a bot to start a task on the Linux computer."
                    else "Open Settings to show hidden bots or group chats.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(visibleChats.sortedWith(compareByDescending<ConversationRecord> { it.unread }.thenByDescending { it.busy }), key = { it.key }) { chat ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onSelectChat(chat) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (chat.kind == "group") {
                                Surface(modifier = Modifier.size(38.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                                    BoxCenter {
                                        Text(
                                            "G",
                                            color = MaterialTheme.colorScheme.onPrimary,
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                            } else {
                                BotAvatar(color = chat.color, name = chat.name, size = 44.dp)
                            }
                            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                                Text(
                                    chat.name,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                val preview = chat.messages.lastOrNull()?.let { message ->
                                    when (message.kind) {
                                        "options" -> if (message.card?.pending == true) "Waiting on you" else message.card?.title.orEmpty()
                                        "activity" -> message.toolName.ifBlank { "Working" }
                                        else -> message.text
                                    }
                                }.orEmpty()
                                Text(
                                    when {
                                        chat.busy && chat.kind == "group" -> "Group working · $preview"
                                        chat.busy -> "Working · $preview"
                                        chat.kind == "group" -> "${chat.memberCount} bots · $preview".trimEnd(' ', '·')
                                        preview.isBlank() -> "Start a conversation"
                                        else -> preview
                                    },
                                    maxLines = 1,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            if (chat.busy) {
                                WorkingBadge()
                                if (chat.unread) Spacer(Modifier.width(8.dp))
                            }
                            if (chat.unread) Surface(modifier = Modifier.size(9.dp), shape = CircleShape, color = CrewGreen) {}
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatScreen(
    chat: ConversationRecord,
    loading: Boolean,
    onBack: () -> Unit,
    onSend: (ConversationRecord, String) -> Unit,
    onRespond: (ConversationRecord, ApprovalCard, String) -> Unit,
    onInterrupt: (ConversationRecord) -> Unit,
) {
    var draft by rememberSaveable(chat.key) { mutableStateOf("") }
    val listState = rememberLazyListState()
    val workingItemIndex = chat.messages.lastIndex + if (chat.busy) 1 else 0
    LaunchedEffect(chat.messages.lastOrNull()?.id, chat.busy) {
        if (workingItemIndex >= 0) listState.animateScrollToItem(workingItemIndex)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onBack) { Text("‹ Bots") }
            if (chat.kind == "group") {
                Surface(modifier = Modifier.size(34.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                    BoxCenter {
                        Text("G", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                BotAvatar(color = chat.color, name = chat.name, size = 36.dp)
            }
            Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                Text(
                    chat.name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    when {
                        chat.busy -> "Working"
                        chat.kind == "group" -> "${chat.memberCount} bots"
                        else -> "Agent"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            if (chat.busy) {
                WorkingStopButton(
                    enabled = !loading,
                    onClick = { onInterrupt(chat) },
                )
            }
        }
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(chat.messages, key = { it.id }) { message ->
                MessageItem(
                    message = message,
                    onRespond = { card, answer -> onRespond(chat, card, answer) },
                )
            }
            if (chat.messages.isEmpty() && !chat.busy) {
                item { Text("Send a task to ${chat.name}.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            if (chat.busy) {
                item(key = "opencrew-working-indicator") {
                    WorkingBubble(group = chat.kind == "group")
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message ${chat.name}") },
                maxLines = 5,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                        val text = draft.trim()
                        if (text.isNotEmpty() && !loading) {
                            draft = ""
                            onSend(chat, text)
                    }
                }),
            )
            Button(
                onClick = {
                    val text = draft.trim()
                    if (text.isNotEmpty() && !loading) {
                        draft = ""
                        onSend(chat, text)
                    }
                },
                enabled = draft.isNotBlank() && !loading,
                modifier = Modifier.padding(bottom = 4.dp),
            ) { Text("Send") }
        }
    }
}

@Composable
private fun WorkingStopButton(enabled: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(50),
        color = CrewGreen.copy(alpha = if (enabled) 0.16f else 0.08f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WorkingDots(
                color = if (enabled) CrewGreen else CrewGreen.copy(alpha = 0.4f),
                dotSize = 5.dp,
            )
            Spacer(Modifier.width(7.dp))
            Text(
                "Stop",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = if (enabled) CrewGreen else CrewGreen.copy(alpha = 0.4f),
            )
        }
    }
}

@Composable
private fun WorkingBadge() {
    Surface(
        shape = RoundedCornerShape(50),
        color = CrewGreen.copy(alpha = 0.16f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WorkingDots(dotSize = 5.dp)
            Spacer(Modifier.width(7.dp))
            Text(
                "Working",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = CrewGreen,
            )
        }
    }
}

@Composable
private fun WorkingBubble(group: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                WorkingDots()
                Spacer(Modifier.width(9.dp))
                Text(
                    if (group) "Group working…" else "Working…",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun WorkingDots(
    modifier: Modifier = Modifier,
    color: Color = CrewGreen,
    dotSize: Dp = 6.dp,
) {
    val transition = rememberInfiniteTransition(label = "working")
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(3) { index ->
            val progress by transition.animateFloat(
                initialValue = 0.2f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = 420, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse,
                    initialStartOffset = StartOffset(index * 140),
                ),
                label = "working-dot-$index",
            )
            Box(
                modifier = Modifier
                    .size(dotSize)
                    .graphicsLayer {
                        alpha = progress
                        val scale = 0.75f + progress * 0.25f
                        scaleX = scale
                        scaleY = scale
                    }
                    .background(color, CircleShape),
            )
        }
    }
}

@Composable
private fun MessageItem(
    message: TranscriptMessage,
    onRespond: (ApprovalCard, String) -> Unit,
) {
    when {
        message.kind == "options" && message.card != null -> ApprovalItem(message.card, onRespond)
        message.kind == "activity" -> Text(
            "⚒ ${message.toolName.ifBlank { message.text.ifBlank { "Working" } }}",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(start = 4.dp),
        )
        message.text.isNotBlank() -> Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = if (message.role == "user") Arrangement.End else Arrangement.Start,
        ) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = if (message.role == "user") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
                modifier = Modifier.fillMaxWidth(0.88f),
            ) {
                Column(modifier = Modifier.padding(horizontal = 15.dp, vertical = 11.dp)) {
                    message.senderName?.takeIf(String::isNotBlank)?.let {
                        Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                    Text(
                        message.text,
                        color = if (message.role == "user") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun ApprovalItem(card: ApprovalCard, onRespond: (ApprovalCard, String) -> Unit) {
    var answer by rememberSaveable(card.requestId) { mutableStateOf("") }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(card.title.ifBlank { if (card.permission) "Approval needed" else "Question" }, fontWeight = FontWeight.SemiBold)
            if (card.subtitle.isNotBlank()) Text(card.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (card.pending) {
                if (card.options.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        card.options.forEach { option ->
                            val refusal = option.equals("deny", ignoreCase = true)
                            if (refusal) {
                                OutlinedButton(onClick = { onRespond(card, option) }) { Text(option) }
                            } else {
                                Button(onClick = { onRespond(card, option) }) { Text(option) }
                            }
                        }
                    }
                } else if (!card.permission) {
                    OutlinedTextField(
                        value = answer,
                        onValueChange = { answer = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Your answer") },
                    )
                    Button(onClick = { if (answer.isNotBlank()) onRespond(card, answer.trim()) }, enabled = answer.isNotBlank()) {
                        Text("Answer")
                    }
                }
            } else if (!card.answered.isNullOrBlank()) {
                Text("Answered: ${card.answered}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun BoxCenter(content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
        content = { content() },
    )
}
