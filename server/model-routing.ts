import type { ModelSelection } from "./contracts.ts";

/** One model a configured engine can actually run right now. */
export interface AutoModelOption {
  instanceId: string;
  model: string;
  label?: string;
  free?: boolean;
  group?: string;
  /** The model can look at a screen or an image. */
  vision?: boolean;
}

const STRONG = /(opus|sonnet|gpt-5|grok-4|deepseek|kimi|qwen|pro|max|thinking|reason|o[34])/i;
const FAST = /(flash|mini|free|fast|lite|haiku|small|nano|instant)/i;
const HARD_TASK =
  /\b(code|coding|debug|bug|architecture|architect|refactor|migrate|deploy|security|audit|analy[sz]e|strategy|research|investigate|legal|finance|contract|plan|design|implement|build)\b/i;
const SCREEN_TASK =
  /\b(screenshot|desktop|browser|click|scroll|captcha|open (the )?(page|site|url|app)|on (the )?screen)\b/i;
const TRANSLATE_TASK = /^\s*(translate|преведи)\b|\b(translation|превод)\b/i;
const CODE_TASK =
  /```|\b(code|coding|debug|bug|refactor|implement|compile|typescript|python|repository|тест|код)\b|\bfix\b|\b[A-Za-z0-9_-]+\.[a-z]{1,4}\b/i;

export type TaskSkill = "code" | "screen" | "translate" | "general";

/** What the words are asking for. Screen wins over code, because a
 * login page is a screen even when the words also mention a bug. */
export function classifyTask(prompt: string): TaskSkill {
  const text = prompt.trim();
  if (SCREEN_TASK.test(text)) return "screen";
  if (TRANSLATE_TASK.test(text) && !/```/.test(text)) return "translate";
  if (CODE_TASK.test(text)) return "code";
  return "general";
}

const VISION_NAME = /vision|\bvl\b|pixtral|gpt-4o|\bgemini\b/i;

/** A catalog row can see a screen when it says so, or when its name is
 * one of the families that take images. */
export function modelCanSee(option: Pick<AutoModelOption, "model" | "label" | "group" | "vision">): boolean {
  if (option.vision) return true;
  return VISION_NAME.test(`${option.model} ${option.label ?? ""} ${option.group ?? ""}`);
}

export interface AutoModelMode {
  /** Short questions may drop to a fast or free model. Off by default:
   * a short prompt is often the whole task, and a cheaper model is a
   * choice the user makes, not a surprise. */
  economy?: boolean;
}

export interface AutoRoute {
  selection: ModelSelection;
  skill: TaskSkill;
}

/** A deliberately small router. Code stays on a strong model. A screen
 * goes to a model that can see. A short translation uses a cheap model
 * only in economy mode. Everything else keeps the strongest floor. */
export function routeAutoModel(
  prompt: string,
  options: AutoModelOption[],
  fallback?: ModelSelection,
  mode?: AutoModelMode,
): AutoRoute | null {
  const unique = new Map<string, AutoModelOption>();
  for (const option of options) {
    if (!option.instanceId || !option.model) continue;
    unique.set(`${option.instanceId}\u0000${option.model}`, option);
  }
  if (fallback && !unique.has(`${fallback.instanceId}\u0000${fallback.model}`)) {
    unique.set(`${fallback.instanceId}\u0000${fallback.model}`, {
      instanceId: fallback.instanceId,
      model: fallback.model,
    });
  }
  const candidates = [...unique.values()];
  if (!candidates.length) return null;

  const text = prompt.trim();
  const skill = classifyTask(text);
  const economy = mode?.economy === true;
  const complex = text.length >= 500 || /```/.test(text) || HARD_TASK.test(text) || skill === "code" || skill === "screen";
  const simple =
    economy && text.length > 0 && text.length <= 220 && !/```/.test(text) && !HARD_TASK.test(text) && skill !== "code" && skill !== "screen";

  const score = (option: AutoModelOption) => {
    const name = `${option.model} ${option.label ?? ""} ${option.group ?? ""}`;
    const strong = STRONG.test(name);
    const fast = FAST.test(name);
    let value = 0;
    if (skill === "screen") {
      if (modelCanSee(option)) value += 60;
      if (strong) value += 15;
      if (fast && !modelCanSee(option)) value -= 20;
      return value;
    }
    if (skill === "code") {
      if (strong) value += 40;
      if (fast) value -= 25;
      if (!option.free) value += 4;
      return value;
    }
    if (skill === "translate" && simple) {
      if (fast) value += 30;
      if (option.free) value += 12;
      if (strong) value -= 6;
      return value;
    }
    if (!economy || complex || skill === "translate") {
      if (strong) value += 30;
      if (fast) value -= 8;
      if (!option.free) value += 4;
    } else if (simple) {
      if (fast) value += 30;
      if (option.free) value += 12;
      if (strong) value -= 6;
    } else {
      if (option.free) value += 3;
      if (fallback && option.instanceId === fallback.instanceId && option.model === fallback.model) value += 4;
    }
    return value;
  };

  candidates.sort((a, b) => score(b) - score(a));
  const best = candidates[0];
  return { selection: { instanceId: best.instanceId, model: best.model }, skill };
}

export function chooseAutoModel(
  prompt: string,
  options: AutoModelOption[],
  fallback?: ModelSelection,
  mode?: AutoModelMode,
): ModelSelection | null {
  return routeAutoModel(prompt, options, fallback, mode)?.selection ?? null;
}
