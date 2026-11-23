import { describe, expect, it } from "vitest";

import { BOT_NAME_STYLE_OPTIONS, resolveBotNameLanguage } from "./bot-name-style";
import { hasBulgarianTranslation } from "./i18n";

describe("bot name style", () => {
  it("follows the interface language in auto mode", () => {
    expect(resolveBotNameLanguage("auto", "bg")).toBe("bulgarian");
    expect(resolveBotNameLanguage("auto", "bg-BG")).toBe("bulgarian");
    expect(resolveBotNameLanguage("auto", "en")).toBe("english");
    expect(resolveBotNameLanguage("auto", "en-US")).toBe("english");
  });

  it("keeps an explicit choice independent of the interface language", () => {
    expect(resolveBotNameLanguage("bulgarian", "en")).toBe("bulgarian");
    expect(resolveBotNameLanguage("english", "bg")).toBe("english");
  });

  it("offers all three choices in the settings UI", () => {
    expect(BOT_NAME_STYLE_OPTIONS.map((option) => option.id)).toEqual(["auto", "bulgarian", "english"]);
  });

  it("has Bulgarian copy for every naming option", () => {
    for (const option of BOT_NAME_STYLE_OPTIONS) {
      expect(hasBulgarianTranslation(option.label)).toBe(true);
    }
  });
});
