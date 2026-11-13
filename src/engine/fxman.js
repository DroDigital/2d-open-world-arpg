// Live pixelfx effects in the world. Every effect in the library plays through here, at world coordinates.
//
// Pure loops (torches, waterfalls, critters...) are functions of time alone, so the first time a frame is needed it is
// drawn once into a scratch frame, cropped, and kept: from then on it is a blit. Simulated effects (create) run live
// at 120 Hz, as the library intends. Instances can follow an entity, flip, recolor, fade out and be culled off screen.

import { FX, createFx, createFrame, clearFrame, painterFor, resolveOptions } from "../pfx.js";
import { blendOver } from "./render.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const MEMO_FPS = 30, MEMO_LIMIT = 200 * 1024 * 1024;
const memos = new Map();
let memoBytes = 0, memoClock = 0;
const scratch = new Map();
function scratchFor(w, h) {
  const k = w * 10000 + h;
  let s = scratch.get(k);
  if (!s) {
    const back = createFrame(w, h), front = createFrame(w, h);
    front.light = back.light;
    scratch.set(k, (s = { back, front }));
  }
  return s;
}

// one cropped layer of a memo frame
function crop(buf, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++)
      if (buf[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, data = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) data.set(buf.subarray((y0 + y) * w + x0, (y0 + y) * w + x1 + 1), y * cw);
  return { x0, y0, w: cw, h: ch, data };
}

class Memo {
  constructor(mod, opts, flip, pad) {
    const m = mod.meta;
    this.mod = mod;
    this.opts = opts;
    this.flip = flip;
    this.n = Math.max(1, Math.round(m.duration * MEMO_FPS));
    this.frames = new Array(this.n).fill(null);
    this.pad = pad;
    this.W = m.size[0] + pad * 2;
    this.H = m.size[1] + pad * 2;
    this.OX = flip ? m.size[0] - m.origin[0] + pad : m.origin[0] + pad;
    this.OY = m.origin[1] + pad;
    this.used = 0;
  }
  frame(t) {
    const m = this.mod.meta, i = Math.floor(((t % m.duration) / m.duration) * this.n + 1e-6) % this.n;
    let f = this.frames[i];
    if (f) return f;
    const { back, front } = scratchFor(this.W, this.H);
    clearFrame(back);
    clearFrame(front);
    const tt = (i / this.n) * m.duration, o = this.opts;
    if (this.mod.drawBack) {
      const p = painterFor(back).place(this.OX, this.OY, this.flip, 0);
      p.lightK = o.light ?? 1;
      this.mod.drawBack(p, tt, o);
    }
    const p = painterFor(front).place(this.OX, this.OY, this.flip, 0);
    p.lightK = o.light ?? 1;
    this.mod.draw(p, tt, o);
    f = { back: crop(back.color, this.W, this.H), front: crop(front.color, this.W, this.H), light: crop(front.light, this.W, this.H) };
    let bytes = 64;
    for (const k of ["back", "front", "light"]) if (f[k]) bytes += f[k].data.byteLength;
    f.bytes = bytes;
    memoBytes += bytes;
    this.frames[i] = f;
    if (memoBytes > MEMO_LIMIT) evict();
    return f;
  }
}
function evict() {
  const list = [...memos.entries()].sort((a, b) => a[1].used - b[1].used);
  for (const [k, m] of list) {
    if (memoBytes < MEMO_LIMIT * 0.7) break;
    for (const f of m.frames) if (f) memoBytes -= f.bytes;
    memos.delete(k);
  }
}
const RESERVED = new Set(["x", "y", "flip", "follow", "life", "layer", "memo", "back", "front", "delay", "onEnd", "dx", "dy", "tag", "actorKey", "ui", "speed", "z", "k", "lightK", "rate", "keep", "followFlip", "behind"]);
function memoFor(id, mod, o, flip) {
  const parts = [id, flip ? 1 : 0, o.actorKey ?? ""];
  for (const k of Object.keys(o).sort()) if (!RESERVED.has(k) && k !== "actor" && o[k] !== undefined) parts.push(k + "=" + JSON.stringify(o[k]));
  const key = parts.join("|");
  let m = memos.get(key);
  if (!m) {
    const clean = {};
    for (const k of Object.keys(o)) if (!RESERVED.has(k) && o[k] !== undefined) clean[k] = o[k];
    memos.set(key, (m = new Memo(mod, resolveOptions(mod.meta, clean), flip, 24)));
  }
  m.used = ++memoClock;
  return m;
}

