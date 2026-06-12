// Celebration burst for standout darts (triples, bulls): a single sub-second
// pop of scoreboard-chip rectangles in amber + the scoring team's color,
// erupting from the tapped button. Deliberately not rainbow confetti — see
// the anti-references in PRODUCT.md. Plays once and settles, never loops.

export interface ConfettiPopOptions {
  /** Viewport coords to erupt from; defaults to bottom-center. */
  origin?: { x: number; y: number };
  /** CSS custom property for the scoring team's color, e.g. "--chart-2". */
  teamColorVar?: string;
  /** Bigger burst, reserved for the double bull. */
  big?: boolean;
}

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
  age: number;
  life: number;
  phase: number;
  tumble: number;
}

const GRAVITY = 2200; // px/s^2
const DRAG = 2.4; // exponential velocity decay per second

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let chips: Chip[] = [];
let rafId = 0;
let lastTime = 0;

function cssColor(varName: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw ? `hsl(${raw})` : "hsl(38 95% 55%)";
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("data-confetti", "");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function frame(now: number) {
  rafId = 0;
  if (!canvas || !ctx) return;

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const decay = Math.exp(-DRAG * dt);
  chips = chips.filter((c) => {
    c.age += dt;
    if (c.age >= c.life) return false;

    c.vx *= decay;
    c.vy = c.vy * decay + GRAVITY * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vrot * dt;

    const t = c.age / c.life;
    ctx!.save();
    ctx!.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx!.translate(c.x, c.y);
    ctx!.rotate(c.rot);
    // Cosine squish on the long axis reads as a 3D tumble without one.
    ctx!.scale(1, Math.abs(Math.cos(c.phase + c.age * c.tumble)) * 0.85 + 0.15);
    ctx!.fillStyle = c.color;
    ctx!.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx!.restore();
    return true;
  });

  if (chips.length > 0) {
    rafId = requestAnimationFrame(frame);
  } else {
    canvas.remove();
    canvas = null;
    ctx = null;
  }
}

export function confettiPop({
  origin,
  teamColorVar = "--chart-1",
  big = false,
}: ConfettiPopOptions = {}) {
  if (typeof window === "undefined") return;

  try {
    navigator.vibrate?.(big ? [14, 40, 18] : 12);
  } catch {
    /* unsupported */
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!ensureCanvas()) return;

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.8;

  const amber = cssColor("--primary");
  const team = cssColor(teamColorVar);
  const tick = cssColor("--foreground");
  // Amber carries the burst, the team color answers, warm white is a garnish.
  const palette = [amber, amber, amber, team, team, tick];

  const count = big ? 44 : 26;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = (big ? 520 : 420) + Math.random() * (big ? 620 : 480);
    const w = 3 + Math.random() * 3;
    chips.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 14,
      w,
      h: w * (1.8 + Math.random() * 1.4),
      color: palette[(Math.random() * palette.length) | 0],
      age: 0,
      life: 0.55 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      tumble: 6 + Math.random() * 8,
    });
  }

  if (!rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }
}
