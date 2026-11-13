// Characters are pixelfx's 3D skeleton (src/core/rig.js), dressed: every pixel of a pose knows which body part it
// belongs to and how lit it is, so a costume is a ramp per part. Hair, skin, tunic, sleeves, gloves, belt, trousers,
// boots, a cloak; an eye on the face; the weapon's steel left as drawn. Bosses are the same body drawn twice the size.

import { posed, skeleton, hex, mix, DUMMY_PAL, PARTS, scale } from "../pfx.js";

const P = PARTS;
const D = Object.fromEntries(Object.entries(DUMMY_PAL).map(([k, v]) => [k, hex(v) >>> 0]));
// rig color -> [kind, tone]: kind 0 shell, 1 core, 2 ink, 3 seam, 4 mark
const TONE = new Map([[D.A, [0, 0]], [D.B, [0, 1]], [D.C, [0, 2]], [D.D, [0, 3]], [D.E, [1, 1]], [D.F, [1, 2]], [D.G, [1, 3]], [D.k, [2, 0]], [D.J, [3, 0]], [D.m, [4, 0]]]);

const R4 = (a) => a.map((c) => hex(c) >>> 0);
/** A costume: ramps (light to dark, 4 steps) for groups of parts. */
export function costume(spec) {
  const g = {};
  for (const [k, v] of Object.entries(spec)) g[k] = Array.isArray(v) ? R4(v) : v;
  const byPart = new Array(25).fill(null);
  const assign = (ids, ramp) => ids.forEach((i) => (byPart[i] = ramp));
  assign([P.head], g.hair);
  assign([P.face, P.neck], g.skin);
  assign([P.chest], g.chest ?? g.tunic);
  assign([P.waist], g.belt);
  assign([P.pelvis], g.hips ?? g.legs);
  assign([P.upperN, P.upperF, P.elbowN, P.elbowF], g.sleeve ?? g.chest ?? g.tunic);
  assign([P.foreN, P.foreF], g.arm ?? g.sleeve ?? g.tunic);
  assign([P.handN, P.handF], g.hand ?? g.skin);
  assign([P.thighN, P.thighF, P.kneeN, P.kneeF], g.legs);
  assign([P.shinN, P.shinF], g.boots);
  assign([P.footN, P.footF], g.boots);
  return { id: spec.id ?? JSON.stringify(spec).length + ":" + Math.random(), byPart, ink: hex(spec.ink ?? "#120c18") >>> 0, eye: hex(spec.eye ?? "#1a1020") >>> 0, mark: hex(spec.mark ?? "#f53cd1") >>> 0, steel: spec.steel ? R4(spec.steel) : null, glowEye: spec.glowEye ? hex(spec.glowEye) : 0 };
}

const STEEL = [0xffffffff, hex("#e8edf6") >>> 0, hex("#a4afc6") >>> 0, hex("#68748f") >>> 0];
const cache = new WeakMap();
/** The pose's pixels recolored by a costume (cached per pose and costume). */
export function dressed(r, C) {
  let m = cache.get(r);
  if (!m) cache.set(r, (m = new Map()));
  let out = m.get(C.id);
  if (out) return out;
  const col = new Uint32Array(r.n);
  let fx = -1e9, fy = 0, fminY = 1e9;
  for (let i = 0; i < r.n; i++) {
    const c = r.color[i] >>> 0, part = r.part[i], t = TONE.get(c);
    if (part === P.face && !r.ink[i]) {
      if (r.ys[i] < fminY) fminY = r.ys[i];
    }
    if (!t) {
      // weapon steel: optionally re-tinted
      if (C.steel && (part === P.weapon || part === P.offWeapon)) {
        const k = STEEL.indexOf(c);
        col[i] = k >= 0 ? C.steel[k] : c;
      } else col[i] = c;
      continue;
    }
    const [kind, tone] = t, ramp = C.byPart[part];
    if (kind === 2) col[i] = C.ink;
    else if (kind === 4) col[i] = ramp ? ramp[1] : c;
    else if (!ramp) col[i] = c;
    else if (kind === 3) col[i] = scale(ramp[3], 0.75) >>> 0;
    else col[i] = ramp[Math.min(3, tone)];
  }
  // the eye: on the front of the face, a third of the way down it
  let ei = -1;
  for (let i = 0; i < r.n; i++)
    if (r.part[i] === P.face && !r.ink[i] && (r.ys[i] === fminY + 2 || r.ys[i] === fminY + 3) && r.xs[i] > fx) (fx = r.xs[i]), (fy = r.ys[i]), (ei = i);
  out = { col, eye: ei >= 0 ? [fx - 1, fy] : null };
  m.set(C.id, out);
  return out;
}