/** Blit one cropped layer at screen offset (sx, sy) into frame f (color), with dithered alpha a. */
function blitColor(f, L, sx, sy, a, flipMirror) {
  if (!L) return;
  const W = f.w, H = f.h, C = f.color, d = L.data, lw = L.w;
  const X0 = sx + L.x0, Y0 = sy + L.y0;
  const ya = Math.max(0, -Y0), yb = Math.min(L.h, H - Y0), xa = Math.max(0, -X0), xb = Math.min(lw, W - X0);
  for (let y = ya; y < yb; y++) {
    const row = (Y0 + y) * W + X0, src = y * lw, by = ((Y0 + y) & 3) << 2;
    for (let x = xa; x < xb; x++) {
      const c = d[src + x];
      if (!c) continue;
      if (a < 1 && a <= BAYER[by | ((X0 + x) & 3)]) continue;
      const ca = c >>> 24;
      C[row + x] = ca === 255 ? c : blendOver(C[row + x], c, ca / 255);
    }
  }
}
function blitLight(Lb, W, H, L, sx, sy, k) {
  if (!L || k <= 0.01) return;
  const d = L.data, lw = L.w, X0 = sx + L.x0, Y0 = sy + L.y0;
  const ya = Math.max(0, -Y0), yb = Math.min(L.h, H - Y0), xa = Math.max(0, -X0), xb = Math.min(lw, W - X0);
  const full = k >= 0.999;
  for (let y = ya; y < yb; y++) {
    const row = (Y0 + y) * W + X0, src = y * lw;
    for (let x = xa; x < xb; x++) {
      const s = d[src + x];
      if (!(s & 0xffffff)) continue;
      const i = row + x, o = Lb[i];
      let r = s & 255, g = (s >>> 8) & 255, b = (s >>> 16) & 255;
      if (!full) (r *= k), (g *= k), (b *= k);
      r += o & 255; g += (o >>> 8) & 255; b += (o >>> 16) & 255;
      Lb[i] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
    }
  }
}

const FADE = 0.3;
let uid = 1;

