package com.kodbot.companion

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    private var updateState by mutableStateOf(UpdateUiState())
    private val appVersionName: String
        get() = runCatching {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "?"
        }.getOrDefault("?")
    private val installedVersionCode: Long
        get() = runCatching {
            val info = packageManager.getPackageInfo(packageName, 0)
            if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        }.getOrDefault(0L)

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val qrScanner = registerForActivityResult(ScanContract()) { result ->
        result.contents?.let(::handleScannedQr)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        connectionStore = ConnectionStore(this)
        displayPreferences = getSharedPreferences("kodbot.mobile.display", MODE_PRIVATE)
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
                    updateState = updateState,
                    appVersion = appVersionName,
                    onCheckForUpdates = { checkForUpdates(manual = true) },
                    onInstallUpdate = ::installUpdate,
                    onDownloadApk = ::downloadApk,
                    onDismissError = { actionError = null },
                    onPair = ::pair,
                    onScanQr = ::scanPairingQr,
                    onLogin = ::login,
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
                    onSetAutoModel = ::setAutoModel,
                    onCreateTeam = ::createTeam,
                    onJoinTeam = ::joinTeam,
                    onLeaveTeam = ::leaveTeam,
                    onTransferTeam = ::transferTeam,
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
        lifecycleScope.launch { checkForUpdates(manual = false) }
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
            if (connection == null) {
                pairingInvite = invite
                // A token link is a finished handoff — redeem it immediately
                // instead of making the user tap the button on a screen that
                // already has everything it needs.
                if (invite.credential.startsWith("omb_pair_")) pair(invite.address, invite.credential)
            } else {
                actionError = "Disconnect this phone before pairing it with another computer."
            }
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
            else -> {
                actionError = null
                pairingInvite = invite
                if (invite.credential.startsWith("omb_pair_")) pair(invite.address, invite.credential)
            }
        }
    }

    private fun login(address: String, email: String, password: String) {
        lifecycleScope.launch {
            loading = true
            actionError = null
            try {
                val signedIn = CompanionApi.login(address, email, password)
                connectionStore.save(signedIn)
                connection = signedIn
                pairingInvite = null
                activeChatKey = null
                CompanionStreamService.start(this@MainActivity)
                refreshFleet()
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't sign in to that server."
            } finally {
                loading = false
            }
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
                    if (saved.kind == "session" && error.message?.contains("HTTP 401") == true) {
                        CompanionStreamService.stop(this@MainActivity)
                        connectionStore.clear()
                        connection = null
                        chats = emptyList()
                        activeChatKey = null
                        pendingThreadId = null
                        actionError = "Your session expired. Sign in again."
                    } else {
                        actionError = error.message ?: "Couldn't load the bots from the computer."
                    }
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

    private fun setAutoModel(chat: ConversationRecord, enabled: Boolean, pool: List<ModelSelectionRecord>) {
        if (chat.kind != "bot") return
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).setAutoModel(chat.id, enabled, pool)
                refreshFleet()
                settingsMessage = when {
                    !enabled -> "Auto routing is off for ${chat.name}."
                    pool.isEmpty() -> "${chat.name} will auto-route within its current engine."
                    else -> "${chat.name} will auto-route between ${pool.size} selected models."
                }
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't change auto routing."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun createTeam(chat: ConversationRecord, name: String) {
        if (chat.kind != "bot" || name.isBlank()) return
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).createTeam(name.trim(), chat.id)
                refreshFleet()
                settingsMessage = "${chat.name} leads the new team ${name.trim()}."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't create the team."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun joinTeam(chat: ConversationRecord, teamId: String) {
        if (chat.kind != "bot") return
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).joinTeam(teamId, chat.id)
                refreshFleet()
                settingsMessage = "${chat.name} joined the team."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't join the team."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun leaveTeam(chat: ConversationRecord, teamId: String) {
        if (chat.kind != "bot") return
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).leaveTeam(teamId, chat.id)
                refreshFleet()
                settingsMessage = "${chat.name} left the team."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't leave the team."
            } finally {
                settingsBusy = false
            }
        }
    }

    private fun transferTeam(teamId: String, leaderId: String) {
        val saved = connection ?: return
        lifecycleScope.launch {
            settingsBusy = true
            settingsError = null
            settingsMessage = null
            try {
                CompanionApi(saved).setTeamLeader(teamId, leaderId)
                refreshFleet()
                settingsMessage = "Team leadership transferred."
            } catch (error: Exception) {
                settingsError = error.message ?: "Couldn't transfer leadership."
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
                settingsOpen = false
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't create a bot."
            } finally {
                loading = false
            }
        }
    }

    private fun selectChat(chat: ConversationRecord) {
        activeChatKey = chat.key
        settingsOpen = false
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

    private fun send(
        chat: ConversationRecord,
        text: String,
        attachments: List<PendingAttachment>,
        done: (Boolean) -> Unit,
    ) {
        val saved = connection ?: run {
            done(false)
            return
        }
        lifecycleScope.launch {
            loading = true
            actionError = null
            var sent = false
            try {
                val api = CompanionApi(saved)
                val uploaded = attachments.map { attachment ->
                    try {
                        api.upload(attachment, contentResolver)
                    } catch (error: Exception) {
                        throw java.io.IOException(
                            "Couldn't attach ${attachment.name}: ${error.message ?: "upload failed"}",
                        )
                    }
                }
                api.send(chat, composeMessage(text, uploaded))
                refreshFleet()
                sent = true
            } catch (error: Exception) {
                actionError = error.message ?: "Couldn't send the message."
            } finally {
                loading = false
                done(sent)
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

    private fun checkForUpdates(manual: Boolean) {
        if (updateState.checking || updateState.downloading) return
        updateState = updateState.copy(checking = true, error = null, message = null)
        lifecycleScope.launch {
            updateState = try {
                val latest = AppUpdateChecker.latest(
                    installedVersionCode,
                    connection?.baseUrl,
                    connection?.token,
                )
                if (latest != null) {
                    updateState.copy(info = latest, checking = false, error = null)
                } else {
                    updateState.copy(
                        info = null,
                        checking = false,
                        error = null,
                        message = if (manual) "You're on the latest version (${appVersionName})." else null,
                    )
                }
            } catch (error: Exception) {
                updateState.copy(
                    checking = false,
                    error = if (manual) (error.message ?: "Couldn't check for updates.") else null,
                )
            }
        }
    }

    private fun installUpdate() {
        val update = updateState.info ?: return
        if (updateState.downloading) return
        updateState = updateState.copy(downloading = true, error = null)
        lifecycleScope.launch {
            try {
                val apk = AppUpdateChecker.download(this@MainActivity, update)
                AppUpdateChecker.install(this@MainActivity, apk)
                updateState = updateState.copy(downloading = false, error = null)
            } catch (error: Exception) {
                updateState = updateState.copy(
                    downloading = false,
                    error = error.message ?: "Couldn't download the update.",
                )
            }
        }
    }

    private fun downloadApk() {
        val saved = connection ?: return
        val uri = runCatching { java.net.URI(saved.baseUrl) }.getOrNull() ?: return
        val url = java.net.URI("http", null, uri.host, 8799, "/api/android/apk", null, null).toString()
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
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
                val wasSession = connection?.kind == "session"
                CompanionStreamService.stop(this)
                connectionStore.clear()
                connection = null
                chats = emptyList()
                activeChatKey = null
                pendingThreadId = null
                actionError = if (wasSession) {
                    "Your session expired. Sign in again."
                } else {
                    "This phone was unpaired on the computer. Pair it again in KodBot Settings → Companion."
                }
            }
        }
    }
}

private val CrewGreen = Color(0xFF38D591)

data class UpdateUiState(
    val info: AppUpdate? = null,
    val checking: Boolean = false,
    val downloading: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

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
    updateState: UpdateUiState,
    appVersion: String,
    onCheckForUpdates: () -> Unit,
    onInstallUpdate: () -> Unit,
    onDownloadApk: () -> Unit,
    onDismissError: () -> Unit,
    onPair: (String, String) -> Unit,
    onScanQr: () -> Unit,
    onLogin: (String, String, String) -> Unit,
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
    onSend: (ConversationRecord, String, List<PendingAttachment>, (Boolean) -> Unit) -> Unit,
    onRespond: (ConversationRecord, ApprovalCard, String) -> Unit,
    onInterrupt: (ConversationRecord) -> Unit,
    onSelectModel: (ConversationRecord, EngineRecord, ModelOptionRecord) -> Unit,
    onSetAutoModel: (ConversationRecord, Boolean, List<ModelSelectionRecord>) -> Unit,
    onCreateTeam: (ConversationRecord, String) -> Unit,
    onJoinTeam: (ConversationRecord, String) -> Unit,
    onLeaveTeam: (ConversationRecord, String) -> Unit,
    onTransferTeam: (String, String) -> Unit,
    onDisconnect: () -> Unit,
) {
    var confirmDisconnect by rememberSaveable { mutableStateOf(false) }
    val activeChat = chats.firstOrNull { it.key == activeChatKey }

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
                    onLogin = onLogin,
                )
            } else {
                val activeConnection = connection
                val fleetContent: @Composable (String?) -> Unit = { selected ->
                    FleetScreen(
                        connection = activeConnection,
                        chats = chats,
                        showHiddenBots = showHiddenBots,
                        showGroups = showGroups,
                        loading = loading,
                        selectedChatKey = selected,
                        onSelectChat = onSelectChat,
                        onRefresh = onRefresh,
                        onSettings = onOpenSettings,
                        onCreateBot = onCreateBot,
                        updateState = updateState,
                        onInstallUpdate = onInstallUpdate,
                    )
                }
                val chatContent: @Composable (ConversationRecord, Boolean) -> Unit = { chat, compact ->
                    ChatScreen(
                        chat = chat,
                        compact = compact,
                        loading = loading,
                        onBack = onBackToFleet,
                        onSend = onSend,
                        onRespond = onRespond,
                        onInterrupt = onInterrupt,
                    )
                }
                val settingsContent: @Composable () -> Unit = {
                    SettingsScreen(
                        connection = activeConnection,
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
                        onSetAutoModel = onSetAutoModel,
                        onCreateTeam = onCreateTeam,
                        onJoinTeam = onJoinTeam,
                        onLeaveTeam = onLeaveTeam,
                        onTransferTeam = onTransferTeam,
                        onDisconnect = { confirmDisconnect = true },
                        updateState = updateState,
                        appVersion = appVersion,
                        onCheckForUpdates = onCheckForUpdates,
                        onInstallUpdate = onInstallUpdate,
                        onDownloadApk = onDownloadApk,
                    )
                }

                BoxWithConstraints(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    val twoPane = TabletLayout.isTwoPane(maxWidth.value, maxHeight.value)
                    BackHandler(enabled = settingsOpen || (!twoPane && activeChatKey != null)) {
                        if (settingsOpen) onCloseSettings() else onBackToFleet()
                    }
                    if (twoPane) {
                        val fleetWidth = TabletLayout.fleetPaneWidthDp(maxWidth.value).dp
                        Row(modifier = Modifier.fillMaxSize()) {
                            Box(modifier = Modifier.width(fleetWidth).fillMaxHeight()) {
                                fleetContent(activeChatKey)
                            }
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .width(1.dp)
                                    .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
                            )
                            Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                                when {
                                    settingsOpen -> settingsContent()
                                    activeChat != null -> chatContent(activeChat, false)
                                    else -> TabletEmptyState()
                                }
                            }
                        }
                    } else {
                        when {
                            settingsOpen -> settingsContent()
                            activeChat != null -> chatContent(activeChat, true)
                            else -> fleetContent(null)
                        }
                    }
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
    onLogin: (String, String, String) -> Unit,
) {
    var server by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable(invite?.address) { mutableStateOf(invite?.address.orEmpty()) }
    var credential by rememberSaveable(invite?.credential) { mutableStateOf(invite?.credential.orEmpty()) }
    val canLogin = server.isNotBlank() && email.isNotBlank() && password.isNotBlank()
    val canPair = address.isNotBlank() && credential.isNotBlank()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start,
    ) {
        Text("KodBot", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Sign in or pair this phone", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(10.dp))
        Text(
            "Your agents keep running on the KodBot server. Sign in with your account, or pair this phone with a local Companion.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.size(22.dp))

        Text("Hosted account", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(8.dp))
        OutlinedTextField(
            value = server,
            onValueChange = { server = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Server address") },
            placeholder = { Text("https://kodbot.example.com") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
        )
        Spacer(Modifier.size(10.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it.trim() },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
        )
        Spacer(Modifier.size(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (canLogin && !loading) onLogin(server, email, password) }),
        )
        Spacer(Modifier.size(12.dp))
        Button(
            onClick = { onLogin(server, email, password) },
            modifier = Modifier.fillMaxWidth(),
            enabled = canLogin && !loading,
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("Sign in")
        }

        Spacer(Modifier.size(26.dp))
        Text("Local Companion", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(6.dp))
        Text(
            "Pair directly with a KodBot computer on your LAN or Tailscale network.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.size(12.dp))
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
        Spacer(Modifier.size(10.dp))
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
        Spacer(Modifier.size(12.dp))
        Button(
            onClick = { onPair(address, credential) },
            modifier = Modifier.fillMaxWidth(),
            enabled = canPair && !loading,
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("Pair with computer")
        }
        Spacer(Modifier.size(14.dp))
        Text(
            "On Linux: KodBot → Settings → Companion → Set up a phone. Use the shown LAN address on trusted Wi-Fi, or a Tailscale address when away.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private sealed interface FleetRow {
    data class Header(val key: String, val title: String, val count: Int) : FleetRow
    data class Chat(val chat: ConversationRecord) : FleetRow
}

@Composable
private fun FleetChatCard(
    chat: ConversationRecord,
    selected: Boolean,
    onSelectChat: (ConversationRecord) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onSelectChat(chat) },
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.surfaceVariant
            else MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (chat.kind == "group") {
                Surface(modifier = Modifier.size(38.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                    BoxCenter {
                        Text("G", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                BotAvatar(color = chat.color, name = chat.name, size = 44.dp, role = chat.role, shape = chat.mascotShape)
            }
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        chat.name,
                        modifier = Modifier.weight(1f, fill = false),
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (chat.teamIsLeader) {
                        Text(
                            "  leader",
                            style = MaterialTheme.typography.labelSmall,
                            color = CrewGreen,
                        )
                    }
                }
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

@Composable
private fun FleetScreen(
    connection: CompanionConnection,
    chats: List<ConversationRecord>,
    showHiddenBots: Boolean,
    showGroups: Boolean,
    loading: Boolean,
    selectedChatKey: String? = null,
    onSelectChat: (ConversationRecord) -> Unit,
    onRefresh: () -> Unit,
    onSettings: () -> Unit,
    onCreateBot: () -> Unit,
    updateState: UpdateUiState,
    onInstallUpdate: () -> Unit,
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
        updateState.info?.let { update ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                colors = CardDefaults.cardColors(containerColor = CrewGreen.copy(alpha = 0.12f)),
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "KodBot ${update.versionName} is available",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = CrewGreen,
                            )
                            if (update.notes.isNotBlank()) {
                                Text(
                                    update.notes,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        if (updateState.downloading) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Button(onClick = onInstallUpdate) { Text("Update") }
                        }
                    }
                    updateState.error?.let {
                        Text(
                            it,
                            modifier = Modifier.padding(top = 6.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFFF8A80),
                        )
                    }
                }
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
            val sortedChats = visibleChats.sortedWith(
                compareByDescending<ConversationRecord> { it.unread }.thenByDescending { it.busy },
            )
            val rooms = sortedChats.filter { it.kind == "group" }
            val bots = sortedChats.filter { it.kind == "bot" }
            val namedTeams = bots
                .filter { !it.teamName.isNullOrBlank() }
                .groupBy { it.teamName.orEmpty() }
                .toSortedMap()
            val ungrouped = bots.filter { it.teamName.isNullOrBlank() }
            val rows = buildList<FleetRow> {
                if (rooms.isNotEmpty()) {
                    add(FleetRow.Header("rooms", "Rooms", rooms.size))
                    rooms.forEach { add(FleetRow.Chat(it)) }
                }
                namedTeams.forEach { (name, members) ->
                    add(FleetRow.Header("team:$name", name, members.size))
                    members.forEach { add(FleetRow.Chat(it)) }
                }
                if (ungrouped.isNotEmpty()) {
                    val title = when {
                        namedTeams.isNotEmpty() -> "Other bots"
                        rooms.isNotEmpty() -> "Bots"
                        else -> null
                    }
                    if (title != null) add(FleetRow.Header("ungrouped", title, ungrouped.size))
                    ungrouped.forEach { add(FleetRow.Chat(it)) }
                }
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(
                    rows,
                    key = {
                        when (it) {
                            is FleetRow.Header -> "header:${it.key}"
                            is FleetRow.Chat -> it.chat.key
                        }
                    },
                ) { row ->
                    when (row) {
                        is FleetRow.Header -> Row(
                            modifier = Modifier.fillMaxWidth().padding(start = 4.dp, top = 10.dp, bottom = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                row.title,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                row.count.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f),
                            )
                        }
                        is FleetRow.Chat -> FleetChatCard(
                            chat = row.chat,
                            selected = row.chat.key == selectedChatKey,
                            onSelectChat = onSelectChat,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TabletEmptyState() {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Select a bot or room",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "The conversation will open here.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun ChatScreen(
    chat: ConversationRecord,
    compact: Boolean = true,
    loading: Boolean,
    onBack: () -> Unit,
    onSend: (ConversationRecord, String, List<PendingAttachment>, (Boolean) -> Unit) -> Unit,
    onRespond: (ConversationRecord, ApprovalCard, String) -> Unit,
    onInterrupt: (ConversationRecord) -> Unit,
) {
    var draft by rememberSaveable(chat.key) { mutableStateOf("") }
    var attachments by rememberSaveable(chat.key) { mutableStateOf(emptyList<PendingAttachment>()) }
    var sending by rememberSaveable(chat.key) { mutableStateOf(false) }
    var attachmentError by rememberSaveable(chat.key) { mutableStateOf<String?>(null) }
    var choosingAttachment by rememberSaveable(chat.key) { mutableStateOf(false) }
    val context = LocalContext.current
    val acceptPicked: (List<Uri>) -> Unit = { uris ->
        if (uris.isNotEmpty()) {
            val accepted = mutableListOf<PendingAttachment>()
            val rejected = mutableListOf<String>()
            for (uri in uris) {
                val picked = runCatching { attachmentFromUri(context, uri) }.getOrNull()
                when {
                    picked == null -> rejected += "a selected file"
                    picked.size > CompanionApi.MAX_ATTACHMENT_BYTES -> rejected += picked.name
                    else -> accepted += picked
                }
            }
            if (accepted.isNotEmpty()) {
                attachments = attachments + accepted
                attachmentError = null
            }
            if (rejected.isNotEmpty()) {
                attachmentError = "Couldn't attach ${rejected.distinct().joinToString(", ")}. " +
                    "Files must be 30 MB or smaller."
            }
        }
    }
    val pickDocuments = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { acceptPicked(it) }
    val pickPdf = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { acceptPicked(it) }
    val pickImages = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { acceptPicked(it) }
    val listState = rememberLazyListState()
    val workingItemIndex = chat.messages.lastIndex + if (chat.busy) 1 else 0
    LaunchedEffect(chat.messages.lastOrNull()?.id, chat.busy) {
        if (workingItemIndex >= 0) listState.animateScrollToItem(workingItemIndex)
    }

    val canSend = (draft.isNotBlank() || attachments.isNotEmpty()) && !loading && !sending
    // Upload first, then send. The draft and its chips stay put until the
    // host confirms, so a failed upload can be retried without retyping.
    val submit: () -> Unit = {
        if (canSend) {
            sending = true
            attachmentError = null
            onSend(chat, draft.trim(), attachments) { sent ->
                sending = false
                if (sent) {
                    draft = ""
                    attachments = emptyList()
                }
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (compact) TextButton(onClick = onBack) { Text("‹ Bots") }
            if (chat.kind == "group") {
                Surface(modifier = Modifier.size(34.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                    BoxCenter {
                        Text("G", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                BotAvatar(color = chat.color, name = chat.name, size = 36.dp, role = chat.role, shape = chat.mascotShape)
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
                item(key = "kodbot-working-indicator") {
                    WorkingBubble(group = chat.kind == "group")
                }
            }
        }
        if (attachments.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                attachments.forEach { attachment ->
                    AttachmentChip(
                        attachment = attachment,
                        enabled = !sending,
                        onRemove = {
                            attachments = attachments.filterNot { it.uri == attachment.uri }
                        },
                    )
                }
            }
        }
        attachmentError?.let { message ->
            Text(
                message,
                color = Color(0xFFFF8A80),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            IconButton(
                onClick = { choosingAttachment = true },
                enabled = !loading && !sending,
                modifier = Modifier
                    .padding(bottom = 4.dp)
                    .semantics { contentDescription = "Attach a file" },
            ) {
                Text("📎", fontSize = 20.sp)
            }
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message ${chat.name}") },
                maxLines = 5,
                enabled = !sending,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { submit() }),
            )
            Button(
                onClick = submit,
                enabled = canSend,
                modifier = Modifier.padding(bottom = 4.dp),
            ) {
                if (sending) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Text("Send")
                }
            }
        }
    }

    if (choosingAttachment) {
        AlertDialog(
            onDismissRequest = { choosingAttachment = false },
            title = { Text("Attach to message") },
            text = {
                Column {
                    TextButton(
                        onClick = {
                            choosingAttachment = false
                            pickImages.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("🖼  Photo or image") }
                    TextButton(
                        onClick = {
                            choosingAttachment = false
                            pickPdf.launch(arrayOf("application/pdf"))
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("📄  PDF") }
                    TextButton(
                        onClick = {
                            choosingAttachment = false
                            pickDocuments.launch(arrayOf("*/*"))
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("📎  Any file") }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { choosingAttachment = false }) { Text("Cancel") }
            },
        )
    }
}

/** Read the display name, byte size, and MIME type a document provider
 * exposes. Providers are allowed to omit any of them; the fallbacks keep the
 * chip useful without pretending a guessed size is real. */
private fun attachmentFromUri(context: Context, uri: Uri): PendingAttachment {
    val resolver = context.contentResolver
    var name = "attachment"
    var size = 0L
    resolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
        null,
        null,
        null,
    )?.use { cursor ->
        if (cursor.moveToFirst()) {
            val nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameColumn >= 0) {
                cursor.getString(nameColumn)?.takeIf(String::isNotBlank)?.let { name = it }
            }
            val sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) {
                size = cursor.getLong(sizeColumn).coerceAtLeast(0L)
            }
        }
    }
    return PendingAttachment(
        uri = uri.toString(),
        name = name,
        size = size,
        mimeType = resolver.getType(uri) ?: "application/octet-stream",
    )
}

@Composable
private fun AttachmentChip(
    attachment: PendingAttachment,
    enabled: Boolean,
    onRemove: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp, top = 6.dp, bottom = 6.dp, end = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.widthIn(max = 210.dp)) {
                Text(
                    attachment.name,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    formatAttachmentSize(attachment.size),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            IconButton(
                onClick = onRemove,
                enabled = enabled,
                modifier = Modifier.size(30.dp),
            ) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Remove ${attachment.name}",
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

private fun formatAttachmentSize(bytes: Long): String = when {
    bytes <= 0 -> "Size unknown"
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> String.format(java.util.Locale.US, "%.1f KB", bytes / 1024.0)
    else -> String.format(java.util.Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
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
        message.text.isNotBlank() -> {
            // Product lists arrive as a fenced JSON block. On the phone they
            // become tappable merchant cards; the fence itself must not leak
            // into the bubble. A malformed block stays as plain text.
            val block = remember(message.text, message.role) {
                if (message.role == "user") ProductCardsBlock(message.text, emptyList())
                else extractProductCards(message.text)
            }
            Row(
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
                        if (block.text.isNotBlank()) {
                            // Long-press to select and copy an answer, like any
                            // native text. Without this, a Compose Text is a
                            // single non-selectable drawing.
                            SelectionContainer {
                                Text(
                                    block.text,
                                    color = if (message.role == "user") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                )
                            }
                        }
                        if (block.items.isNotEmpty()) {
                            Spacer(Modifier.size(8.dp))
                            ProductCards(block.items)
                        }
                    }
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
