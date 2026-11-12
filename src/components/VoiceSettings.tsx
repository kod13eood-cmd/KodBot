// Voice, in App Settings. Provider, key, voice list, and a live test for both
// directions: the microphone transcribes a short clip, the speaker plays the
// selected voice. The test is deliberately here rather than only in the
// composer so a Linux/HTTPS/permission problem names itself once.
//
// The voice list comes from the harness, which holds the key — the renderer
// never talks to ElevenLabs itself.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, Volume2 } from "lucide-react";

import { api, useStore, type ConfigStatus } from "@/state/store";
import { speaker } from "@/lib/tts";
import { useSpeech } from "@/lib/tts/useSpeech";
import { BrowserPtt } from "@/lib/browser-ptt";
import { httpsVoiceUrl, microphoneIssue, type MicrophoneIssue } from "@/lib/voice-diagnostics";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

const SAMPLE = "Morning. Overnight the tests went green, and I left two notes for you in the thread.";

type MicState = "idle" | "starting" | "recording" | "transcribing";

export function VoiceSettings() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const tts = state.config?.tts;
  const speech = useSpeech();

  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Array<{ id: string; label: string; description?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const pttRef = useRef<BrowserPtt | null>(null);

  const provider = tts?.provider ?? (tts?.configured ? "elevenlabs" : "local");
  const local = provider === "local";
  const configured = local ? Boolean(tts?.ready) : Boolean(tts?.configured);

  const hasMediaDevices =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasMediaRecorder = typeof MediaRecorder !== "undefined";
  const hostname = typeof window === "undefined" ? "localhost" : window.location.hostname;
  const issue: MicrophoneIssue =
    typeof window === "undefined"
      ? null
      : microphoneIssue({
          secureContext: window.isSecureContext,
          hostname,
          hasMediaDevices,
          hasMediaRecorder,
        });
  const httpsUrl = httpsVoiceUrl(
    typeof window === "undefined" ? "https:" : window.location.protocol,
    hostname,
    typeof window === "undefined" ? "" : window.location.port,
  );
  const issueMessage = useCallback(
    (value: Exclude<MicrophoneIssue, null>) =>
      value === "insecure"
        ? t("Microphone needs HTTPS. Open {url} or use the desktop app.", { url: httpsUrl })
        : t("This browser can't record audio."),
    [httpsUrl, t],
  );

  useEffect(() => {
    if (!configured) {
      setVoices([]);
      return;
    }
    let alive = true;
    setLoadingVoices(true);
    api("/api/tts/voices")
      .then((r: { voices?: typeof voices; error?: string }) => {
        if (!alive) return;
        setVoices(r.voices ?? []);
        if (r.error) setError(r.error);
      })
      .catch(() => alive && setVoices([]))
      .finally(() => alive && setLoadingVoices(false));
    return () => {
      alive = false;
    };
  }, [configured]);

  useEffect(
    () => () => {
      pttRef.current?.cancel();
      pttRef.current = null;
    },
    [],
  );

  const save = (patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    return api("/api/config", { method: "PUT", body: JSON.stringify({ tts: patch }) })
      .then((status: ConfigStatus) => {
        dispatch({ type: "configStatus", config: status });
        setKey("");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const startMicTest = async () => {
    if (issue) {
      setMicError(issueMessage(issue));
      return;
    }
    if (micState !== "idle") return;
    setMicError(null);
    setTranscript("");
    setMicState("starting");
    const ptt = new BrowserPtt();
    try {
      await ptt.start();
      pttRef.current = ptt;
      setMicState("recording");
    } catch (cause) {
      ptt.cancel();
      setMicError(cause instanceof Error ? cause.message : String(cause));
      setMicState("idle");
    }
  };

  const stopMicTest = useCallback(async () => {
    const ptt = pttRef.current;
    pttRef.current = null;
    if (!ptt) {
      setMicState("idle");
      return;
    }
    setMicState("transcribing");
    try {
      const text = await ptt.stop();
      setTranscript(text || t("No speech detected."));
    } catch (cause) {
      setMicError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setMicState("idle");
    }
  }, [t]);

  useEffect(() => {
    if (micState !== "recording") return;
    const timer = window.setTimeout(() => void stopMicTest(), 20_000);
    return () => window.clearTimeout(timer);
  }, [micState, stopMicTest]);

  const playTest = () => {
    if (speech.status !== "idle") {
      speaker.stop();
      return;
    }
    void speaker.speak(SAMPLE, { voiceId: tts?.voice || undefined });
  };

  if (!tts) return null;

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-[15px] font-medium text-ink">{t("Voice")}</div>
      <div className="mt-0.5 text-[13px] text-ink-secondary">
        {local
          ? t("Read replies aloud and turn speech into text with local models. No audio leaves this computer.")
          : t("Read replies aloud and talk to your bots, using your own ElevenLabs account. Billed per character by ElevenLabs.")}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {([
          ["local", t("Local (free)")],
          ["elevenlabs", t("ElevenLabs")],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => void save({ provider: value, ...(value === "local" ? { voice: "" } : {}) })}
            aria-pressed={provider === value}
            disabled={saving}
            className={cn(
              "rounded-lg border px-3 py-2 text-[13px] transition-colors disabled:opacity-50",
              provider === value
                ? "border-accent/50 bg-accent/10 text-ink"
                : "border-hairline/40 text-ink-secondary hover:bg-raised/60 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {local && !tts.ready && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] leading-relaxed text-warning">
          {t("Local voice is not installed on the harness yet. Run scripts/setup-local-voice.sh on the server, then refresh.")}
        </div>
      )}

      {!local && <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
          <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
          <span>{t("ElevenLabs key")}</span>
          {configured && <span className="text-[11px] text-success">{t("Connected")}</span>}
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && key.trim() && void save({ key: key.trim() })}
            placeholder={configured ? t("••••••••  (paste to replace)") : t("Paste your ElevenLabs API key")}
            aria-label={t("ElevenLabs key")}
            autoComplete="off"
            className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <button
            onClick={() => key.trim() && void save({ key: key.trim() })}
            disabled={saving || !key.trim()}
            className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-raised py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} />{t("Save")}</>}
          </button>
        </div>
        {!configured && (
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-[12px] font-medium text-accent hover:underline"
          >
            {t("Get a key from ElevenLabs")}
          </a>
        )}
      </div>}

      {configured && (
        <div className="mt-4">
          <div className="mb-1.5 text-[13px] text-ink-secondary">{local ? t("Local voice") : t("Voice")}</div>
          <select
            value={tts.voice}
            onChange={(e) => void save({ voice: e.target.value })}
            aria-label={t("Voice")}
            className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
          >
            <option value="">
              {loadingVoices
                ? t("Loading voices…")
                : local
                  ? t("Auto (BG / EN)")
                  : t("Pick a voice")}
            </option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.description ? ` — ${v.description}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 border-t border-hairline/40 pt-4">
        <div className="text-[13px] font-medium text-ink">{t("Voice test")}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
          {t("Check the microphone and the spoken voice before you rely on them in a chat.")}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void (micState === "recording" ? stopMicTest() : startMicTest())}
            disabled={micState === "starting" || micState === "transcribing"}
            className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-raised px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {micState === "recording" ? (
              <Square size={13} className="fill-current" />
            ) : micState === "starting" || micState === "transcribing" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Mic size={14} />
            )}
            {micState === "recording"
              ? t("Stop and transcribe")
              : micState === "transcribing"
                ? t("Transcribing…")
                : micState === "starting"
                  ? t("Starting…")
                  : t("Test microphone")}
          </button>
          <button
            type="button"
            onClick={playTest}
            disabled={!tts.ready && speech.status === "idle"}
            className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-raised px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {speech.status === "speaking" ? (
              <Square size={13} className="fill-current" />
            ) : speech.status === "preparing" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Volume2 size={14} />
            )}
            {speech.status === "speaking"
              ? t("Stop")
              : speech.status === "preparing"
                ? t("Preparing…")
                : t("Play test")}
          </button>
        </div>

        {issue && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] leading-relaxed text-warning">
            {issueMessage(issue)}
            {issue === "insecure" && (
              <>
                {" "}
                <a href={httpsUrl} className="font-medium underline">
                  {httpsUrl}
                </a>
              </>
            )}
          </div>
        )}
        {micError && <div className="mt-2 text-[12px] text-danger">{micError}</div>}
        {transcript && (
          <div className="mt-2 rounded-lg border border-hairline/40 bg-inset px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-ink-secondary">{t("Transcript")}</div>
            <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{transcript}</div>
          </div>
        )}
        {speech.error && <div className="mt-2 text-[12px] text-danger">{speech.error}</div>}
      </div>

      {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
    </div>
  );
}