export class FxMan {
  constructor() {
    this.list = [];
    this.count = 0;
    this.stats = { live: 0, memo: 0, culled: 0 };
  }
  /**
   * Play effect `id` (e.g. "fire/torch") with its origin at world (x, y).
   * o: { flip, palette, seed, light, ...the effect's options,
   *      follow: an object with x, y (and optional dx, dy offsets) to stay on; life: seconds before a loop fades out;
   *      layer: "world" (default) | "act" (drawn as a lit creature) | "ui" (screen space, top layer);
   *      memo: false to always draw live; delay: seconds before it starts; speed: time scale }
   */
  spawn(id, x, y, o = {}) {
    const mod = FX[id];
    if (!mod) throw new Error(`no effect ${id}`);
    const meta = mod.meta;
    const usesActor = !!meta.actor;
    const memo = o.memo !== false && !mod.create && meta.loop && meta.duration <= 6 && (!usesActor || o.actorKey);
    const inst = {
      uid: uid++, id, mod, meta, x, y, flip: !!o.flip, o, t: 0, delay: o.delay ?? 0, life: o.life ?? Infinity, stopAt: Infinity,
      follow: o.follow ?? null, dx: o.dx ?? 0, dy: o.dy ?? 0, layer: o.layer ?? "world", speed: o.speed ?? 1, dead: false, visible: true,
      memo: memo ? memoFor(id, mod, o, !!o.flip) : null, live: null, z: o.z ?? 0,
    };
    if (!memo) {
      const clean = {};
      for (const k of Object.keys(o)) if (!RESERVED.has(k) && o[k] !== undefined) clean[k] = o[k];
      inst.live = createFx(mod, { ...clean, x, y, flip: !!o.flip });
    }
    this.list.push(inst);
    this.list.sort((a, b) => a.z - b.z);
    return inst;
  }
  /** Let an instance end: loops fade out, one-shots are cut. */
  stop(inst) {
    if (!inst || inst.dead) return;
    if (inst.stopAt === Infinity) inst.stopAt = inst.t;
    inst.live?.stop();
  }
  kill(inst) {
    if (inst) inst.dead = true;
  }
  clear(pred = () => true) {
    for (const i of this.list) if (pred(i)) i.dead = true;
    this.list = this.list.filter((i) => !i.dead);
  }
  update(dt) {
    for (const i of this.list) {
      if (i.dead) continue;
      let d = dt * i.speed;
      if (i.delay > 0) {
        i.delay -= d;
        if (i.delay > 0) continue;
        d = -i.delay;
        i.delay = 0;
      }
      if (i.follow) {
        if (i.follow.dead && !i.o.keep) this.stop(i);
        i.x = i.follow.x + i.dx;
        i.y = i.follow.y + i.dy;
        if (i.o.followFlip) i.flip = i.follow.face < 0;
      }
      i.t += d;
      if (i.live) {
        i.live.options.x = i.x;
        i.live.options.y = i.y;
        i.live.options.flip = i.flip;
        i.live.update(d);
        if (i.live.done()) i.dead = true;
      } else if (!i.meta.loop && i.t >= i.meta.duration) i.dead = true;
      if (i.t >= i.life && i.stopAt === Infinity) this.stop(i);
      if (i.stopAt !== Infinity && i.t - i.stopAt >= FADE) i.dead = true;
    }
    if (this.list.some((i) => i.dead)) {
      for (const i of this.list) if (i.dead && i.o.onEnd) i.o.onEnd(i);
      this.list = this.list.filter((i) => !i.dead);
    }
  }
  /** Is the effect's canvas on screen (with a margin)? */
  onScreen(i, cx, cy, W, H, m = 32) {
    if (i.layer === "ui") return true;
    const [w, h] = i.meta.size, [ox, oy] = i.meta.origin;
    const x0 = i.flip ? i.x - (w - ox) : i.x - ox, y0 = i.y - oy;
    return x0 + w > cx - m && x0 < cx + W + m && y0 + h > cy - m && y0 < cy + H + m;
  }
  draw(screen) {
    const W = screen.bg.w, H = screen.bg.h, cx = screen.camX, cy = screen.camY;
    this.stats.live = this.stats.memo = this.stats.culled = 0;
    for (const i of this.list) {
      if (i.dead || i.delay > 0) continue;
      if (!this.onScreen(i, cx, cy, W, H)) {
        this.stats.culled++;
        continue;
      }
      const fade = i.stopAt === Infinity ? 1 : Math.max(0, 1 - (i.t - i.stopAt) / FADE);
      const ui = i.layer === "ui";
      const backF = ui ? screen.ui : i.layer === "act" ? screen.act : screen.back;
      const frontF = ui ? screen.ui : i.layer === "act" ? screen.act : i.o.behind ? screen.back : screen.front;
      if (i.memo) {
        this.stats.memo++;
        const f = i.memo.frame(i.t * (i.o.rate ?? 1));
        const sx = Math.round(i.x) - (ui ? 0 : cx) - i.memo.OX, sy = Math.round(i.y) - (ui ? 0 : cy) - i.memo.OY;
        blitColor(backF, f.back, sx, sy, fade);
        blitColor(frontF, f.front, sx, sy, fade);
        blitLight(ui ? screen.ui.light : screen.light, W, H, f.light, sx, sy, fade * (i.o.lightK ?? 1));
      } else if (i.o.k > 1) {
        // a giant's effect: drawn at 1x into a scratch frame, then blown up
        this.stats.live++;
        const k = i.o.k, m = i.meta, pad = 24, SW = m.size[0] + pad * 2, SH = m.size[1] + pad * 2;
        const OX = i.flip ? m.size[0] - m.origin[0] + pad : m.origin[0] + pad, OY = m.origin[1] + pad;
        const sc = scratchFor(SW, SH);
        clearFrame(sc.back);
        clearFrame(sc.front);
        const lo = i.live.options, sx0 = lo.x, sy0 = lo.y;
        lo.x = OX;
        lo.y = OY;
        i.live.draw(sc.back, "back");
        i.live.draw(sc.front, "front");
        lo.x = sx0;
        lo.y = sy0;
        const fake = { OX, OY, frame: () => ({ back: crop(sc.back.color, SW, SH), front: crop(sc.front.color, SW, SH), light: crop(sc.front.light, SW, SH) }) };
        blitMemo(screen, fake, 0, i.x, i.y, { k, layer: i.layer === "act" ? "act" : "world" });
      } else {
        this.stats.live++;
        if (ui) {
          i.live.draw(screen.ui);
        } else {
          i.live.draw(backF, "back");
          i.live.draw(frontF, "front");
        }
      }
    }
  }
}

