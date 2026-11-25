import type { Bot, Group, GroupDefaultResponder } from "@/state/store";

/** Be defensive around rooms loaded while an older server is still running,
 * and around a lead removed by another client before the group patch arrives. */
export function effectiveDefaultResponder(group: Group, members: Bot[]): GroupDefaultResponder {
  const value = group.defaultResponder;
  if (value?.kind === "everyone" || value?.kind === "mentions") return value;
  if (value?.kind === "member" && members.some((member) => member.id === value.botId)) return value;
  return members[0] ? { kind: "member", botId: members[0].id } : { kind: "mentions" };
}

export function defaultResponderName(group: Group, members: Bot[]): string | null {
  const value = effectiveDefaultResponder(group, members);
  if (value.kind !== "member") return null;
  return members.find((member) => member.id === value.botId)?.name ?? null;
}

type Translate = (source: string, vars?: Record<string, string | number>) => string;

export function groupResponseHint(group: Group, members: Bot[], t: Translate): string {
  if (group.dm) return t("Reply here to continue the bot-to-bot conversation.");
  const value = effectiveDefaultResponder(group, members);
  if (value.kind === "everyone") return t("Everyone responds unless you @mention specific bots.");
  if (value.kind === "mentions") return t("Mention a bot with @ to bring them in.");
  const name = defaultResponderName(group, members) ?? t("The lead bot");
  return t("{name} responds by default — @mention someone else to choose them instead.", { name });
}

export function groupComposerHint(group: Group, members: Bot[], t: Translate): string {
  if (group.dm) return t("continue the conversation");
  const value = effectiveDefaultResponder(group, members);
  if (value.kind === "everyone") return t("everyone responds");
  if (value.kind === "mentions") return t("@ to bring a bot in");
  return t("{name} responds", { name: defaultResponderName(group, members) ?? t("Lead") });
}
