import { CURSOR_STATES, type CursorState } from "@/components/CursorAvatar";

/** The mascot's behaviour vocabulary — CursorAvatar's 39 states, under the
 * app's historical names. */
export type CrewState = CursorState;
export const CREW_STATES = CURSOR_STATES;

/** CursorAvatar ships French group labels; the app shows these instead. The
 * memberships mirror its STATE_GROUPS exactly. */
export const STATE_GROUPS = {
  Lifecycle: ["sleeping", "waking", "idle", "listening", "thinking", "searching", "working"],
  Reactions: [
    "excited",
    "surprised",
    "suspicious",
    "angry",
    "drowsy",
    "happy",
    "curious",
    "confused",
    "bored",
    "proud",
    "shy",
    "sad",
    "laughing",
    "scared",
    "playful",
    "celebrate",
  ],
  "Agent morphs": ["orbit", "radar", "progress"],
  "Product cycle": [
    "spawning",
    "humming",
    "loading",
    "dictating",
    "writing",
    "sending",
    "receiving",
    "uploading",
    "notifying",
    "alerting",
    "dragging",
    "bouncing",
    "powering-down",
  ],
} satisfies Record<string, CrewState[]>;

export const CREW_COLOR_NAMES = [
  "green",
  "blue",
  "red",
  "orange",
  "purple",
  "cyan",
  "pink",
  "yellow",
  "teal",
  "coral",
] as const;

export type CrewColor = (typeof CREW_COLOR_NAMES)[number];

/** The jobs a bot can present as. These are presentation archetypes, not
 * permissions: they pick an icon, a default expression and an idle motion
 * while the bot's title and description still do the real work. */
export const BOT_ROLES = [
  "coordinator",
  "researcher",
  "builder",
  "designer",
  "writer",
  "operator",
  "analyst",
  "guide",
] as const;

export type BotRole = (typeof BOT_ROLES)[number];

export interface BotRoleMeta {
  label: string;
  blurb: string;
  state: CrewState;
  color: string;
  icon: "compass" | "microscope" | "wrench" | "palette" | "pen" | "radar" | "chart" | "message";
}

export const BOT_ROLE_META: Record<BotRole, BotRoleMeta> = {
  coordinator: {
    label: "Coordinator",
    blurb: "Owns the outcome and keeps the team moving",
    state: "proud",
    color: "#8057C8",
    icon: "compass",
  },
  researcher: {
    label: "Researcher",
    blurb: "Finds sources, checks facts, and maps the ground",
    state: "searching",
    color: "#377FE6",
    icon: "microscope",
  },
  builder: {
    label: "Builder",
    blurb: "Writes code, fixes systems, and ships changes",
    state: "working",
    color: "#009957",
    icon: "wrench",
  },
  designer: {
    label: "Designer",
    blurb: "Shapes interfaces, visuals, and the feel of things",
    state: "playful",
    color: "#D84F8B",
    icon: "palette",
  },
  writer: {
    label: "Writer",
    blurb: "Drafts, edits, and turns notes into clear prose",
    state: "writing",
    color: "#E78531",
    icon: "pen",
  },
  operator: {
    label: "Operator",
    blurb: "Watches systems, handles incidents, and keeps uptime",
    state: "radar",
    color: "#0EA5C6",
    icon: "radar",
  },
  analyst: {
    label: "Analyst",
    blurb: "Reads the numbers and explains what they mean",
    state: "thinking",
    color: "#D8A729",
    icon: "chart",
  },
  guide: {
    label: "Guide",
    blurb: "Onboards people, answers questions, and supports",
    state: "happy",
    color: "#01A492",
    icon: "message",
  },
};

/** A stored role, if it is one we know. Unknown values fall back to Auto. */
export function normalizeRole(value: string | null | undefined): BotRole | null {
  if (!value) return null;
  return (BOT_ROLES as readonly string[]).includes(value) ? (value as BotRole) : null;
}

/** Best-effort role from the bot's own description. This is only a badge
 * suggestion; the user can always pick a different role. */
export function inferRole(profile: { name?: string; title?: string; description?: string }): BotRole | null {
  const text = `${profile.name ?? ""} ${profile.title ?? ""} ${profile.description ?? ""}`.toLowerCase();
  if (/\b(code|coding|developer|development|engineer|engineering|build|debug|program|software|devops)\b/.test(text)) {
    return "builder";
  }
  if (/\b(research|researcher|search|investigate|strategy|strategist|study|learn|knowledge|scout)\b/.test(text)) {
    return "researcher";
  }
  if (/\b(monitor|monitoring|incident|alert|watch|status|uptime|operations|operator|sre)\b/.test(text)) {
    return "operator";
  }
  if (/\b(analyst|analysis|data|analytics|finance|financial|risk|metrics|report)\b/.test(text)) {
    return "analyst";
  }
  if (/\b(design|designer|creative|brainstorm|art|illustration|music|story|brand)\b/.test(text)) {
    return "designer";
  }
  if (/\b(write|writer|writing|content|copy|editor|document|docs|documentation)\b/.test(text)) {
    return "writer";
  }
  if (/\b(support|help|success|onboarding|coach|teacher|guide|welcome)\b/.test(text)) {
    return "guide";
  }
  if (/\b(chief|coordinator|coordinate|manager|lead|assistant|orchestrator)\b/.test(text)) {
    return "coordinator";
  }
  return null;
}