/** The memo (cached frames) of a pure loop effect with options o, for things that draw themselves from it. */
export function memoOf(id, o = {}, flip = false) {
  return memoFor(id, FX[id], o, flip);
}
/** The box that a memo's frames cover, relative to its origin (sampled): { x0, y0, x1, y1 }. */
export function memoBounds(m) {
  if (m.bounds) return m.bounds;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const D = m.mod.meta.duration;
  for (let i = 0; i < 8; i++) {
    const f = m.frame((i / 8) * D);
    for (const L of [f.back, f.front]) {
      if (!L) continue;
      x0 = Math.min(x0, L.x0 - m.OX); y0 = Math.min(y0, L.y0 - m.OY);
      x1 = Math.max(x1, L.x0 + L.w - m.OX); y1 = Math.max(y1, L.y0 + L.h - m.OY);
    }
  }
  return (m.bounds = { x0, y0, x1, y1 });
}
/**
 * Draw a memo frame at time t with its origin at world (x, y). opts: { layer: "act" | "world", flash, tint: [c, k],
 * alpha, k (whole-number scale), light }.
 */
export function blitMemo(screen, m, t, x, y, opts = {}) {
  const f = m.frame(t), k = opts.k ?? 1, cx = screen.camX, cy = screen.camY, W = screen.bg.w, H = screen.bg.h;
  const backF = opts.layer === "act" ? screen.act : screen.back, frontF = opts.layer === "act" ? screen.act : screen.front;
  if (k === 1 && !opts.flash && !opts.tint) {
    const sx = Math.round(x) - cx - m.OX, sy = Math.round(y) - cy - m.OY;
    blitColor(backF, f.back, sx, sy, opts.alpha ?? 1);
    blitColor(frontF, f.front, sx, sy, opts.alpha ?? 1);
    blitLight(screen.light, W, H, f.light, sx, sy, (opts.alpha ?? 1) * (opts.light ?? 1));
    return f;
  }
  // scaled, flashed or tinted: pixel by pixel
  const a = opts.alpha ?? 1, flash = opts.flash, tint = opts.tint;
  const put = (F, L, isLight) => {
    if (!L) return;
    const d = L.data, X0 = Math.round(x) - cx - m.OX * k + L.x0 * k, Y0 = Math.round(y) - cy - m.OY * k + L.y0 * k;
    for (let yy = 0; yy < L.h; yy++)
      for (let xx = 0; xx < L.w; xx++) {
        let c = d[yy * L.w + xx];
        if (!c || (isLight && !(c & 0xffffff))) continue;
        if (!isLight) {
          if (flash) c = (c & 0xff000000) | 0xffffff;
          else if (tint) c = (c & 0xff000000) | (mixRGB(c, tint[0], tint[1]) & 0xffffff);
        }
        for (let j = 0; j < k; j++)
          for (let i = 0; i < k; i++) {
            const px = X0 + xx * k + i, py = Y0 + yy * k + j;
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            if (a < 1 && a <= BAYER[((py & 3) << 2) | (px & 3)]) continue;
            const idx = py * W + px;
            if (isLight) {
              const o = screen.light[idx];
              const r = Math.min(255, (o & 255) + (c & 255)), gg = Math.min(255, ((o >>> 8) & 255) + ((c >>> 8) & 255)), b = Math.min(255, ((o >>> 16) & 255) + ((c >>> 16) & 255));
              screen.light[idx] = 0xff000000 | (b << 16) | (gg << 8) | r;
            } else {
              const ca = c >>> 24;
              F.color[idx] = ca === 255 ? c : blendOver(F.color[idx], c, ca / 255);
            }
          }
      }
  };
  put(backF, f.back, false);
  put(frontF, f.front, false);
  if (!flash) put(null, f.light, true);
  return f;
}
function mixRGB(a, b, t) {
  const r = (a & 255) + ((b & 255) - (a & 255)) * t, g = ((a >>> 8) & 255) + (((b >>> 8) & 255) - ((a >>> 8) & 255)) * t, bb = ((a >>> 16) & 255) + (((b >>> 16) & 255) - ((a >>> 16) & 255)) * t;
  return (bb << 16) | (g << 8) | r;
}
/** An actor (for status effects) made from a memo frame: the critter's own silhouette and colors. */
const memoActors = new WeakMap();
export function actorOfMemo(m, t) {
  const f = m.frame(t);
  let a = memoActors.get(f);
  if (a) return a;
  const L = f.front ?? f.back;
  if (!L) return null;
  const { w, h } = L, data = new Uint8Array(w * h), pixels = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let c = f.front ? f.front.data[i] : 0;
    if (c && c >>> 24 > 200) (data[i] = 1), (pixels[i] = c | 0xff000000);
  }
  a = { mask: { w, h, data }, pixels, x: L.x0 - m.OX, y: L.y0 - m.OY, w, h, k: 2, head: [L.x0 - m.OX + w / 2, L.y0 - m.OY], chest: [0, L.y0 - m.OY + h / 2] };
  memoActors.set(f, a);
  return a;
}

