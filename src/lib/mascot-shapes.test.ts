import { describe, expect, it } from "vitest";

import {
  autoMascotShape,
  MASCOT_SHAPE_IDS,
  MASCOT_SHAPES,
  mascotSilhouette,
  normalizeMascotShape,
} from "./mascot-shapes";

describe("mascot shapes", () => {
  it("ships a complete, distinct silhouette for every picker entry", () => {
    expect(new Set(MASCOT_SHAPE_IDS).size).toBe(MASCOT_SHAPE_IDS.length);
    for (const id of MASCOT_SHAPE_IDS) {
      const shape = MASCOT_SHAPES[id];
      expect(shape.label.length).toBeGreaterThan(1);
      expect(shape.silhouette.body).toContain('fill="{{GRADIENT}}"');
      expect(shape.silhouette.clip.length).toBeGreaterThan(20);
      expect(shape.silhouette.anchor.scale).toBeGreaterThan(0.4);
    }
    expect(MASCOT_SHAPES.classic.silhouette.body).toContain("{{GRADIENT}}");
  });

  it("accepts only known explicit shapes", () => {
    expect(normalizeMascotShape("star")).toBe("star");
    expect(normalizeMascotShape("not-a-shape")).toBeNull();
    expect(normalizeMascotShape(null)).toBeNull();
  });

  it("derives stable but varied auto shapes", () => {
    expect(autoMascotShape("researcher", "blue")).toBe(autoMascotShape("researcher", "blue"));
    const varied = new Set(
      ["green", "blue", "red", "orange", "purple", "cyan", "pink", "yellow", "teal", "coral"].map((color) =>
        autoMascotShape("builder", color),
      ),
    );
    expect(varied.size).toBeGreaterThan(3);
    expect(mascotSilhouette("star", "builder", "green")).toBe(MASCOT_SHAPES.star.silhouette);
  });
});
