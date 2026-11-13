// Scenery drawn in code: trees for every land, bushes, rocks, reeds, mushrooms, ruins, and the village's doors and
// windows. Each sprite is generated once from (type, variant) and kept.

import { hex, mix, rand, Rng, scale } from "../pfx.js";

const H = (a) => a.map(hex);
const INK = hex("#0c0a12");
const cache = new Map();

class Spr {
  constructor(w, h, ox, oy) {
    Object.assign(this, { w, h, ox, oy, data: new Uint32Array(w * h), glow: [] });
  }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : 0;
  }
  /** A shaded blob: lit up-left, shaded down-right. R = [light, mid, dark, deep]. */
  blob(cx, cy, rx, ry, R, R2 = null) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        const l = -dx * 0.6 - dy * 0.8 + (rand(x, y, 3) - 0.5) * 0.5;
        this.set(x, y, l > 0.55 ? R[0] : l > 0 ? R[1] : l > -0.6 ? R[2] : R[3]);
      }
  }
  line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      for (let k = 0; k < w; k++) this.set(x + k - (w >> 1), y, c);
    }
  }
  /** A dark outline round everything drawn so far. */
  outline(c = INK) {
    const out = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) out.push([x, y]);
    for (const [x, y] of out) this.set(x, y, c);
  }
}

const LEAF = {
  woods: [H(["#8ad060", "#5aa040", "#3a7a32", "#24542a"]), H(["#a8d870", "#6aa848", "#477a38", "#2c5428"])],
  vale: [H(["#9ae070", "#62b048", "#3e8438", "#285a2c"]), H(["#ffd0e4", "#f4a0c4", "#d070a0", "#9a4878"])],
  marsh: [H(["#9aaa60", "#6a7a40", "#4a5a30", "#2e3a20"])],
  frost: [H(["#4a8a7a", "#2e6a62", "#1e4a48", "#123232"])],
};
const BARK = H(["#9a6a44", "#6e4a30", "#4a3020", "#2c1c14"]);
const BARK_PALE = H(["#c8b8a0", "#9a8a78", "#6e6052", "#463c34"]);

