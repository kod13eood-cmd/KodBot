package com.kodbot.companion

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalizationTest {
    @Test
    fun keepsEnglishAsTheSourceLanguage() {
        assertEquals("Settings", AppStrings.t(AppLanguage.EN, "Settings"))
    }

    @Test
    fun translatesInterfaceCopy() {
        assertEquals("Настройки", AppStrings.t(AppLanguage.BG, "Settings"))
        assertEquals("Изпрати", AppStrings.t(AppLanguage.BG, "Send"))
        assertEquals("Работи самостоятелно", AppStrings.t(AppLanguage.BG, "Work alone"))
        assertEquals("Икономичен режим", AppStrings.t(AppLanguage.BG, "Economy mode"))
        assertEquals("Език", AppStrings.t(AppLanguage.BG, "Language"))
        assertEquals("Това още има нужда от вас", AppStrings.t(AppLanguage.BG, "This still needs you"))
    }

    @Test
    fun fillsDynamicCountsAndNames() {
        assertEquals("3 бота", AppStrings.t(AppLanguage.BG, "3 bots"))
        assertEquals("1 бот", AppStrings.t(AppLanguage.BG, "1 bots"))
        assertEquals("Свързано с paperclipi7", AppStrings.t(AppLanguage.BG, "Connected to paperclipi7"))
        assertEquals(
            "2 от 3 engine-а готови",
            AppStrings.t(AppLanguage.BG, "2 of 3 engines ready"),
        )
        assertEquals(
            "Scout ползва по-бърз модел за кратки въпроси.",
            AppStrings.t(AppLanguage.BG, "Scout uses a faster model for short questions."),
        )
    }

    /** Every static `tr("…")` in the UI must have a translation or a rule.
     * Interpolated templates are covered by the dynamic-rule tests above. */
    @Test
    fun everyStaticInterfaceLiteralHasBulgarianCopy() {
        val dir = File("src/main/java/com/kodbot/companion")
        assertTrue("source directory not found: ${dir.absolutePath}", dir.isDirectory)
        val pattern = Regex("""(?<![\w.])tr\(\s*"((?:[^"\\]|\\.)*)"""")
        val missing = mutableSetOf<String>()
        for (file in dir.listFiles { f -> f.extension == "kt" }.orEmpty()) {
            if (file.name == "AppStrings.kt") continue
            val source = file.readText()
            for (match in pattern.findAll(source)) {
                val text = match.groupValues[1]
                if ("$" in text) continue
                if (text.length < 3 || !text.any(Char::isLetter)) continue
                if (text.startsWith("http") || text.matches(Regex("""[\d.:-]+"""))) continue
                if (text.contains("://") || text.matches(Regex("""[A-Za-z0-9.-]+:\d+"""))) continue
                if (!AppStrings.hasTranslation(text)) missing.add(text)
            }
        }
        assertTrue("missing Bulgarian copy for: ${missing.sorted()}", missing.isEmpty())
    }

    @Test
    fun aRuleIsNotAnIdentityTranslation() {
        // Guards against an accidental English -> English entry that would
        // make the coverage test pass without translating anything.
        assertNotEquals("Settings", AppStrings.t(AppLanguage.BG, "Settings"))
        assertNotEquals("Send", AppStrings.t(AppLanguage.BG, "Send"))
    }
}
