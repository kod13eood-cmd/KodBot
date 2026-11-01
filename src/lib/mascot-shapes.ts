// Distinct body silhouettes for the animated bot mascot. Each shape lives in
// CursorAvatar's 228.541-unit face box, so the same face/eye engine can be
// clipped to it without a second renderer.
import { DEFAULT_SILHOUETTE, type CursorSilhouette } from "@/components/CursorAvatar";
import type { BotRole } from "./mascot";

export const MASCOT_SHAPE_IDS = [
  "orb",
  "bubble",
  "pill",
  "hex",
  "diamond",
  "star",
  "drop",
  "shield",
  "ghost",
  "classic",
] as const;

export type MascotShapeId = (typeof MASCOT_SHAPE_IDS)[number];

export interface MascotShapeMeta {
  label: string;
  silhouette: CursorSilhouette;
}

const FACE_CENTRE = 114.2705;

/** The old cursor silhouette shipped with a black body fill baked in. */
const CLASSIC: CursorSilhouette = {
  ...DEFAULT_SILHOUETTE,
  body: DEFAULT_SILHOUETTE.body.replace(/fill="#000000"/g, 'fill="{{GRADIENT}}"'),
};

function silhouette(name: string, markup: string, scale: number): CursorSilhouette {
  return {
    name,
    fit: "",
    body: markup.replaceAll("{{PAINT}}", 'fill="{{GRADIENT}}"'),
    clip: markup.replaceAll("{{PAINT}}", ""),
    anchor: { x: FACE_CENTRE, y: FACE_CENTRE, scale },
  };
}

export const MASCOT_SHAPES: Record<MascotShapeId, MascotShapeMeta> = {
  orb: {
    label: "Orb",
    silhouette: silhouette(
      "orb",
      '<circle cx="114.27" cy="114.27" r="102" {{PAINT}}/>',
      0.78,
    ),
  },
  bubble: {
    label: "Bubble",
    silhouette: silhouette(
      "bubble",
      '<rect x="18" y="18" width="192.54" height="192.54" rx="58" {{PAINT}}/>',
      0.78,
    ),
  },
  pill: {
    label: "Pill",
    silhouette: silhouette(
      "pill",
      '<rect x="12" y="48" width="204.54" height="132.54" rx="66" {{PAINT}}/>',
      0.7,
    ),
  },
  hex: {
    label: "Hex",
    silhouette: silhouette(
      "hex",
      '<path d="M114.27 10 L204 62 L204 166 L114.27 218 L24.54 166 L24.54 62 Z" {{PAINT}}/>',
      0.74,
    ),
  },
  diamond: {
    label: "Diamond",
    silhouette: silhouette(
      "diamond",
      '<rect x="30" y="30" width="168.54" height="168.54" rx="34" transform="rotate(45 114.27 114.27)" {{PAINT}}/>',
      0.68,
    ),
  },
  star: {
    label: "Star",
    silhouette: silhouette(
      "star",
      '<path d="M114.27 8 L139 80 L215 80 L153 124 L176 197 L114.27 153 L52 197 L75 124 L13 80 L89 80 Z" {{PAINT}}/>',
      0.59,
    ),
  },
  drop: {
    label: "Drop",
    silhouette: silhouette(
      "drop",
      '<path d="M114.27 8 C158 58 204 100 204 146 C204 195 164 220 114.27 220 C64 220 24 195 24 146 C24 100 70 58 114.27 8 Z" {{PAINT}}/>',
      0.7,
    ),
  },
  shield: {
    label: "Shield",
    silhouette: silhouette(
      "shield",
      '<path d="M114.27 8 L206 44 L194 148 C188 190 150 214 114.27 222 C78 214 40 190 34 148 L22 44 Z" {{PAINT}}/>',
      0.71,
    ),
  },
  ghost: {
    label: "Ghost",
    silhouette: silhouette(
      "ghost",
      '<path d="M36 214 L36 108 C36 54 72 22 114.27 22 C156 22 192 54 192 108 L192 214 L164 196 L136 214 L108 196 L80 214 L52 196 Z" {{PAINT}}/>',
      0.72,
    ),
  },
  classic: { label: "Classic", silhouette: CLASSIC },
};

/** Auto shape: roles read differently even before someone customizes a bot. */
const ROLE_SHAPE: Record<BotRole, MascotShapeId> = {
  coordinator: "star",
  researcher: "orb",
  builder: "hex",
  designer: "diamond",
  writer: "drop",
  operator: "shield",
  analyst: "ghost",
  guide: "bubble",
};

export function normalizeMascotShape(value: string | null | undefined): MascotShapeId | null {
  if (!value) return null;
  return (MASCOT_SHAPE_IDS as readonly string[]).includes(value) ? (value as MascotShapeId) : null;
}

export function shapeForRole(role: BotRole | null | undefined): MascotShapeId {
  return role ? ROLE_SHAPE[role] : "bubble";
}

const AUTO_SHAPE_IDS = MASCOT_SHAPE_IDS.filter((id) => id !== "classic");

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/** Auto shapes are stable per role + color but deliberately not one-shape-per
 * role: several bots often share a job, and they still deserve distinct
 * bodies. An explicit pick always wins. */
export function autoMascotShape(role: BotRole | null | undefined, color: string | null | undefined): MascotShapeId {
  if (!color) return shapeForRole(role);
  return AUTO_SHAPE_IDS[hash(`${role ?? ""}:${color}`) % AUTO_SHAPE_IDS.length];
}

export function mascotSilhouette(
  shape: string | null | undefined,
  role: BotRole | null | undefined,
  color?: string | null,
): CursorSilhouette {
  return MASCOT_SHAPES[normalizeMascotShape(shape) ?? autoMascotShape(role, color)].silhouette;
}
