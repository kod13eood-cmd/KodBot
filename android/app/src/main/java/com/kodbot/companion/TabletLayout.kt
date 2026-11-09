package com.kodbot.companion

/** Width breakpoints for the phone/tablet shell. Kept as plain numbers so the
 * layout decision is testable without a Compose UI test. */
object TabletLayout {
    /** A 600dp window is the Material "medium" breakpoint: a small tablet or
     * a foldable. This decision is deliberately width-only: the IME shrinks
     * the window height while typing, and a height breakpoint would switch
     * layouts mid-keystroke and drop the composer's focus. */
    const val TWO_PANE_MIN_WIDTH_DP = 600f

    fun isTwoPane(widthDp: Float): Boolean = widthDp >= TWO_PANE_MIN_WIDTH_DP

    /** The fleet list is a navigation column, not the main content. Keep it
     * narrow enough that a tablet still gives the chat most of the width, and
     * let it grow only on genuinely large screens. */
    fun fleetPaneWidthDp(widthDp: Float): Float = when {
        widthDp >= 1_200f -> 380f
        widthDp >= 1_000f -> 340f
        widthDp >= 720f -> 300f
        else -> 260f
    }
}
