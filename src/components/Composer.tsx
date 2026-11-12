import { track } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Clock, Loader2, Mic, Paperclip, Reply, Square, Users, X } from "lucide-react";
import { useStore, visibleMessages, type Bot, type Group, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { useComposerDraft } from "@/lib/drafts";
import { CrewAvatar } from "./Avatar";
import { ComposerAttachments, pathForFile } from "./ComposerAttachments";
import {
  attachmentsFromDroppedFiles,
  composeMessage,
  isLongPaste,
  pasteAttachment,
  uploadRemoteAttachments,
  type Attachment,
} from "@/lib/composer-attachments";
import { displayRole, normalizeState } from "@/lib/mascot";
import { groupComposerHint } from "@/lib/group-routing";
import { PendingApprovalActions, PendingApprovalPanel, pendingApprovals } from "./PendingApproval";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { useI18n } from "@/lib/i18n";
import { promptQueue, queueKeyForBot, queueKeyForGroup } from "@/lib/send-queue";
import { BrowserPtt, browserPttSupported } from "@/lib/browser-ptt";
import { httpsVoiceUrl, microphoneIssue, type MicrophoneIssue } from "@/lib/voice-diagnostics";

/** The active @mention query at the caret: the text between an `@` that
 * starts a word and the caret. null = no mention being typed. */
function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null; // user@host, not a tag
  const query = upto.slice(at + 1);
  if (query.length > 24 || query.includes("@") || query.includes("\n")) return null;
  return { start: at, query };
}

type MentionChoice = { id: string; name: string; bot?: Bot };

