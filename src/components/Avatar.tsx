// Bot avatar — the Blob Studio "Cursor" mascot (CursorAvatar.tsx), wrapped
// in the app's historical CrewAvatar API so no call site changes: per-bot
// color becomes a body gradient, the app's one-shot motion beats borrow the
// face/state for a moment, and the eyes follow the pointer. The previous
// hand-built Crew body + face engine (crew-engine/face/driver) is gone;
// CursorAvatar owns morphing, blinking, drift, body motion and effects.
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BOT_ROLE_META,
  CREW_COLORS,
  normalizeRole,
  type BotRole,
  type CrewColor,
  type CrewMotion,
  type CrewState,
} from "@/lib/mascot";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Compass,
  MessageCircle,
  Microscope,
  Palette,
  PenLine,
  Radar,
  Wrench,
} from "lucide-react";
import {
  CursorAvatar,
  DEFAULT_SILHOUETTE,
  type CursorAvatarHandle,
  type CursorSilhouette,
} from "./CursorAvatar";

/**
 * The pack's baked-in silhouette was exported with the body fill hardcoded
 * to black instead of the {{GRADIENT}} placeholder the component
 * substitutes, which painted every bot the same. Restore the slot so the
 * per-bot gradient actually lands on the body.
 */
const GRADIENT_SILHOUETTE: CursorSilhouette = {
  ...DEFAULT_SILHOUETTE,
  body: DEFAULT_SILHOUETTE.body.replace(/fill="#000000"/g, 'fill="{{GRADIENT}}"'),
};

/**
 * Legacy face-placement knobs from the Crew body era. The cursor mascot
 * places its own face; these remain only so the preview harness's sliders
 * keep compiling — the matching props are accepted and ignored.
 */
export const FACE_X = 80;
export const FACE_Y = 102;
export const FACE_SCALE = 0.47;
export const EYE_SCALE = 1.12;
export const MOUTH_WEIGHT = 11;

/**
 * How far the pointer may pull the eyes. Facing forward the full range is
 * safe; with the expressions' authored gaze they already start off-centre.
 */
const POINTER_GAZE = { forward: 1, authored: 0.25 };

/**
 * What a one-shot motion does while it plays: CursorAvatar animates the body
 * per state, so borrowing the state for a beat moves body and face together.
 */
interface MotionFaces
  extends Partial<
    Record<Exclude<CrewMotion, "none">, { state?: CrewState; blink?: boolean; spin?: number }>
  > {}

const MOTION_FACE: MotionFaces = {
  arrive: { state: "spawning", spin: 900 },
  switch: { state: "waking", spin: 620 },
  customize: { state: "proud", blink: true },
  alert: { state: "alerting" },
  thinking: { state: "thinking" },
  working: { state: "working" },
  launch: { state: "loading" },
  success: { state: "happy", blink: true },
  celebrate: { state: "celebrate", spin: 700 },
  blink: { blink: true },
  surprise: { state: "surprised", blink: true },
  failure: { state: "sad" },
};

/** How long a one-shot motion holds its state before the bot's own returns. */
const MOTION_FACE_MS = 1400;