function tree(type, v) {
  const R = new Rng(v * 97 + type.length);
  if (type === "woods" || type === "vale") {
    const tall = type === "woods" ? R.range(56, 92) : R.range(38, 56), w = Math.round(tall * 0.9);
    const s = new Spr(w + 8, Math.round(tall) + 6, (w + 8) >> 1, Math.round(tall) + 2);
    const L = LEAF[type][type === "vale" && R.next() < 0.35 ? 1 : R.int(0, LEAF[type].length - 1)], cx = s.ox, base = s.oy;
    const tw = type === "woods" ? R.int(3, 5) : 3, lean = R.range(-3, 3);
    // trunk with roots
    for (let y = base; y > base - tall * 0.62; y--) {
      const u = (base - y) / tall, x = cx + lean * u;
      for (let k = -tw / 2; k <= tw / 2; k++) s.set(x + k, y, k < -tw / 2 + 1 ? BARK[0] : k > tw / 2 - 1 ? BARK[2] : BARK[1]);
      if (R.next() < 0.08) s.set(x + R.int(-1, 1), y, BARK[3]);
    }
    s.line(cx - tw, base, cx - 1, base - 3, BARK[1], 2);
    s.line(cx + tw, base, cx + 1, base - 4, BARK[2], 2);
    // branches
    for (let i = 0; i < 3; i++) {
      const y = base - tall * R.range(0.35, 0.6), d = R.sign();
      s.line(cx + lean * 0.5, y, cx + d * R.range(8, 14), y - R.range(6, 12), BARK[2], 2);
    }
    // canopy of clustered blobs, back ones darker
    const n = type === "woods" ? R.int(6, 9) : R.int(4, 6), top = base - tall, mid = base - tall * 0.72;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rx = R.range(7, 13) * (tall / 70 + 0.4), x = cx + lean + Math.cos(a) * w * 0.26, y = mid + Math.sin(a) * tall * 0.14 - 4;
      s.blob(x, y, rx, rx * 0.8, [L[1], L[2], L[3], scale(L[3], 0.7)]);
    }
    for (let i = 0; i < n; i++) {
      const x = cx + lean + R.range(-w * 0.28, w * 0.28), y = R.range(top + 10, mid + 4), r = R.range(7, 12) * (tall / 70 + 0.4);
      s.blob(x, y, r, r * 0.82, L);
    }
    // a few fruit or blossoms
    if (type === "vale") for (let i = 0; i < 6; i++) s.set(cx + R.range(-w * 0.3, w * 0.3), R.range(top + 8, mid + 6), hex(R.next() < 0.5 ? "#ff6a6a" : "#fff0f4"));
    s.outline();
    return s;
  }
  if (type === "marsh") {
    // a willow: a crooked trunk and curtains hanging down
    const tall = R.range(40, 60), s = new Spr(60, Math.round(tall) + 6, 30, Math.round(tall) + 2), cx = 30, base = s.oy, L = LEAF.marsh[0];
    for (let y = base; y > base - tall * 0.7; y--) {
      const u = (base - y) / tall, x = cx + Math.sin(u * 5) * 2;
      for (let k = -2; k <= 2; k++) s.set(x + k, y, k < -1 ? BARK[1] : k > 1 ? BARK[3] : BARK[2]);
    }
    s.blob(cx, base - tall * 0.78, 20, 9, L);
    for (let i = 0; i < 26; i++) {
      const x = cx + R.range(-19, 19), y0 = base - tall * 0.78 + R.range(0, 6), len = R.range(10, tall * 0.6);
      for (let k = 0; k < len; k++) s.set(x + Math.sin(k / 5) * 0.8, y0 + k, k > len - 3 ? L[2] : R.next() < 0.5 ? L[1] : L[2]);
    }
    s.outline();
    return s;
  }
  if (type === "frost") {
    // a snowy pine: stacked boughs, snow on every top
    const tall = R.range(40, 76), s = new Spr(46, Math.round(tall) + 6, 23, Math.round(tall) + 2), cx = 23, base = s.oy, L = LEAF.frost[0];
    for (let y = base; y > base - 8; y--) for (let k = -1; k <= 1; k++) s.set(cx + k, y, BARK[k + 1]);
    const tiers = Math.round(tall / 12);
    for (let t = 0; t < tiers; t++) {
      const yb = base - 6 - t * (tall - 10) / tiers, hw = (1 - t / tiers) * 18 + 3, hh = (tall - 8) / tiers + 6;
      for (let y = 0; y < hh; y++) {
        const half = (y / hh) * hw;
        for (let x = -half; x <= half; x++) {
          const top = y < 2 || (y < 4 && Math.abs(x) > half - 2);
          s.set(cx + x, yb - hh + y, top ? (y === 0 ? hex("#ffffff") : hex("#dce8f8")) : x < -half * 0.3 ? L[1] : x > half * 0.4 ? L[3] : L[2]);
        }
      }
    }
    s.outline();
    return s;
  }
  if (type === "crags") {
    // a dead charred tree, or a jagged spire with embers in its cracks
    if (R.next() < 0.5) {
      const tall = R.range(30, 50), s = new Spr(40, Math.round(tall) + 4, 20, Math.round(tall) + 2), cx = 20, base = s.oy;
      const C = H(["#5a4a48", "#3a2e2e", "#241c1e", "#140f12"]);
      s.line(cx, base, cx + R.range(-3, 3), base - tall, C[1], 3);
      for (let i = 0; i < 4; i++) {
        const y = base - tall * R.range(0.3, 0.9), d = R.sign();
        s.line(cx, y, cx + d * R.range(6, 14), y - R.range(4, 12), C[2], 1);
      }
      for (let i = 0; i < 4; i++) s.set(cx + R.int(-1, 1), base - R.range(2, tall * 0.8), hex("#ff7a2a"));
      s.outline();
      s.glow.push([cx, base - tall * 0.4, 10, hex("#ff6a2a"), 0.15]);
      return s;
    }
    const tall = R.range(24, 44), s = new Spr(30, Math.round(tall) + 4, 15, Math.round(tall) + 2), base = s.oy, C = H(["#7a6a6a", "#544848", "#3a3030", "#241c1e"]);
    for (let y = 0; y < tall; y++) {
      const half = (1 - y / tall) * 9 + 1;
      for (let x = -half; x <= half; x++) s.set(15 + x + Math.sin(y / 5) * 1.5, base - y, x < -half * 0.4 ? C[0] : x > half * 0.3 ? C[2] : C[1]);
    }
    for (let i = 0; i < 6; i++) s.set(15 + R.int(-3, 3), base - R.range(2, tall * 0.6), hex("#ff8a3a"));
    s.outline();
    return s;
  }
  // storm: a broken pillar with a fallen capital, or an old antenna mast
  if (R.next() < 0.6) {
    const tall = R.range(26, 54), s = new Spr(26, Math.round(tall) + 6, 13, Math.round(tall) + 2), base = s.oy, C = H(["#b8c0cc", "#8a94a4", "#606a7a", "#40485a"]);
    for (let y = 0; y < tall; y++) for (let x = -5; x <= 5; x++) {
      if (y > tall - 4 && rand(x, y, 9) < (y - tall + 4) / 4) continue;
      s.set(13 + x, base - y, x === -5 || x === -2 ? C[0] : x === 2 ? C[2] : x === 5 ? C[3] : C[1]);
    }
    for (let x = -7; x <= 7; x++) for (let y = 0; y < 3; y++) s.set(13 + x, base - y, y === 2 ? C[0] : C[2]);
    for (let i = 0; i < 8; i++) s.set(13 + R.int(-5, 5), base - R.range(4, tall - 2), hex("#6a9a7a"));
    s.outline();
    return s;
  }
  const tall = R.range(40, 70), s = new Spr(24, Math.round(tall) + 4, 12, Math.round(tall) + 2), base = s.oy, M = H(["#9aa6ba", "#6e7a90", "#4a5468", "#2e3648"]);
  s.line(12, base, 12, base - tall, M[1], 2);
  for (let y = 8; y < tall; y += 9) s.line(12 - (tall - y) / 8, base - y, 12 + (tall - y) / 8, base - y, M[2], 1);
  s.set(12, base - tall - 1, hex("#ff4a4a"));
  s.glow.push([12, base - tall - 1, 6, hex("#ff3a3a"), 0.5, "blink"]);
  s.outline();
  return s;
}

