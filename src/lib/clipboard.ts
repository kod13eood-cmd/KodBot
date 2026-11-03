/** Copy text from an ordinary click.
 *
 * The remote UI is served over plain HTTP, which is not a secure context:
 * `navigator.clipboard` is unavailable there, and Electron's renderer can deny
 * it as well. The desktop app therefore exposes the main-process clipboard
 * (which has no secure-context restriction); the browser fallbacks remain for
 * the web build. The selection fallback runs inside the user's click, which is
 * the permission browsers actually check.
 */
export async function copyText(text: string): Promise<boolean> {
  const native = window.ogb?.clipboard;
  if (native) {
    try {
      await native.writeText(text);
      return true;
    } catch {
      // fall through to the browser paths
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or no secure context — try the click-driven fallback.
  }

  const active =
    typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
