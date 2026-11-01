import type { ModelSelection } from "./contracts.ts";

/** One model a configured engine can actually run right now. */
export interface AutoModelOption {
  instanceId: string;
  model: string;
  label?: string;
  free?: boolean;
  group?: string;
}

const STRONG = /(opus|sonnet|gpt-5|grok-4|deepseek|kimi|qwen|pro|max|thinking|reason|o[34])/i;
const FAST = /(flash|mini|free|fast|lite|haiku|small|nano|instant)/i;
const HARD_TASK =
  /\b(code|coding|debug|bug|architecture|architect|refactor|migrate|deploy|security|audit|analy[sz]e|strategy|research|investigate|legal|finance|contract|plan|design|implement|build)\b/i;

/** A deliberately small router: the right model is a per-turn choice, not a
 * permanent downgrade. Complex work gets the strongest available model;
 * short, simple requests get the cheapest/fastest one. */
export function chooseAutoModel(
  prompt: string,
  options: AutoModelOption[],
  fallback?: ModelSelection,
): ModelSelection | null {
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
  const complex = text.length >= 500 || /```/.test(text) || HARD_TASK.test(text);
  const simple = text.length > 0 && text.length <= 220 && !/```/.test(text) && !HARD_TASK.test(text);

  const score = (option: AutoModelOption) => {
    const name = `${option.model} ${option.label ?? ""} ${option.group ?? ""}`;
    let value = 0;
    if (complex) {
      if (STRONG.test(name)) value += 30;
      if (FAST.test(name)) value -= 8;
      if (!option.free) value += 4;
    } else if (simple) {
      if (FAST.test(name)) value += 30;
      if (option.free) value += 12;
      if (STRONG.test(name)) value -= 6;
    } else {
      if (option.free) value += 3;
      if (fallback && option.instanceId === fallback.instanceId && option.model === fallback.model) value += 4;
    }
    return value;
  };

  candidates.sort((a, b) => score(b) - score(a));
  const best = candidates[0];
  return { instanceId: best.instanceId, model: best.model };
}