/** The role shown on the avatar: an explicit pick, then a suggestion, then
 * the neutral guide badge so every bot has an identity. */
export function displayRole(profile: {
  role?: string | null;
  name?: string;
  title?: string;
  description?: string;
}): BotRole {
  return normalizeRole(profile.role) ?? inferRole(profile) ?? "guide";
}

export const CREW_COLORS = {
  green: "#009957",
  blue: "#377FE6",
  red: "#D94B52",
  orange: "#E78531",
  purple: "#8057C8",
  cyan: "#0EA5C6",
  pink: "#D84F8B",
  yellow: "#D8A729",
  teal: "#01A492",
  coral: "#E5634E",
} satisfies Record<CrewColor, string>;

export const CREW_MOTIONS = [
  "arrive",
  "switch",
  "customize",
  "alert",
  "thinking",
  "working",
  "launch",
  "success",
  "celebrate",
  "blink",
  "surprise",
  "failure",
] as const;

export type CrewMotion = "none" | (typeof CREW_MOTIONS)[number];

/**
 * The face used to be ten hand-drawn SVGs; it is now the engine's 39 states.
 * Bots saved under the old vocabulary still carry one of these ten names, so
 * they are translated on read rather than migrated in place — a bot's stored
 * face should survive a downgrade too.
 */
interface LegacyStates {
  [state: string]: CrewState;
}

const LEGACY_STATES: LegacyStates = {
  deadpan: "idle",
  friendly: "happy",
  focused: "working",
  thinking: "thinking",
  excited: "excited",
  sleepy: "drowsy",
  surprised: "surprised",
  skeptical: "suspicious",
  worried: "scared",
  mischievous: "playful",
};

const KNOWN_STATES = new Set<string>(CREW_STATES);

/** Resolves any stored value — current, legacy or junk — to a real state. */
export function normalizeState(value: string | null | undefined): CrewState | null {
  if (!value) return null;
  if (KNOWN_STATES.has(value)) return value as CrewState;
  return LEGACY_STATES[value] ?? null;
}

/**
 * The states worth offering in the appearance picker.
 *
 * The engine carries 39, but many are transient beats the app drives itself
 * (`sending`, `alerting`, `powering-down`) and make no sense as a bot's resting
 * face. More importantly, states share resting faces: `happy`, `excited` and
 * `playful` all rest on expression 2, and `curious`, `surprised` and `scared`
 * all rest on 3 — they differ in which faces they *drift* to, which a static
 * swatch cannot show. Offering them all gave 15 buttons showing 8 pictures.
 *
 * Across all 39 states there are only 11 distinct resting faces, so this is one
 * state per face, chosen for the clearest name. Every swatch looks different.
 */
export const PICKABLE_STATES: CrewState[] = [
  "idle", // expression 0
  "happy", // 2
  "curious", // 3
  "drowsy", // 4
  "working", // 7
  "thinking", // 8
  "listening", // 10
  "sleeping", // 13
  "suspicious", // 14
  "proud", // 15
];

type MascotMessage = {
  kind: string;
  tool?: { ok?: boolean };
};

export type MascotBotProfile = {
  name: string;
  title?: string;
  description?: string;
  role?: string | null;
  mascotExpression?: string | null;
  busy?: boolean;
  unread?: boolean;
  messages?: MascotMessage[];
};

/**
 * Selects a state from live state first, then from what the bot is about.
 * The keyword groups deliberately overlap as little as possible so a bot's
 * visual identity stays stable while its title and description are edited.
 */
export function stateForBot(bot: MascotBotProfile): CrewState {
  const pinned = normalizeState(bot.mascotExpression);
  if (pinned) return pinned;

  const last = bot.messages?.[bot.messages.length - 1];

  if (last?.kind === "activity" && last.tool?.ok === false) return "alerting";
  if (bot.busy) return "working";
  if (bot.unread) return "notifying";
  if (last?.kind === "options") return "curious";

  const role = normalizeRole(bot.role) ?? inferRole(bot);
  if (role) return BOT_ROLE_META[role].state;

  const profile = `${bot.name} ${bot.title ?? ""} ${bot.description ?? ""}`.toLowerCase();
  const matches = (words: RegExp) => words.test(profile);

  if (matches(/\b(code|coding|developer|development|engineer|engineering|build|debug|program|software)\b/)) {
    return "working";
  }
  if (matches(/\b(research|researcher|search|investigate|strategy|strategist|study|learn|knowledge)\b/)) {
    return "searching";
  }
  if (matches(/\b(marketing|growth|launch|campaign|social|sales|outreach|brand)\b/)) {
    return "excited";
  }
  if (matches(/\b(overnight|night|background|async|queue|batch|long-running)\b/)) {
    return "drowsy";
  }
  if (matches(/\b(monitor|monitoring|incident|alert|watch|status|uptime)\b/)) {
    return "radar";
  }
  if (matches(/\b(review|reviewer|audit|critic|critique|quality|qa|test|legal)\b/)) {
    return "suspicious";
  }
  if (matches(/\b(security|secure|compliance|risk|privacy|finance|financial)\b/)) {
    return "scared";
  }
  if (matches(/\b(design|designer|creative|brainstorm|art|illustration|music|story)\b/)) {
    return "playful";
  }
  if (matches(/\b(support|help|success|onboarding|coach|teacher|guide|welcome)\b/)) {
    return "happy";
  }

  return "idle";
}
