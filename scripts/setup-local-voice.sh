#!/usr/bin/env sh
# Provision local, offline voice for KodBot on Linux x86_64.
#
# Audio never leaves the machine: faster-whisper transcribes in Python and
# Piper synthesizes WAV. Models live under the harness data directory.
set -eu

ROOT="${OC_DATA_DIR:-${HOME}/.kodbot}/voice"
WHISPER_RELEASE="b5454"
WHISPER_URL="https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE}/whisper-bin-ubuntu-x64.tar.gz"
WHISPER_MODEL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
VOICE_BG="https://huggingface.co/rhasspy/piper-voices/resolve/main/bg/bg_BG/dimitar/medium/bg_BG-dimitar-medium"
VOICE_EN="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "ffmpeg is required; install it first (for example: sudo apt-get install ffmpeg)" >&2
  exit 1
}
command -v python3 >/dev/null 2>&1 || {
  echo "python3 is required" >&2
  exit 1
}

mkdir -p "${ROOT}/models" "${ROOT}/voices" "${ROOT}/whisper" "${ROOT}/piper"

if [ ! -f "${ROOT}/models/ggml-base.bin" ]; then
  echo "Downloading Whisper base model..."
  curl -fL --retry 3 -o "${ROOT}/models/ggml-base.bin" "${WHISPER_MODEL}"
fi

if [ ! -x "${ROOT}/whisper/whisper-bin-ubuntu-x64/whisper-cli" ]; then
  echo "Downloading Whisper CLI..."
  curl -fL --retry 3 -o /tmp/kodbot-whisper.tar.gz "${WHISPER_URL}"
  tar -xzf /tmp/kodbot-whisper.tar.gz -C "${ROOT}/whisper"
  rm -f /tmp/kodbot-whisper.tar.gz
fi

if [ ! -x "${ROOT}/piper/piper" ]; then
  echo "Downloading Piper..."
  curl -fL --retry 3 -o /tmp/kodbot-piper.tar.gz "${PIPER_URL}"
  tar -xzf /tmp/kodbot-piper.tar.gz -C "${ROOT}/piper" --strip-components=1
  rm -f /tmp/kodbot-piper.tar.gz
fi

for pair in \
  "bg_BG-dimitar-medium:${VOICE_BG}" \
  "en_US-lessac-medium:${VOICE_EN}"
do
  name="${pair%%:*}"
  url="${pair#*:}"
  if [ ! -f "${ROOT}/voices/${name}.onnx" ]; then
    echo "Downloading Piper voice ${name}..."
    curl -fL --retry 3 -o "${ROOT}/voices/${name}.onnx" "${url}.onnx"
    curl -fL --retry 3 -o "${ROOT}/voices/${name}.onnx.json" "${url}.onnx.json"
  fi
done

if [ ! -x "${ROOT}/venv/bin/python" ]; then
  python3 -m venv "${ROOT}/venv"
fi
"${ROOT}/venv/bin/pip" install --quiet --upgrade pip
"${ROOT}/venv/bin/pip" install --quiet piper-tts faster-whisper

echo "Downloading faster-whisper base model into the local cache..."
"${ROOT}/venv/bin/python" - <<'PY'
from faster_whisper import WhisperModel
WhisperModel("small", device="cpu", compute_type="int8")
PY

echo "Local voice is ready under ${ROOT}"