/** Channel-wise mix of a hex color toward another, t in 0..1. */
function mix(hex: string, toward: string, t: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const channel = (shift: number) => {
    const va = (a >> shift) & 0xff;
    const vb = (b >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[channel(16), channel(8), channel(0)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Bot color -> the mascot's three-stop body gradient (highlight, base,
 * shadow), with the same light/dark spread as the pack's default green
 * ["#9FE6B5", "#3FAE6E", "#1C7A4C"].
 */
const gradientFor = (color: CrewColor, roleColor?: string): [string, string, string] => {
  const fill = CREW_COLORS[color] ?? CREW_COLORS.green;
  // The job badge is the identity; tint the body toward it so two bots with
  // the same chosen color still read as different roles at a glance.
  const base = roleColor ? mix(fill, roleColor, 0.42) : fill;
  return [mix(base, "#ffffff", 0.55), base, mix(base, "#000000", 0.42)];
};

export type CrewAvatarHandle = CursorAvatarHandle;

const ROLE_ICONS = {
  compass: Compass,
  microscope: Microscope,
  wrench: Wrench,
  palette: Palette,
  pen: PenLine,
  radar: Radar,
  chart: BarChart3,
  message: MessageCircle,
} as const;

/** The small job badge shown on an avatar. The picker uses the same glyph so
 * the identity a person chooses is the one they see in the sidebar. */
export function BotRoleIcon({ role, size = 28 }: { role: BotRole | string | null | undefined; size?: number }) {
  const resolved = normalizeRole(typeof role === "string" ? role : null) ?? "guide";
  const meta = BOT_ROLE_META[resolved];
  const Icon = ROLE_ICONS[meta.icon];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-sm"
      style={{ width: size, height: size, backgroundColor: meta.color }}
    >
      <Icon size={Math.max(10, Math.round(size * 0.56))} strokeWidth={2.3} />
    </span>
  );
}

export type CrewAvatarProps = {
  color: CrewColor;
  /** Job badge and resting expression. A caller that has the bot should pass
   * displayRole(bot); the component itself never guesses from color. */
  role?: BotRole | string | null;
  /** Named behaviour — drives the expression pool, its cadence and blinking. */
  state?: CrewState;
  /** Pin one of the 25 faces and stop the state's own drift. */
  expression?: number;
  size?: number;
  label?: string;
  motion?: CrewMotion;
  motionKey?: number;
  /** Head turn in degrees. */
  turn?: number;
  gaze?: { x?: number; y?: number };
  spring?: number;
  eyeScale?: number;
  showMouth?: boolean;
  mouthStroke?: number;
  /**
   * Face the viewer at turn 0, cancelling each expression's authored gaze
   * direction. Off restores the engine's own drawn-in directions.
   */
  forward?: boolean;
  /** Let the eyes follow the pointer across this avatar. */
  trackPointer?: boolean;
  /** Run the animation. Off renders the state's resting face. */
  animated?: boolean;
  /** Legacy Crew face-placement knobs — accepted, ignored. */
  eyeSpacing?: number;
  faceX?: number;
  faceY?: number;
  faceScale?: number;
};

function CrewAvatarComponent(
  {
    color,
    role,
    state = "idle",
    expression,
    size = 44,
    label,
    motion = "none",
    motionKey = 0,
    turn,
    gaze,
    spring,
    eyeScale,
    showMouth,
    mouthStroke,
    forward = true,
    trackPointer = true,
    animated = true,
  }: CrewAvatarProps,
  ref: React.Ref<CrewAvatarHandle>,
) {
  const inner = useRef<CursorAvatarHandle>(null);
  useImperativeHandle(ref, () => ({
    blink: () => inner.current?.blink(),
    spin: (durationMs?: number) => inner.current?.spin(durationMs),
    setExpression: (index: number) => inner.current?.setExpression(index),
  }));

  // A one-shot motion borrows the state for a moment, then hands it back.
  const [motionState, setMotionState] = useState<CrewState | null>(null);
  useEffect(() => {
    if (motion === "none" || !animated) return;
    const beat = MOTION_FACE[motion];
    if (!beat) return;
    if (beat.blink) inner.current?.blink();
    if (beat.spin) inner.current?.spin(beat.spin);
    if (!beat.state) return;
    setMotionState(beat.state);
    const timer = setTimeout(() => setMotionState(null), MOTION_FACE_MS);
    return () => clearTimeout(timer);
  }, [motion, motionKey, animated]);

  // Pointer-follow gaze, composed with any gaze the caller pins.
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const range = forward ? POINTER_GAZE.forward : POINTER_GAZE.authored;
  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!trackPointer || !animated) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)) * range,
      y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)) * range,
    });
  };
  const onPointerLeave = () => setPointer({ x: 0, y: 0 });

  const roleMeta = role ? BOT_ROLE_META[normalizeRole(role) ?? "guide"] : null;
  const RoleIcon = roleMeta ? ROLE_ICONS[roleMeta.icon] : null;
  const badgeSize = Math.max(15, Math.min(34, Math.round(size * 0.40)));
  const rolePulse = state === "working" || state === "searching" || state === "radar";

  return (
    <span
      className="relative inline-flex shrink-0"
      onPointerMove={trackPointer && animated ? onPointerMove : undefined}
      onPointerLeave={trackPointer && animated ? onPointerLeave : undefined}
    >
      {roleMeta && size >= 30 && (
        <span
          aria-hidden="true"
          className="role-aura absolute rounded-full"
          style={{
            inset: -Math.round(size * 0.08),
            background: `radial-gradient(circle, ${roleMeta.color}66 0%, ${roleMeta.color}22 46%, transparent 72%)`,
          }}
        />
      )}
      <CursorAvatar
        ref={inner}
        state={motionState ?? state}
        expression={expression}
        size={size}
        silhouette={GRADIENT_SILHOUETTE}
        gradient={gradientFor(color, roleMeta?.color)}
        title={label ?? null}
        lookAround={forward ? 0 : 1}
        gaze={{ x: (gaze?.x ?? 0) + pointer.x, y: (gaze?.y ?? 0) + pointer.y }}
        turn={turn}
        spring={spring}
        eyeScale={eyeScale}
        showMouth={showMouth}
        mouthStroke={mouthStroke}
        paused={!animated}
      />
      {RoleIcon && roleMeta && size >= 22 && (
        <span
          className={cn(
            "absolute -bottom-px -right-px flex items-center justify-center rounded-full border-2 border-panel text-white shadow-sm",
            animated && (rolePulse ? "role-accessory-busy" : "role-accessory"),
          )}
          style={{ width: badgeSize, height: badgeSize, backgroundColor: roleMeta.color }}
          title={roleMeta.label}
          aria-hidden="true"
        >
          <RoleIcon size={Math.max(9, Math.round(badgeSize * 0.56))} strokeWidth={2.4} />
        </span>
      )}
    </span>
  );
}

export const CrewAvatar = memo(forwardRef(CrewAvatarComponent));

export function InitialsAvatar({
  initials,
  size = 32,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-raised text-ink-secondary font-medium"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
