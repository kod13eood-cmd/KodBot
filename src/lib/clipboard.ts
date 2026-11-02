/** Copy text from an ordinary click.
 *
 * `navigator.clipboard` is unavailable in a non-secure context — a KodBot
 * window opened over plain HTTP on the LAN, for example — and Electron can
 * deny it as well. The selection fallback still works there because it runs
 * inside the user's click, which is the permission browsers actually check.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or no secure context — try the click-driven fallback.
  }

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.left = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area?.remove();
    active?.focus();
  }
}
