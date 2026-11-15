import { describe, expect, it } from "vitest";

import { windowControlsHidden, type WindowControlsVisibility } from "./WindowControls";

const closed: WindowControlsVisibility = {
  settingsOpen: false,
  computerOpen: false,
  inspectorOpen: false,
  appSettingsOpen: false,
  helpOpen: false,
  pluginsOpen: false,
};

describe("window controls visibility", () => {
  it("stays out of the way while a panel owns the top-right corner", () => {
    expect(windowControlsHidden(closed)).toBe(false);
    for (const panel of [
      "settingsOpen",
      "computerOpen",
      "inspectorOpen",
      "appSettingsOpen",
      "helpOpen",
      "pluginsOpen",
    ] as const) {
      expect(windowControlsHidden({ ...closed, [panel]: true })).toBe(true);
    }
  });
});