/**
 * Draw a pose into frame f with feet at world (x, y). opts: { flip, flash (draw all white), tint [color, k], alpha
 * (dithered), k (scale 1 or 2), silhouette color }.
 */
export function drawRig(f, pose, C, x, y, opts = {}) {
  const r = posed(pose), d = dressed(r, C), k = opts.k ?? 1, flip = !!opts.flip, W = f.w, H = f.h, buf = f.color;
  const bx = Math.round(x) - f.ox, by = Math.round(y) - f.oy, a = opts.alpha ?? 1;
  const tint = opts.tint, flash = opts.flash;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let i = 0; i < r.n; i++) {
    let c = d.col[i];
    if (flash) c = r.ink[i] ? 0xffffffff : 0xffffffff;
    else if (tint) c = mix(c, tint[0], tint[1]) >>> 0;
    const lx = flip ? -r.xs[i] - 1 : r.xs[i], ly = r.ys[i];
    for (let yy = 0; yy < k; yy++)
      for (let xx = 0; xx < k; xx++) {
        const px = bx + lx * k + xx, py = by + ly * k + yy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        if (a < 1 && a * 16 <= BAY[((py & 3) << 2) | (px & 3)]) continue;
        buf[py * W + px] = c;
      }
  }
  if (d.eye && !flash) {
    const ex = flip ? -d.eye[0] - 1 : d.eye[0], ey = d.eye[1];
    for (let yy = 0; yy < k; yy++)
      for (let xx = 0; xx < k; xx++) {
        const px = bx + ex * k + xx, py = by + ey * k + yy;
        if (px >= 0 && py >= 0 && px < W && py < H && (a >= 1 || a * 16 > BAY[((py & 3) << 2) | (px & 3)])) buf[py * W + px] = C.glowEye || C.eye;
      }
  }
  return r;
}

/** The rendered size of a pose: { x0, y0, x1, y1 } in local px (feet at 0, 0). */
export const poseBounds = (pose) => {
  const r = posed(pose);
  return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 };
};

const skCache = new Map();
/** Joints of a pose (cached loosely by the pose's numbers). */
export function joints(pose) {
  let key = "";
  for (const k in pose) {
    const v = pose[k];
    key += k + (typeof v === "number" ? Math.round(v * 2) : v) + ",";
  }
  let s = skCache.get(key);
  if (!s) {
    if (skCache.size > 3000) skCache.clear();
    skCache.set(key, (s = skeleton(pose).joints));
  }
  return s;
}

/** An actor for pixelfx effects that read a body (status effects, deaths): the pose's silhouette and colors. */
const actorCache = new WeakMap();
export function actorOf(pose, C) {
  const r = posed(pose), d = dressed(r, C);
  let m = actorCache.get(r);
  if (!m) actorCache.set(r, (m = new Map()));
  let a = m.get(C.id);
  if (a) return a;
  const x0 = Math.min(-12, r.x0), x1 = Math.max(11, r.x1), y0 = Math.min(-38, r.y0), y1 = -1;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h), pixels = new Uint32Array(w * h);
  for (let i = 0; i < r.n; i++) {
    const x = r.xs[i] - x0, y = r.ys[i] - y0;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    data[y * w + x] = 1;
    pixels[y * w + x] = d.col[i];
  }
  const eyes = d.eye ? [[d.eye[0] - x0, d.eye[1] - y0]] : undefined;
  a = { mask: { w, h, data }, pixels, x: x0, y: y0, w, h, k: 2, head: [0, r.y0], chest: [0, -26], eyes, key: "a" + (actorSeq++) };
  m.set(C.id, a);
  return a;
}
let actorSeq = 1;

export const COSTUMES = {
  hero: costume({ id: "hero", hair: ["#f0a860", "#c8743a", "#8a4428", "#561e1a"], skin: ["#ffd8b4", "#f0b088", "#c4805e", "#8a4e3a"], tunic: ["#6ad0c4", "#36a0a0", "#226a78", "#163e52"], sleeve: ["#4ab8b0", "#2a8a8c", "#1c5c6a", "#123448"], arm: ["#c89a6a", "#9a6a44", "#6a4430", "#3e2620"], hand: ["#a87850", "#7a5232", "#523420", "#2e1c14"], belt: ["#e8c060", "#b08030", "#7a5420", "#4a3014"], legs: ["#5a5a8a", "#40406a", "#2c2c4c", "#1c1c30"], boots: ["#9a6a44", "#6e4a30", "#4a3020", "#2c1c14"], mark: "#ffe06a" }),
};