/** One frame of any effect (simulated ones included) at time t, captured once: a closed chest, a barrel at rest. */
const stills = new Map();
export function stillOf(id, t = 0, o = {}, flip = false) {
  const key = id + "|" + t + "|" + flip + "|" + JSON.stringify(o);
  let s = stills.get(key);
  if (s) return s;
  const mod = FX[id], m = mod.meta, pad = 24, W = m.size[0] + pad * 2, H = m.size[1] + pad * 2;
  const OX = flip ? m.size[0] - m.origin[0] + pad : m.origin[0] + pad, OY = m.origin[1] + pad;
  const inst = createFx(mod, { ...o, x: OX, y: OY, flip });
  for (let k = 0; k < Math.round(t * 60); k++) inst.update(1 / 60);
  const { back, front } = scratchFor(W, H);
  clearFrame(back);
  clearFrame(front);
  inst.draw(back, "back");
  inst.draw(front, "front");
  s = { OX, OY, frame: () => ({ back: crop(back.color, W, H), front: crop(front.color, W, H), light: crop(front.light, W, H) }) };
  s.f = s.frame();
  s.frame = () => s.f;
  stills.set(key, s);
  return s;
}
/** Draw a still (from stillOf) with its origin at world (x, y). */
export function blitStill(screen, s, x, y, opts = {}) {
  return blitMemo(screen, s, 0, x, y, opts);
}
