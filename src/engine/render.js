// The screen: 320 x 180 art pixels in four color layers that share one light buffer, composited with lighting.
//
//   bg     sky, parallax, terrain, props          lit by ambient + light
//   back   effects behind characters               emissive (bright pixels ignore the dark)
//   act    characters, enemies, foreground         lit by ambient + light
//   front  effects in front of characters          emissive
//   light  additive glow from every effect and light source: it lights the lit layers and blooms over everything
//   ui     HUD and menus, drawn last, never lit
//
// Every layer is a pixelfx frame (same shape as the library's), so any effect draws straight into it at world
// coordinates: the frames' ox, oy follow the camera.

import { createFrame, painterFor } from "../pfx.js";

export const W = 320, H = 180;

export class Screen {
  constructor() {
    this.light = new Uint32Array(W * H);
    const mk = () => {
      const f = createFrame(W, H);
      f.light = this.light;
      return f;
    };
    this.bg = mk();
    this.back = mk();
    this.act = mk();
    this.front = mk();
    this.ui = createFrame(W, H);
    this.layers = { bg: this.bg, back: this.back, act: this.act, front: this.front };
    // ambient light (0..1 per channel), how much the light buffer lights lit layers, and how much it blooms on top
    this.amb = [1, 1, 1];
    this.gain = 1.4;
    this.bloom = 1;
    this.fade = 0; // 0..1 fade to black (transitions)
    this.flash = 0; // 0..1 white flash
    this.tint = null; // [r, g, b, k] color grade over the world (hit flashes, eclipse, poison)
    this.camX = 0;
    this.camY = 0;
  }
  /** Put the camera's top-left at (x, y) in world pixels (rounded). */
  camera(x, y) {
    this.camX = Math.round(x);
    this.camY = Math.round(y);
    for (const f of [this.bg, this.back, this.act, this.front]) {
      f.ox = this.camX;
      f.oy = this.camY;
    }
  }
  clear() {
    this.bg.color.fill(0xff000000);
    this.back.color.fill(0);
    this.act.color.fill(0);
    this.front.color.fill(0);
    this.light.fill(0);
    this.ui.color.fill(0);
    this.ui.light.fill(0);
  }
  painter(layer) {
    return painterFor(this.layers[layer] ?? this[layer]);
  }
  /** Everything into RGBA bytes (W * H * 4). */
  composite(out) {
    const n = W * H, B = this.bg.color, K = this.back.color, A = this.act.color, F = this.front.color, L = this.light;
    const UC = this.ui.color, UL = this.ui.light;
    const ar = this.amb[0], ag = this.amb[1], ab = this.amb[2], gain = this.gain / 255, bloom = this.bloom;
    const fade = 1 - this.fade, fl = this.flash * 255, tint = this.tint;
    const tr = tint ? tint[0] : 0, tg = tint ? tint[1] : 0, tb = tint ? tint[2] : 0, tk = tint ? tint[3] : 0;
    for (let i = 0; i < n; i++) {
      const l = L[i], lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
      // how lit this pixel is
      let fr = ar + lr * gain, fg = ag + lg * gain, fb = ab + lb * gain;
      if (fr > 1.25) fr = 1.25;
      if (fg > 1.25) fg = 1.25;
      if (fb > 1.25) fb = 1.25;
      let c = B[i];
      let r = (c & 255) * fr, g = ((c >>> 8) & 255) * fg, b = ((c >>> 16) & 255) * fb;
      c = K[i];
      if (c) {
        const a = c >>> 24, cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
        // emissive: bright pixels keep their color in the dark, dark ones (smoke) take the scene's light
        const e = (cr + cg + cg + cb) * (1 / 1020);
        const er = fr + (1 - fr) * e, eg = fg + (1 - fg) * e, eb = fb + (1 - fb) * e;
        if (a === 255) (r = cr * er), (g = cg * eg), (b = cb * eb);
        else {
          const k = a / 255, j = 1 - k;
          r = cr * er * k + r * j; g = cg * eg * k + g * j; b = cb * eb * k + b * j;
        }
      }
      c = A[i];
      if (c) {
        const a = c >>> 24, cr = (c & 255) * fr, cg = ((c >>> 8) & 255) * fg, cb = ((c >>> 16) & 255) * fb;
        if (a === 255) (r = cr), (g = cg), (b = cb);
        else {
          const k = a / 255, j = 1 - k;
          r = cr * k + r * j; g = cg * k + g * j; b = cb * k + b * j;
        }
      }
      c = F[i];
      if (c) {
        const a = c >>> 24, cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
        const e = (cr + cg + cg + cb) * (1 / 1020);
        const er = fr + (1 - fr) * e, eg = fg + (1 - fg) * e, eb = fb + (1 - fb) * e;
        if (a === 255) (r = cr * er), (g = cg * eg), (b = cb * eb);
        else {
          const k = a / 255, j = 1 - k;
          r = cr * er * k + r * j; g = cg * eg * k + g * j; b = cb * eb * k + b * j;
        }
      }
      // bloom: the light buffer added over the top, as pixelfx composites it
      r += lr * bloom; g += lg * bloom; b += lb * bloom;
      if (tk) (r += (tr - r) * tk), (g += (tg - g) * tk), (b += (tb - b) * tk);
      if (fl) (r += fl), (g += fl), (b += fl);
      r *= fade; g *= fade; b *= fade;
      // the UI over everything
      c = UC[i];
      if (c) {
        const a = c >>> 24;
        if (a === 255) (r = c & 255), (g = (c >>> 8) & 255), (b = (c >>> 16) & 255);
        else {
          const k = a / 255, j = 1 - k;
          r = (c & 255) * k + r * j; g = ((c >>> 8) & 255) * k + g * j; b = ((c >>> 16) & 255) * k + b * j;
        }
      }
      const u = UL[i];
      if (u) (r += u & 255), (g += (u >>> 8) & 255), (b += (u >>> 16) & 255);
      const o = i << 2;
      out[o] = r > 255 ? 255 : r;
      out[o + 1] = g > 255 ? 255 : g;
      out[o + 2] = b > 255 ? 255 : b;
      out[o + 3] = 255;
    }
    return out;
  }
}

