/** First-run routing for the desktop window.
 *
 * The connection file has always recorded `local`/`remote`, but 0.1.64 adds
 * an explicit onboarding marker. Older files only said which mode the window
 * was in: a local file could come from an install that never saw the
 * Solo/Business question. Treat only a marked local choice as answered, so an
 * upgrade asks once; a remote file was always an explicit address the user
 * entered, so it stays answered.
 */
export function connectionChoiceSaved(record) {
  if (!record) return false;
  if (record.mode === "remote") return true;
  return record.mode === "local" && record.onboarding === true;
}

/** The record written when the user answers the question (or changes the
 * choice in Settings). Keeping the timestamp makes the file self-describing
 * and leaves room for a future "chosen on this install" check. */
export function connectionRecord(connection, now = new Date()) {
  return { ...connection, onboarding: true, chosenAt: now.toISOString() };
}
