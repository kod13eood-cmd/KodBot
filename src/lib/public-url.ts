/** The address other devices actually use to reach this KodBot. The desktop
 *  app can be open on loopback while the phone uses a Tailscale name, so page
 *  links use the owner's configured public address when there is one. An
 *  empty setting means "whatever origin this UI was loaded from". */
export function publicBase(config?: { publicUrl?: string } | null): string {
  const configured = config?.publicUrl?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}

// Only page URLs are rewritten: a bot may legitimately talk about a localhost
// service in prose, but a page it wrote is served by this harness and is
// reachable at the public address.
const LOOPBACK_PAGE_LINK =
  /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(\/api\/bots\/[\w-]+\/pages\/[\w.-]+)/gi;

export function rewriteLocalPageLinks(text: string, base: string): string {
  if (!base) return text;
  return text.replace(LOOPBACK_PAGE_LINK, (_match, path: string) => `${base}${path}`);
}