export function Composer({
  bot,
  group,
  members,
  onEditLast,
  replyTo,
  onClearReply,
}: {
  bot?: Bot;
  group?: Group;
  members?: Bot[];
  onEditLast?: () => void;
  /** The message the next send answers; shown as a quote above the input. */
  replyTo?: Message | null;
  onClearReply?: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const { capabilities } = useDesktopCapabilities();
  // Unified target: a 1:1 bot thread or a room. In a room the @ picker
  // offers members plus @everyone; explicit mentions override the room's
  // configured default responder.
  const busy = group ? Boolean(group.busyBotId) : Boolean(bot?.busy);
  // a pending approval blocks the prompt until it is answered
  const threadId = group?.threadId ?? bot?.threadId ?? "";
  // the VISIBLE branch only — an approval left on a branch you edited away
  // from must not keep blocking the composer
  const approvals = pendingApprovals(group ? group.messages : bot ? visibleMessages(bot) : []);
  const approval = approvals[0];
  const approvalBot = group
    ? members?.find((b) => b.id === approval?.message.from?.botId) ??
      members?.find((b) => b.id === group.busyBotId)
    : bot;
  const busyName = group
    ? (members?.find((b) => b.id === group.busyBotId)?.name ?? t("A bot"))
    : (bot?.name ?? t("The bot"));
  // Per-thread draft: switching bots unmounts this component, so both the
  // text and its attachment chips have to outlive it (see lib/drafts).
  const [text, setText, attachments, setAttachments] = useComposerDraft(
    group ? `group:${group.id}` : `bot:${bot?.id ?? ""}`,
  );
  const addAttachments = useCallback(
    (next: Attachment[]) => setAttachments((prev) => [...prev, ...next]),
    [setAttachments],
  );
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const { attachments: next, rejectedNames } = await attachmentsFromDroppedFiles(files, pathForFile);
      if (next.length) {
        addAttachments(next);
        setUploadError(null);
      }
      if (rejectedNames.length) {
        setUploadError(
          t("Could not attach {names}. Choose a file saved on this computer.", {
            names: rejectedNames.join(", "),
          }),
        );
      }
    },
    [addAttachments, t],
  );
  const removeAttachment = useCallback(
    (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    [setAttachments],
  );
  const [recording, setRecording] = useState<"native" | "browser" | null>(null);
  const [browserStarting, setBrowserStarting] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null); // Esc'd this @
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const browserPtt = useRef<BrowserPtt | null>(null);
  // what was typed before the mic went on — partials append after it
  const baseText = useRef("");
  const nativeMic = capabilities.dictation.available && Boolean(window.ogb?.speechStart);
  const browserMic = !nativeMic && browserPttSupported();
  const micIssue: MicrophoneIssue =
    typeof window === "undefined"
      ? null
      : microphoneIssue({
          secureContext: window.isSecureContext,
          hostname: window.location.hostname,
          hasMediaDevices:
            typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
          hasMediaRecorder: typeof MediaRecorder !== "undefined",
        });
  const httpsUrl = httpsVoiceUrl(
    typeof window === "undefined" ? "https:" : window.location.protocol,
    typeof window === "undefined" ? "localhost" : window.location.hostname,
    typeof window === "undefined" ? "" : window.location.port,
  );
  const micIssueMessage = (issue: Exclude<MicrophoneIssue, null>) =>
    issue === "insecure"
      ? t("Microphone needs HTTPS. Open {url} or use the desktop app.", { url: httpsUrl })
      : t("This browser can't record audio.");
  // Keep the mic visible on an HTTP origin too: a button that explains the
  // HTTPS requirement is more useful than a button that quietly disappears.
  const micVisible = nativeMic || browserMic || micIssue !== null;

  // ── @mention picker (tag another bot; the agent reaches it via ask_bot) ──
  const mention = mentionQueryAt(text, caret);
  const candidates = useMemo(() => {
    if (!mention || mention.start === dismissedAt) return [];
    const pool: MentionChoice[] = group
      ? [
          { id: "__everyone__", name: "everyone" },
          ...(members ?? []).map((member) => ({ id: member.id, name: member.name, bot: member })),
        ]
      : state.bots
          .filter((member) => member.id !== bot?.id && !member.hidden)
          .map((member) => ({ id: member.id, name: member.name, bot: member }));
    const q = mention.query.trim().toLowerCase();
    // "@Scout " — the full name plus a space — is a COMPLETED tag, not a
    // search: keep the picker closed so Enter sends instead of re-picking
    if (mention.query.endsWith(" ") && pool.some((b) => b.name.toLowerCase() === q)) return [];
    return pool.filter((b) => !q || b.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, dismissedAt, state.bots, bot?.id, group, members]);
  const pickerOpen = candidates.length > 0;

  useEffect(() => setHighlight(0), [mention?.start, mention?.query]);

  // grow the textarea with its content (capped by max-h in the className)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Picking "reply" on a message should land the caret in the composer.
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const pickMention = (peer: MentionChoice) => {
    if (!mention) return;
    const after = text.slice(caret);
    const next = `${text.slice(0, mention.start)}@${peer.name} ${after}`;
    setText(next);
    const newCaret = mention.start + peer.name.length + 2;
    setCaret(newCaret);
    // picking completes this tag — close the popup so the next Enter sends
    setDismissedAt(mention.start);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  // While a target is busy, sends wait in the app-wide queue above the
  // composer (see lib/send-queue). They are not written into the transcript
  // until they actually start, so a queued prompt never sits in the chat as a
  // stale bubble. The drainer lives outside this component: switching chats
  // unmounts the composer but a queued backlog must still go out.
  const queueKey = group ? queueKeyForGroup(group.id) : queueKeyForBot(bot?.id ?? "");
  const [queued, setQueued] = useState(() => promptQueue.prompts(queueKey));
  useEffect(() => {
    setQueued(promptQueue.prompts(queueKey));
    return promptQueue.subscribe(() => setQueued(promptQueue.prompts(queueKey)));
  }, [queueKey]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // a chip on its own is a message: the send control has to appear for it
  const hasContent = Boolean(text.trim()) || attachments.length > 0;
  const submit = (composed: string) => {
    if (!composed) return;
    const replyToId = replyTo?.id;
    if (busy) {
      promptQueue.enqueue(
        queueKey,
        composed,
        replyTo
          ? {
              id: replyTo.id,
              role: replyTo.role,
              text: replyTo.text ?? "",
              name:
                replyTo.from?.name ??
                (replyTo.role === "bot" ? (bot?.name ?? t("A bot")) : t("You")),
            }
          : undefined,
      );
      setText("");
      setAttachments([]);
      onClearReply?.();
      return;
    }
    if (group) {
      dispatch({ type: "sendGroup", groupId: group.id, text: composed, replyTo: replyToId });
      track("message_sent", { room: true });
    } else if (bot) {
      dispatch({ type: "send", botId: bot.id, text: composed, replyTo: replyToId });
      track("message_sent", { driver: bot.modelSelection?.instanceId });
    }
    setText("");
    setAttachments([]);
    onClearReply?.();
  };
  const send = () => {
    if (uploading) return;
    const local = composeMessage(text, attachments);
    if (!local) return;
    // In remote mode a local path is meaningless to the agent. Upload the
    // bytes first and put the host's stored path in the prompt instead.
    const needsUpload = capabilities.remoteMode && attachments.some((a) => a.kind === "file");
    if (!needsUpload) {
      submit(local);
      return;
    }
    setUploading(true);
    setUploadError(null);
    void uploadRemoteAttachments(attachments)
      .then((ready) => {
        const composed = composeMessage(text, ready);
        if (composed) submit(composed);
      })
      .catch((error) => setUploadError(error instanceof Error ? error.message : String(error)))
      .finally(() => setUploading(false));
  };
  // The app-wide drainer sends one queued prompt per busy → idle transition
  // (see components/SendQueueDrainer), so this component only shows the
  // backlog and adds to it.

  // native dictation: partials stream into the input while the Swift
  // helper runs; the final transcript stays in the box, ready to edit/send
  useEffect(() => {
    if (recording !== "native") return;
    const bridge = window.ogb;
    if (!bridge) {
      setRecording(null);
      return;
    }
    setSpeechError(null);
    const offTranscript = bridge.onSpeechTranscript((line) => {
      if (typeof line.text === "string") {
        const base = baseText.current;
        setText(base ? `${base} ${line.text}` : line.text);
      }
    });
    const offEnd = bridge.onSpeechEnd(({ code }) => {
      setRecording(null);
      if (code === 2) {
        setSpeechError(t("Dictation is only available on macOS for now."));
      } else if (code === 1) {
        setSpeechError(
          t("Dictation needs Microphone + Speech Recognition access — System Settings → Privacy & Security."),
        );
      }
    });
    void bridge.speechStart();
    return () => {
      offTranscript();
      offEnd();
      void bridge.speechStop();
    };
  }, [recording, t]);

  const toggleMic = () => {
    if (!nativeMic || !window.ogb) {
      setSpeechError(t("Dictation isn't available in this build."));
      return;
    }
    baseText.current = text.trim();
    setRecording((current) => (current === "native" ? null : "native"));
  };

  const startBrowserMic = async () => {
    if (!browserMic || recording || browserStarting) return;
    setSpeechError(null);
    baseText.current = text.trim();
    const ptt = new BrowserPtt();
    setBrowserStarting(true);
    try {
      await ptt.start();
      browserPtt.current = ptt;
      setRecording("browser");
    } catch (error) {
      ptt.cancel();
      setSpeechError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setBrowserStarting(false);
    }
  };

  const stopBrowserMic = async () => {
    const ptt = browserPtt.current;
    browserPtt.current = null;
    setRecording(null);
    if (!ptt) return;
    try {
      const transcript = await ptt.stop();
      if (transcript) {
        const base = baseText.current;
        setText(base ? `${base} ${transcript}` : transcript);
      }
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleBrowserMic = () => {
    if (recording === "browser") {
      void stopBrowserMic();
      return;
    }
    if (browserStarting) return;
    if (micIssue) {
      setSpeechError(micIssueMessage(micIssue));
      return;
    }
    void startBrowserMic().catch(() => {});
  };

  const cancelBrowserMic = () => {
    browserPtt.current?.cancel();
    browserPtt.current = null;
    setRecording(null);
    setBrowserStarting(false);
  };

  useEffect(() => () => cancelBrowserMic(), []);

  return (
    <div className="px-5 pb-5 pt-2">
      {uploadError && (
        <div className="mx-auto mb-2 flex max-w-[900px] items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          <span className="min-w-0 flex-1">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            aria-label={t("Dismiss")}
            className="shrink-0 rounded p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {speechError && (
        <div className="mx-auto mb-2 max-w-[900px] rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          {speechError}
        </div>
      )}
      <div className="relative mx-auto max-w-[900px]">
        {queued.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-hairline/50 bg-panel shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 border-b border-hairline/40 px-3 py-2 text-[11px] font-medium text-ink-secondary">
              <Clock size={12} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {t("Queued")} · {queued.length} · {busyName}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {queued.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 border-b border-hairline/25 px-3 py-2 last:border-b-0"
                >
                  <span className="mt-px w-4 shrink-0 text-right font-mono text-[10.5px] text-ink-secondary/70">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-pre-wrap break-words text-[12px] leading-snug text-ink line-clamp-2">
                      {item.text}
                    </span>
                    {item.replyTo && (
                      <span className="mt-0.5 block truncate text-[10.5px] text-ink-secondary/70">
                        ↪ {item.replyTo.name}: {item.replyTo.text}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => promptQueue.drop(queueKey, item.id)}
                    aria-label={t("Discard queued message")}
                    title={t("Discard queued message")}
                    className="shrink-0 rounded p-0.5 text-ink-secondary hover:bg-raised hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {pickerOpen && (
          <div
            role="listbox"
            aria-label={t("Tag a bot")}
            className="absolute bottom-full left-2 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-hairline/40 bg-raised shadow-lg"
          >
            {candidates.map((peer, i) => (
              <button
                key={peer.id}
                role="option"
                aria-selected={i === highlight}
                onClick={() => pickMention(peer)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                  i === highlight ? "bg-raised-hover" : "",
                )}
              >
                {peer.bot ? (
                  <CrewAvatar
                    color={peer.bot.color}
                    shape={peer.bot.mascotShape}
                    role={displayRole(peer.bot)}
                    state={normalizeState(peer.bot.mascotExpression) ?? "happy"}
                    size={24}
                  />
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-raised text-ink-secondary">
                    <Users size={14} aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{peer.name}</span>
                <span className="shrink-0 text-xs text-ink-secondary">{peer.bot ? "Agent" : "Room"}</span>
              </button>
            ))}
          </div>
        )}
        {/* An approval takes over the composer: you answer it before you
            can type again, so a waiting bot is impossible to miss. */}
        {approval && (
          <div className="mb-2 overflow-hidden rounded-2xl border border-accent/40 bg-card">
            <PendingApprovalPanel pending={approval} count={approvals.length} index={0} />
            <PendingApprovalActions
              pending={approval}
              threadId={threadId}
              bot={approvalBot}
              onCancelTurn={() => {
                if (group) dispatch({ type: "interruptGroup", groupId: group.id });
                else if (bot) dispatch({ type: "interrupt", botId: bot.id });
              }}
            />
          </div>
        )}
        <ComposerAttachments
          items={attachments}
          onAdd={addAttachments}
          onRemove={removeAttachment}
        />
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-hairline/40 bg-raised/60 px-3 py-2">
            <Reply size={13} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-secondary">
                {replyTo.from?.name ?? (replyTo.role === "bot" ? (bot?.name ?? t("A bot")) : t("You"))}
              </div>
              <div className="line-clamp-2 whitespace-pre-wrap text-[12px] leading-snug text-ink-secondary">
                {replyTo.text}
              </div>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              aria-label={t("Cancel reply")}
              title={t("Cancel reply")}
              className="shrink-0 rounded p-0.5 text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="composer-frame flex items-end gap-2 rounded-3xl border border-hairline/40 bg-raised/60 py-2 pl-3 pr-2 transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(approval)}
          aria-label={t("Attach files")}
          title={t("Attach files")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          <Paperclip size={17} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Reset first so choosing the same file twice still fires.
            event.target.value = "";
            void addFiles(files);
          }}
        />
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissedAt(null);
          }}
          onPaste={(e) => {
            // a wall of text becomes a chip instead of burying the input
            const pasted = e.clipboardData.getData("text/plain");
            if (!isLongPaste(pasted)) return;
            e.preventDefault();
            // Preserve native paste replacement semantics: if text was
            // selected, the attachment replaces that selection.
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            if (start !== end) {
              setText(`${text.slice(0, start)}${text.slice(end)}`);
              setCaret(start);
            }
            setAttachments((prev) => [...prev, pasteAttachment(pasted)]);
          }}
          onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (pickerOpen) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setHighlight((h) => (h + delta + candidates.length) % candidates.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickMention(candidates[highlight]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDismissedAt(mention?.start ?? null);
                return;
              }
            }
            // an empty composer + ArrowUp = edit your last message (like a chat app)
            if (e.key === "ArrowUp" && !hasContent && onEditLast) {
              e.preventDefault();
              onEditLast();
              return;
            }
            // Shift+Enter inserts a newline; plain Enter sends
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
            if (e.key === "Escape" && recording) {
              if (recording === "browser") cancelBrowserMic();
              else setRecording(null);
            }
          }}
          disabled={Boolean(approval)}
          spellCheck
          autoCorrect="on"
          placeholder={
            approval
              ? t("Answer the approval above to continue")
              : recording
              ? t("Listening…")
              : busy
                ? group
                  ? t("{name} is working — Enter queues your message", { name: busyName })
                  : t("{name} is working — sends when this turn finishes", { name: busyName })
                : group
                  ? t("Message {name} — {hint}", {
                      name: group.name,
                      hint: groupComposerHint(group, members ?? []),
                    })
                  : t("Message {name}", { name: bot?.name ?? "" })
          }
          aria-label={t("Message {name}", { name: group ? group.name : (bot?.name ?? "") })}
          className="composer-textarea max-h-40 w-full resize-none self-center bg-transparent px-1 py-1 text-[15px] leading-6 text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        {busy && (
          <button
            onClick={() => {
              if (group) dispatch({ type: "interruptGroup", groupId: group.id });
              else if (bot) dispatch({ type: "interrupt", botId: bot.id });
            }}
            aria-label={t("Stop this turn")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-raised hover:text-ink"
            title={t("Stop")}
          >
            <Square size={14} className="fill-current" />
          </button>
        )}
        {!busy && micVisible && (
          <button
            onClick={nativeMic ? toggleMic : toggleBrowserMic}
            aria-label={recording ? t("Stop dictation") : t("Start dictation")}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              recording
                ? "animate-pulse bg-danger/20 text-danger"
                : "text-ink-secondary hover:bg-raised hover:text-ink",
            )}
            title={
              recording
                ? t("Stop dictation (Esc)")
                : browserMic
                  ? t("Click to talk")
                  : nativeMic
                    ? t("Dictate")
                    : t("Microphone unavailable")
            }
          >
            {browserStarting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : recording === "browser" ? (
              <Square size={14} className="fill-current" />
            ) : (
              <Mic size={18} />
            )}
          </button>
        )}
        {hasContent && (
          <button
            onClick={send}
            disabled={uploading}
            aria-label={uploading ? t("Uploading attachment") : busy ? t("Queue message") : t("Send message")}
            title={uploading ? t("Uploading attachment…") : busy ? t("Sends when the current turn finishes") : t("Send")}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-white",
              busy ? "bg-raised text-ink-secondary hover:bg-raised-hover" : "bg-accent hover:brightness-110",
              uploading && "cursor-default opacity-70",
            )}
          >
            {uploading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : busy ? (
              <Clock size={15} />
            ) : (
              <ArrowUp size={17} />
            )}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