function small(type, v) {
  const R = new Rng(v * 31 + 5), s = new Spr(20, 16, 10, 14), b = s.oy;
  const k = R.next();
  if (type === "woods" && k < 0.4) {
    // a mushroom pair
    const cap = H(k < 0.2 ? ["#ff8a8a", "#e04a4a", "#a02a3a", "#601a2a"] : ["#e8c890", "#c49a5a", "#8a6a3a", "#5a4228"]);
    for (const [x, h, r] of [[8, 6, 4], [13, 4, 3]]) {
      for (let y = 0; y < h; y++) s.set(x, b - y, hex("#f0e8d8"));
      s.blob(x, b - h, r, r * 0.6, cap);
      s.set(x - 1, b - h - 1, hex("#ffffff"));
    }
    s.outline();
    if (k < 0.2) s.glow.push([10, b - 6, 8, hex("#ff6a8a"), 0.12]);
    return s;
  }
  if (type === "marsh") {
    // reeds and cattails
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 2.4, h = R.range(7, 14);
      for (let y = 0; y < h; y++) s.set(x + Math.sin(y / 4 + i) * 0.6, b - y, y > h - 3 && i % 2 ? hex("#6a3a22") : hex(y < 4 ? "#3a5a2a" : "#6a8a4a"));
    }
    return s;
  }
  if (type === "frost") {
    s.blob(10, b - 3, 7, 4, H(["#ffffff", "#dce8f8", "#a8c0dc", "#7890b4"]));
    s.outline();
    return s;
  }
  if (type === "crags") {
    s.blob(10, b - 3, 6, 4, H(["#8a7a7a", "#5e5050", "#3e3434", "#261e20"]));
    s.set(9, b - 3, hex("#ff7a2a"));
    s.outline();
    s.glow.push([9, b - 3, 6, hex("#ff6a2a"), 0.18]);
    return s;
  }
  if (type === "storm") {
    // a crate or a coil of cable
    for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) s.set(6 + x, b - y, y === 6 || x === 0 ? hex("#a07a4a") : x === 7 || y === 0 ? hex("#4a3420") : (x + y) % 5 === 0 ? hex("#6a4a2a") : hex("#8a6038"));
    s.outline();
    return s;
  }
  // a bush, with berries now and then
  const L = LEAF[type === "small_vale" ? "vale" : "woods"]?.[0] ?? LEAF.vale[0];
  s.blob(10, b - 4, 8, 5, L);
  s.blob(6, b - 3, 4, 3, L);
  if (k > 0.6) for (let i = 0; i < 3; i++) s.set(R.int(5, 15), b - R.int(2, 7), hex("#d03a5a"));
  s.outline();
  return s;
}

