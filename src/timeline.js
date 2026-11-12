// timeline.js: all timing for the clip, as pure functions of the frame index.
// No DOM, no clock, no randomness, so any frame can be rendered on its own and
// rendering the same frame twice gives the same pixels.
import CONFIG from '../film.config.js';

export { CONFIG };
export const FPS = 30;
export const W = 1080;
export const H = 1920;

const secs = Math.min(12, Math.max(4, Number(CONFIG.seconds) || 7));
export const TOTAL_FRAMES = Math.round(secs * FPS);
export const DUR = TOTAL_FRAMES / FPS;

const D2R = Math.PI / 180;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOutCubic = (u) => 1 - Math.pow(1 - clamp01(u), 3);
export const easeOutQuart = (u) => 1 - Math.pow(1 - clamp01(u), 4);
export const easeInOutSine = (u) => -(Math.cos(Math.PI * clamp01(u)) - 1) / 2;
const lerp = (a, b, u) => a + (b - a) * u;

// ---------------- the one shot ----------------
// 0 .. SPIN_END:   the phone flies in from the distance, spinning one and a quarter turns,
//                  and settles at a three-quarter angle.
// SPIN_END .. end: a slow drift of the angle and a gentle camera push-in.
export const SPIN_END = 75;            // 2.5 s
export const SPIN_TURNS_DEG = 450;     // starts edge-on, spins 1.25 turns
export const REST_YAW_DEG = -17;       // three-quarter rest angle reads as a 3D object

export function phoneYaw(frame) {
  if (frame < SPIN_END) {
    const e = easeOutCubic(frame / SPIN_END);
    return (-SPIN_TURNS_DEG * (1 - e) + REST_YAW_DEG * e) * D2R;
  }
  const u = (frame - SPIN_END) / Math.max(1, TOTAL_FRAMES - SPIN_END);
  return (REST_YAW_DEG + 9 * easeInOutSine(u)) * D2R; // drifts from -17 to -8 degrees
}

export function phonePitch(frame) {
  // a small tilt that settles as the phone lands
  return 8 * (1 - easeOutCubic(frame / SPIN_END)) * D2R;
}

export function phoneY(frame) {
  // rises into place from below while spinning
  return -0.9 * (1 - easeOutQuart(frame / SPIN_END));
}

export const CAM_FOV = 34;
export const VIEW_SHIFT = 0.03; // image shifted down a little so the title sits above the phone

export function cameraPose(frame) {
  let z;
  if (frame < SPIN_END) z = lerp(15.5, 8.3, easeOutCubic(frame / SPIN_END));
  else z = lerp(8.3, 7.7, easeInOutSine((frame - SPIN_END) / Math.max(1, TOTAL_FRAMES - SPIN_END)));
  return { pos: { x: 0, y: 0.05, z }, look: { x: 0, y: 0.02, z: 0 } };
}

// ---------------- title card ----------------
export const TITLE_IN = 54;          // 1.8 s: enters as the spin settles
export const ENTER_FRAMES = 16;      // fade + slide up + blur-in
export const TYPE = { line1: 96, line2: 56, minLine1: 64, maxWidth: 1000, centerY: 330, gap: 26 };

// '*word*' marks the accent word; {name} is replaced by CONFIG.name. Returns [{t, accent}].
export function parseLine(str) {
  const out = [];
  String(str).replace(/\{name\}/g, CONFIG.name).split(/(\*[^*]+\*)/).forEach((p) => {
    if (!p) return;
    if (p.startsWith('*') && p.endsWith('*')) out.push({ t: p.slice(1, -1), accent: true });
    else out.push({ t: p, accent: false });
  });
  return out;
}

// ---------------- fades ----------------
export const FADE_IN_END = 12;
export const FADE_OUT_START = TOTAL_FRAMES - 18;
export function fadeAlpha(frame) {
  let a = 0;
  if (frame < FADE_IN_END) a = 1 - frame / FADE_IN_END;
  if (frame >= FADE_OUT_START) {
    const u = clamp01((frame - FADE_OUT_START) / (TOTAL_FRAMES - 1 - FADE_OUT_START));
    a = Math.max(a, u * u);
  }
  return a;
}
