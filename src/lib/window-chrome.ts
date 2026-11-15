/** Windows draws its hidden title bar's caption buttons over the web content:
 *  roughly 138px wide and 60px tall in the top-right corner. A header that
 *  puts its own close button there leaves this much room, exactly like the
 *  chat header does, so the system close button cannot cover it.
 *  Linux/Windows-with-HTML-controls handle the same corner by hiding the
 *  floating controls while a panel is open (components/WindowControls.tsx). */
export const WINDOWS_TITLEBAR_INSET = "pr-[148px]";

export function windowsTitlebarInset(): string | false {
  return window.ogb?.platform === "win32" ? WINDOWS_TITLEBAR_INSET : false;
}
