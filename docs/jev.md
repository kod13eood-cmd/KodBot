# Jev structured decisions

Jev is OpenCode Zen's **structured-decision model** ("System One"). It does not
write prose: you give it a piece of text and typed questions, and it returns
answers with probabilities. That makes it useful for triage, routing,
classification, urgency, sentiment, and rubric scoring — and a poor fit for the
chat model picker.

KodBot exposes Jev as an on-demand tool instead of a chat model.

## The tool

When an OpenCode Zen key is configured, MCP-capable bots get one extra tool:

```text
jev_decide
```

The agent calls it only when a decision needs to be made. It can use a
ready-made preset:

```json
{
  "state": "My invoice is wrong and I need it fixed today.",
  "preset": "triage"
}
```

Available presets:

| Preset | Asks |
| --- | --- |
| `triage` | Is it urgent? Which team? How frustrated is the person? |
| `bug` | Is it a bug? How severe? Which component? |
| `sentiment` | Positive/neutral/negative? Does it need an urgent reply? |

Or pass a custom `questions` object:

```json
{
  "state": "The login button does nothing on Safari.",
  "questions": {
    "is_bug": {
      "type": "noul",
      "instructions": "Is this a bug report?"
    },
    "severity": {
      "type": "score",
      "instructions": "How severe is the failure?",
      "criteria": ["Cosmetic", "Minor", "Major", "Critical"]
    },
    "component": {
      "type": "choice",
      "instructions": "Which component is involved?",
      "criteria": {
        "ui": "Frontend or user interface",
        "api": "Backend API or service",
        "data": "Database or stored data"
      }
    }
  }
}
```

Question types:

- `noul` — yes/no; returns a probability from 0 to 1.
- `choice` — one of the named criteria keys.
- `score` — a rubric index plus a label legend.

## Requirements

Jev uses the same OpenCode Zen key as the OpenCode engine. Configure it in
**Settings → Engines → OpenCode**, or sign in with `opencode auth login`.
There is no separate Jev key.

The free `jev-1.13-free` model is the default. Pass `model: "jev-1.13"` to use
the paid model.

## Which engines get the tool

The tool is mounted for MCP-capable engines:

- Claude
- Codex
- OpenCode and the ACP engine family (Qwen, Hermes, Kimi, Droid, and others
  that share the ACP adapter)

Engines without MCP tool support do not see it. The tool is never added to the
model picker, because Jev cannot hold a conversation.

## Privacy

Calling `jev_decide` sends the supplied `state` text and questions to the
OpenCode Zen endpoint (`https://opencode.ai/zen/v1/systemone`) under the user's
key. It is not routed through a KodBot cloud service.