export function sprite(type, v) {
  const key = type + ":" + v;
  let s = cache.get(key);
  if (!s) cache.set(key, (s = type.startsWith("small_") ? small(type.slice(6), v) : tree(type, v)));
  return s;
}

/** Draw a sprite into frame f with its anchor at world (x, y). */
export function blit(f, s, x, y, flip = false) {
  const sx = Math.round(x) - s.ox - f.ox, sy = Math.round(y) - s.oy - f.oy, W = f.w, Hh = f.h, C = f.color, d = s.data;
  if (sx + s.w < 0 || sy + s.h < 0 || sx >= W || sy >= Hh) return false;
  for (let yy = Math.max(0, -sy); yy < Math.min(s.h, Hh - sy); yy++) {
    const row = (sy + yy) * W, src = yy * s.w;
    for (let xx = Math.max(0, -sx); xx < Math.min(s.w, W - sx); xx++) {
      const c = d[src + (flip ? s.w - 1 - xx : xx)];
      if (c) C[row + sx + xx] = c;
    }
  }
  return true;
}

// ---- house fronts: a door, windows (lit at night), a sign
const WOOD = H(["#b47c48", "#8a5a32", "#5e3a20", "#3a2214"]);
export function houseFront(f, back, h, night, time, glowFn) {
  const doorX = h.door, gy = h.y;
  const put = (F, x, y, c) => {
    x -= F.ox; y -= F.oy;
    if (x >= 0 && y >= 0 && x < F.w && y < F.h) F.color[y * F.w + x] = c;
  };
  // the door, in a frame
  for (let y = 0; y < 18; y++)
    for (let x = -6; x <= 6; x++) {
      const edge = Math.abs(x) === 6 || y === 17;
      if (y === 17 && Math.abs(x) > 5) continue;
      put(f, doorX + x, gy - 1 - y, edge ? INK : Math.abs(x) === 5 || y === 16 ? WOOD[0] : x === 0 ? WOOD[3] : (y + (x > 0 ? 2 : 0)) % 6 === 0 ? WOOD[3] : WOOD[1]);
    }
  put(f, doorX + 3, gy - 9, hex("#ffd84a"));
  // windows either side
  for (const wx of [h.x + 14, h.x + h.w - 22]) {
    if (Math.abs(wx + 4 - doorX) < 12) continue;
    const lit = night > 0.3 && rand(Math.floor(time / 20), wx, 3) > 0.15;
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 9; x++) {
        const frame = x === 0 || x === 8 || y === 0 || y === 9 || x === 4 || y === 5;
        const glass = lit ? (y < 5 ? hex("#ffe8a0") : hex("#ffc860")) : (x + y) % 7 === 0 ? hex("#a8c8e8") : hex("#3a4a6a");
        put(frame ? f : lit ? back : f, wx + x, gy - 26 + y, frame ? WOOD[2] : glass);
      }
    if (lit) glowFn(wx + 4, gy - 21, 22, hex("#ffb050"), 0.35 * night);
  }
}