// ---- fast raw drawing into a frame, world coordinates, no painter
/** Opaque pixel at world (x, y). */
export function px(f, x, y, c) {
  x -= f.ox; y -= f.oy;
  if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.color[y * f.w + x] = c;
}
/** Add light at world (x, y). */
export function addLight(L, w, h, x, y, c, k) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = y * w + x, d = L[i];
  const r = Math.min(255, (d & 255) + (c & 255) * k) | 0, g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k) | 0;
  const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k) | 0;
  L[i] = (255 << 24) | (b << 16) | (g << 8) | r;
}
/** A soft radial light at world (x, y): k at the center, falling off to 0 at radius r. Cheap: a precomputed falloff. */
const FALL = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) {
  const d = Math.sqrt(i / 1024), f = 1 - d;
  FALL[i] = f * f;
}
export function glow(f, x, y, r, c, k) {
  if (r < 1 || k <= 0.004) return;
  const L = f.light, w = f.w, h = f.h, cx = x - f.ox, cy = y - f.oy, r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  const cr = (c & 255) * k, cg = ((c >>> 8) & 255) * k, cb = ((c >>> 16) & 255) * k;
  for (let sy = y0; sy <= y1; sy++) {
    const dy = sy + 0.5 - cy, dy2 = dy * dy;
    for (let sx = x0; sx <= x1; sx++) {
      const dx = sx + 0.5 - cx, d2 = dx * dx + dy2;
      if (d2 >= r2) continue;
      const q = FALL[((d2 / r2) * 1024) | 0], i = sy * w + sx, d = L[i];
      const rr = Math.min(255, (d & 255) + cr * q) | 0, gg = Math.min(255, ((d >>> 8) & 255) + cg * q) | 0, bb = Math.min(255, ((d >>> 16) & 255) + cb * q) | 0;
      L[i] = (255 << 24) | (bb << 16) | (gg << 8) | rr;
    }
  }
}
/** Filled rectangle in screen space (no camera), alpha-blended if a < 1. */
export function rect(f, x, y, w, h, c, a = 1) {
  const X0 = Math.max(0, Math.round(x)), Y0 = Math.max(0, Math.round(y)), X1 = Math.min(f.w, Math.round(x + w)), Y1 = Math.min(f.h, Math.round(y + h));
  const C = f.color;
  if (a >= 1) {
    for (let yy = Y0; yy < Y1; yy++) C.fill(c, yy * f.w + X0, yy * f.w + X1);
    return;
  }
  for (let yy = Y0; yy < Y1; yy++)
    for (let xx = X0; xx < X1; xx++) {
      const i = yy * f.w + xx;
      C[i] = blendOver(C[i], c, a);
    }
}
/** c over d at alpha a (a color with its own alpha comes out at the combined alpha). */
export function blendOver(d, c, a) {
  if (a <= 0) return d;
  const da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa, j = 1 - k;
  const r = ((c & 255) * k + (d & 255) * j) & 255, g = (((c >>> 8) & 255) * k + ((d >>> 8) & 255) * j) & 255, b = (((c >>> 16) & 255) * k + ((d >>> 16) & 255) * j) & 255;
  return ((((oa * 255) | 0) & 255) << 24) | (b << 16) | (g << 8) | r;
}
