import type { AppSettingsSection } from "@/state/store";

/** Which app-settings sections this client may show.
 *
 * Connections and Usage are developer surfaces. Admin belongs to the gateway
 * owner; a local single-user harness has no authUser and never sees it. */
export function canSeeSettingsSection(
  id: AppSettingsSection,
  options: { devMode: boolean; isOwner: boolean },
): boolean {
  if (id === "admin") return options.isOwner;
  if (id === "connections" || id === "usage") return options.devMode;
  return true;
}
