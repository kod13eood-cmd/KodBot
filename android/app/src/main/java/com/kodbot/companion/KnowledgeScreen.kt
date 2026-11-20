package com.kodbot.companion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

/** Global + per-team shared knowledge, editable from the phone. */
@Composable
fun KnowledgeDialog(connection: CompanionConnection, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<KnowledgeResponse?>(null) }
    var selected by remember { mutableStateOf("global") }
    var core by remember { mutableStateOf("") }
    var topics by remember { mutableStateOf(emptyList<KnowledgeTopicRecord>()) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }

    fun apply(next: KnowledgeResponse) {
        data = next
        val book = if (selected == "global") next.global else next.teams.firstOrNull { it.id == selected }?.book
        core = book?.core.orEmpty()
        topics = book?.topics.orEmpty()
    }

    LaunchedEffect(Unit) {
        try {
            apply(CompanionApi(connection).knowledge())
        } catch (cause: Exception) {
            error = cause.message ?: "Couldn't load knowledge."
        } finally {
            loading = false
        }
    }

    Dialog(onDismissRequest = onClose) {
        Surface(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(0.92f),
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.background,
        ) {
            Column(modifier = Modifier.fillMaxHeight().verticalScroll(rememberScrollState()).padding(16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(tr("Shared knowledge"), style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = onClose) { Text(tr("Close")) }
                }
                Text(
                    tr("Global is visible to every bot. Keep client-sensitive material in a team book or a topic."),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(
                        onClick = {
                            selected = "global"
                            core = data?.global?.core.orEmpty()
                            topics = data?.global?.topics.orEmpty()
                        },
                    ) { Text(tr("All bots")) }
                    data?.teams?.forEach { team ->
                        TextButton(
                            onClick = {
                                selected = team.id
                                core = team.book.core
                                topics = team.book.topics
                            },
                        ) { Text(team.name) }
                    }
                }

                if (loading) {
                    Text(tr("Loading…"), modifier = Modifier.padding(vertical = 20.dp))
                } else {
                    OutlinedTextField(
                        value = core,
                        onValueChange = { core = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(tr("Core")) },
                        minLines = 8,
                        maxLines = 18,
                    )
                    Text(
                        tr("Short and durable: owner, mission, active projects, skills, and preferences."),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Text(tr("Topics"), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 14.dp))
                    topics.forEachIndexed { index, topic ->
                        Card(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                OutlinedTextField(
                                    value = topic.title,
                                    onValueChange = { value ->
                                        topics = topics.toMutableList().also { it[index] = topic.copy(title = value) }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    label = { Text(tr("Topic title")) },
                                    singleLine = true,
                                )
                                OutlinedTextField(
                                    value = topic.body,
                                    onValueChange = { value ->
                                        topics = topics.toMutableList().also { it[index] = topic.copy(body = value) }
                                    },
                                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                                    label = { Text(tr("Text")) },
                                    minLines = 3,
                                    maxLines = 8,
                                )
                                TextButton(onClick = {
                                    topics = topics.toMutableList().also { it.removeAt(index) }
                                }) { Text(tr("Remove topic")) }
                            }
                        }
                    }
                    TextButton(onClick = {
                        topics = topics + KnowledgeTopicRecord(id = null, title = "", body = "")
                    }) { Text(tr("Add topic")) }

                    error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                    }
                    message?.let {
                        Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                    }
                    val savedMessage = tr("Saved. The next turn picks it up.")
                    Button(
                        onClick = {
                            if (!saving) {
                            saving = true
                            error = null
                            message = null
                            scope.launch {
                                try {
                                    val saved = CompanionApi(connection).saveKnowledge(
                                        selected,
                                        KnowledgeBookRecord(core = core, topics = topics),
                                    )
                                    data = data?.let { current ->
                                        if (selected == "global") current.copy(global = saved)
                                        else current.copy(teams = current.teams.map { team ->
                                            if (team.id == selected) team.copy(book = saved) else team
                                        })
                                    }
                                    core = saved.core
                                    topics = saved.topics
                                    message = savedMessage
                                } catch (cause: Exception) {
                                    error = cause.message ?: "Couldn't save knowledge."
                                } finally {
                                    saving = false
                                }
                            }
                            }
                        },
                        enabled = !saving,
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    ) {
                        Text(if (saving) tr("Saving…") else tr("Save knowledge"))
                    }
                }
            }
        }
    }
}
