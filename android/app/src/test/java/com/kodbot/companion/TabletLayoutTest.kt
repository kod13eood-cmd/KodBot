package com.kodbot.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TabletLayoutTest {
    @Test
    fun `phones and short windows stay single pane`() {
        assertFalse(TabletLayout.isTwoPane(360f, 800f))
        assertFalse(TabletLayout.isTwoPane(599f, 800f))
        assertFalse(TabletLayout.isTwoPane(800f, 400f))
    }

    @Test
    fun `tablet widths use the two pane shell`() {
        assertTrue(TabletLayout.isTwoPane(600f, 960f))
        assertTrue(TabletLayout.isTwoPane(720f, 800f))
        assertTrue(TabletLayout.isTwoPane(1280f, 800f))
    }

    @Test
    fun `the fleet column grows only on large tablets`() {
        assertEquals(260f, TabletLayout.fleetPaneWidthDp(600f), 0.01f)
        assertEquals(300f, TabletLayout.fleetPaneWidthDp(720f), 0.01f)
        assertEquals(300f, TabletLayout.fleetPaneWidthDp(999f), 0.01f)
        assertEquals(340f, TabletLayout.fleetPaneWidthDp(1_000f), 0.01f)
        assertEquals(380f, TabletLayout.fleetPaneWidthDp(1_280f), 0.01f)
    }
}
