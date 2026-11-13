// Tile art, drawn in code: every material is shaded from its own ramp with hashed texture, lit edges where it meets
// the air, a dark rim, grass and snow lips that spill over the top, and darker walls behind. The world is drawn in
// 256 px chunks, cached.

import { hex, mix, rand, scale } from "../pfx.js";
import { T, WALL, TS, SOLID_T, LIQUID_T } from "./tiles.js";
import { biomeAt } from "./biomes.js";

const H = (s) => s.map(hex);
const RAMP = {
  stone: H(["#a8a8b8", "#82829a", "#62627a", "#46465a", "#30303e", "#1e1e28"]),
  dirt: H(["#a8784a", "#86583a", "#68422c", "#4c3022", "#342018", "#22140e"]),
  mud: H(["#7a7048", "#5e5636", "#463f28", "#34301e", "#242014", "#16140c"]),
  snow: H(["#ffffff", "#e6f2ff", "#c4daf2", "#98b8dc", "#6c8cb8", "#48628a"]),
  ice: H(["#e8fbff", "#a8e4fa", "#6cc0ec", "#4290cc", "#2a64a0", "#1a3e6c"]),
  ash: H(["#9a8e88", "#7a6e6a", "#5c5250", "#423a3a", "#2e2828", "#1c1818"]),
  basalt: H(["#6a5458", "#4e3c42", "#3a2c32", "#2a2026", "#1c151a", "#120d10"]),
  brick: H(["#c87a5a", "#a4583e", "#7e402e", "#5a2c22", "#3c1c18", "#24100e"]),
  metal: H(["#c8d4e0", "#94a4b8", "#6a7a90", "#4c586c", "#343c4c", "#20262e"]),
  crystal: H(["#ffe8ff", "#e0a8ff", "#b46cf0", "#8040c8", "#552a94", "#341a5e"]),
  plank: H(["#e0a868", "#bc8448", "#946034", "#6c4226", "#4a2c1a", "#2e1a10"]),
  roof: H(["#e86a52", "#c04a3a", "#96342c", "#6c2422", "#481618", "#2c0c10"]),
  roofB: H(["#6aa0c8", "#4a7aa8", "#365a86", "#264064", "#182a44", "#0e1a2c"]),
  cloud: H(["#ffffff", "#f0f4ff", "#d4dcf4", "#aab4dc", "#8088b4", "#5a5e8a"]),
  moss: H(["#8ac884", "#5e9a62", "#40744a", "#4a5a5e", "#343e44", "#22282e"]),
  bedrock: H(["#3a3440", "#2c2832", "#201c26", "#16131a", "#0e0c12", "#08060a"]),
  gold: H(["#fff6c4", "#ffe066", "#f0b424", "#c48412", "#86520c", "#4a2c08"]),
  vine: H(["#b8f080", "#78c850", "#4a9a38", "#2e6a2a", "#1c4420", "#0e2614"]),
  leaves: H(["#9ad06a", "#6aa848", "#4a8038", "#30602c", "#1e4020", "#102614"]),
  bone: H(["#fffaf0", "#e4dcc8", "#b8ad96", "#8a806c", "#5e5648", "#3a352c"]),
};
const INK = hex("#0c0a12");

// grass color ramps by biome
function topRamp(b) {
  return H([b.ground[0], b.ground[1], b.ground[2]]);
}
function rampFor(t, b) {
  switch (t) {
    case T.DIRT: return b.id === "frost" ? RAMP.stone : b.id === "vale" || b.id === "woods" ? H([mix(hex(b.ground[3]), 0xffffffff, 0.25), b.ground[3], b.ground[4], b.ground[5], "#1a100c", "#0e0806"]) : RAMP.dirt;
    case T.GRASS: return b.id === "storm" ? RAMP.moss : H([mix(hex(b.ground[3]), 0xffffffff, 0.25), b.ground[3], b.ground[4], b.ground[5], "#1a100c", "#0e0806"]);
    case T.MUD: return RAMP.mud;
    case T.SNOW: return RAMP.snow;
    case T.ICE: return RAMP.ice;
    case T.ASH: return RAMP.ash;
    case T.BASALT: return RAMP.basalt;
    case T.BRICK: case T.GATE: return RAMP.brick;
    case T.METAL: return RAMP.metal;
    case T.CRYSTAL: return RAMP.crystal;
    case T.PLANK: case T.BRIDGE: return RAMP.plank;
    case T.ROOF: return RAMP.roof;
    case T.CLOUD: return RAMP.cloud;
    case T.MOSS: return RAMP.moss;
    case T.BEDROCK: return RAMP.bedrock;
    case T.GOLDORE: return stoneFor(b);
    case T.VINE: return RAMP.vine;
    case T.LEAVES: return RAMP.leaves;
    case T.BONE: return RAMP.bone;
    default: return stoneFor(b);
  }
}
const stoneCache = new Map();
function stoneFor(b) {
  let r = stoneCache.get(b.id);
  if (!r) {
    const tintC = hex(b.hills[1]);
    r = RAMP.stone.map((c) => mix(c, tintC, 0.18));
    stoneCache.set(b.id, r);
  }
  return r;
}
const WALL_RAMP = {
  [WALL.DIRT]: RAMP.dirt, [WALL.STONE]: RAMP.stone, [WALL.WOOD]: RAMP.plank, [WALL.BRICK]: RAMP.brick, [WALL.METAL]: RAMP.metal,
  [WALL.ICE]: RAMP.ice, [WALL.ASH]: RAMP.basalt, [WALL.CRYPT]: H(["#7a7088", "#5a5268", "#423c50", "#2e2a3a", "#1e1a26", "#120f18"]),
  [WALL.TEMPLE]: H(["#5ab0a8", "#3a8a88", "#2a6a6e", "#1c4c52", "#123438", "#0a2024"]), [WALL.CRYSTAL]: H(["#a080d0", "#7a5ab0", "#5a4090", "#402c6c", "#2a1c4a", "#180f2c"]),
  [WALL.MUD]: RAMP.mud,
};

export class TileArt {
  constructor(world) {
    this.w = world;
    this.chunks = new Map();
    this.CH = 32; // tiles per chunk side
    this.clock = 0;
  }
  invalidate(tx, ty) {
    const k = this.key(Math.floor(tx / this.CH), Math.floor(ty / this.CH));
    this.chunks.delete(k);
  }
  key(cx, cy) {
    return cy * 1000 + cx;
  }
  chunk(cx, cy) {
    const k = this.key(cx, cy);
    let c = this.chunks.get(k);
    if (!c) {
      c = this.build(cx, cy);
      this.chunks.set(k, c);
      if (this.chunks.size > 90) {
        const old = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 20);
        for (const [kk] of old) this.chunks.delete(kk);
      }
    }
    c.used = ++this.clock;
    return c;
  }
  build(cx, cy) {
    const N = this.CH * TS, buf = new Uint32Array(N * N), w = this.w;
    const at = (x, y) => w.tile(x, y), wl = (x, y) => w.wall(x, y);
    const put = (px, py, c) => { if (px >= 0 && py >= 0 && px < N && py < N) buf[py * N + px] = c; };
    const X0 = cx * this.CH, Y0 = cy * this.CH;
    for (let ty = Y0 - 1; ty < Y0 + this.CH + 1; ty++)
      for (let tx = X0; tx < X0 + this.CH; tx++) {
        const t = at(tx, ty), wv = wl(tx, ty), b = biomeAt(tx), ox = (tx - X0) * TS, oy = (ty - Y0) * TS;
        const inChunk = ty >= Y0 && ty < Y0 + this.CH;
        // the wall behind
        if (inChunk && wv && !(SOLID_T[t] && t !== T.GATE)) this.wallTile(put, ox, oy, tx, ty, wv, b, at);
        if (!t || LIQUID_T[t]) {
          // a grass lip and blades spilling up from the tile below
          continue;
        }
        if (inChunk) this.solidTile(put, ox, oy, tx, ty, t, b, at);
      }
    // overhangs: grass blades, snow caps and icicles reach out of their tiles
    for (let ty = Y0; ty < Y0 + this.CH + 1; ty++)
      for (let tx = X0; tx < X0 + this.CH; tx++) {
        const t = at(tx, ty), b = biomeAt(tx), ox = (tx - X0) * TS, oy = (ty - Y0) * TS, above = at(tx, ty - 1);
        if (!SOLID_T[t] || SOLID_T[above] || LIQUID_T[above]) continue;
        if (t === T.GRASS || t === T.MOSS) {
          const G = t === T.MOSS ? RAMP.moss : topRamp(b);
          for (let x = 0; x < TS; x++) {
            const hgt = Math.floor(rand(tx * 8 + x, ty, 11) * 4) - (rand(tx * 8 + x, 3) < 0.4 ? 1 : 0);
            for (let k = 1; k <= hgt; k++) put(ox + x, oy - k, k === hgt ? G[0] : G[1]);
            if (hgt > 0 && rand(tx * 8 + x, ty, 19) < 0.03 && b.id !== "storm") put(ox + x, oy - hgt - 1, hex(["#ff6a8a", "#ffe066", "#f4f4ff", "#8ab4ff"][Math.floor(rand(tx, x, 7) * 4)]));
          }
        } else if (t === T.SNOW) {
          for (let x = 0; x < TS; x++) if (rand(tx * 8 + x, ty, 13) < 0.5) put(ox + x, oy - 1, RAMP.snow[1]);
        }
        const below = at(tx, ty + 1);
        if ((t === T.ICE || t === T.SNOW || t === T.STONE) && !SOLID_T[below] && !LIQUID_T[below] && b.id === "frost")
          for (let x = 1; x < TS - 1; x++) {
            const L = Math.floor(rand(tx * 8 + x, ty, 21) * 6) - 2;
            for (let k = 0; k < L; k++) put(ox + x, oy + TS + k, k === L - 1 ? RAMP.ice[0] : RAMP.ice[2]);
          }
      }
    return { buf, N, used: 0 };
  }
  wallTile(put, ox, oy, tx, ty, wv, b, at) {
    const R = WALL_RAMP[wv] ?? RAMP.stone, dark = 0.42;
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const gx = tx * TS + x, gy = ty * TS + y;
        let i = 2 + (rand(gx >> 1, gy >> 1, 41) < 0.3 ? 1 : 0);
        if (wv === WALL.BRICK || wv === WALL.CRYPT || wv === WALL.TEMPLE) {
          const row = gy >> 2, off = row & 1 ? 4 : 0;
          if ((gy & 3) === 3 || ((gx + off) & 7) === 7) i = 4;
          else if ((gy & 3) === 0) i = 1;
        } else if (wv === WALL.WOOD) {
          if ((gx & 7) === 7) i = 4;
          else if ((gx & 7) === 0) i = 1;
          if (rand(gx >> 3, gy >> 4, 7) < 0.2 && (gy & 15) === 8) i = 4;
        } else if (wv === WALL.METAL) {
          if ((gx & 15) === 15 || (gy & 15) === 15) i = 4;
          else if ((gx & 15) === 1 && (gy & 15) === 1) i = 0;
        } else if (wv === WALL.CRYSTAL && rand(gx >> 2, gy >> 2, 3) < 0.08) i = 0;
        put(ox + x, oy + y, scale(R[i], dark));
      }
  }
  solidTile(put, ox, oy, tx, ty, t, b, at) {
    const R = rampFor(t, b);
    const up = at(tx, ty - 1), dn = at(tx, ty + 1), lf = at(tx - 1, ty), rt = at(tx + 1, ty);
    const open = (v) => !SOLID_T[v] && v !== t;
    const oU = !SOLID_T[up] && !(t === T.PLANK || t === T.BRIDGE || t === T.ROOF || t === T.CLOUD) ? 1 : open(up) ? 1 : 0;
    const oD = open(dn), oL = open(lf), oR = open(rt);
    const oneway = t === T.PLANK || t === T.BRIDGE || t === T.ROOF || t === T.CLOUD;
    // how deep inside the ground (no air within 2): darker
    let deep = 1;
    for (let d = 1; d <= 2 && deep; d++) if (!SOLID_T[at(tx, ty - d)] || !SOLID_T[at(tx - d, ty)] || !SOLID_T[at(tx + d, ty)] || !SOLID_T[at(tx, ty + d)]) deep = 0;
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const gx = tx * TS + x, gy = ty * TS + y, h = rand(gx, gy, 5);
        // texture in clumps, not speckle: a few lighter pebbles and darker pockets on a flat body
        const h2 = rand((gx + (gy >> 2 & 1) * 2) >> 2, gy >> 1, 9), peb = rand(gx >> 1, gy >> 1, 13);
        let i = 2 + (h2 < 0.22 ? 1 : 0) - (peb > 0.94 ? 1 : 0);
        if (deep) i += 1;
        let c;
        switch (t) {
          case T.BRICK: case T.GATE: {
            const row = gy >> 2, off = row & 1 ? 4 : 0;
            i = (gy & 3) === 3 || ((gx + off) & 7) === 7 ? 4 : (gy & 3) === 0 ? 1 : 2 + (h < 0.2 ? 1 : 0);
            break;
          }
          case T.METAL:
            i = (gx & 7) === 7 || (gy & 7) === 7 ? 4 : (gx & 7) === 0 || (gy & 7) === 0 ? 1 : 2;
            if ((gx & 7) === 2 && (gy & 7) === 2) i = 0;
            break;
          case T.PLANK: case T.BRIDGE:
            if (y > 3) continue;
            i = y === 0 ? 1 : y === 3 ? 4 : (gx & 7) === 7 ? 4 : 2;
            if (t === T.BRIDGE && y === 3 && (gx & 7) === 3) i = 5;
            break;
          case T.ROOF:
            i = (gy & 3) === 3 ? 4 : (gx + ((gy >> 2) & 1) * 2) % 4 === 0 ? 3 : (gy & 3) === 0 ? 1 : 2;
            break;
          case T.CLOUD: {
            if (y > 4) continue;
            i = y === 0 ? 0 : y < 3 ? 1 : 3;
            break;
          }
          case T.ICE:
            i = ((gx * 2 + gy) % 13) === 0 && rand(gx >> 3, gy >> 3, 3) < 0.6 ? 0 : ((gx + gy * 3) % 11) === 1 ? 1 : i;
            break;
          case T.CRYSTAL:
            i = ((gx - gy) & 3) === 0 ? 1 : ((gx + gy) & 5) === 0 ? 0 : i;
            break;
          case T.VINE:
            if ((x + (gy >> 1)) % 4 !== 1 && rand(gx, gy, 2) < 0.75) continue;
            i = rand(gx, gy, 4) < 0.3 ? 1 : 2;
            break;
          case T.GOLDORE:
            if (h < 0.18) c = RAMP.gold[h < 0.06 ? 0 : 2];
            break;
          case T.BASALT:
            if (rand(gx >> 1, gy, 31) < 0.02) c = hex("#ff6a2a");
            break;
        }
        if (c === undefined) {
          // lit top edge, grass or snow on top, dark rim where it meets air
          if (oU && !oneway) {
            if ((t === T.GRASS || t === T.MOSS) && y < 3) {
              const G = t === T.MOSS ? RAMP.moss : topRamp(b);
              i = -1;
              c = y === 0 ? G[0] : y === 1 ? G[1] : rand(gx, 1, 7) < 0.5 ? G[2] : G[1];
            } else if (t === T.SNOW && y < 3) c = y === 0 ? RAMP.snow[0] : RAMP.snow[1];
            else if (y === 0) i = Math.max(0, i - 2);
            else if (y === 1) i = Math.max(0, i - 1);
          }
          if (c === undefined) {
            if ((oL && x === 0) || (oR && x === TS - 1) || (oD && y === TS - 1)) i = 5;
            else if ((oL && x === 1) || (oD && y === TS - 2)) i = Math.min(5, i + 1);
            c = R[Math.max(0, Math.min(R.length - 1, i))];
          }
        }
        put(ox + x, oy + y, c);
      }
  }
  /** Draw the visible chunks into frame f (its ox, oy is the camera). */
  draw(f) {
    const N = this.CH * TS, x0 = Math.floor(f.ox / N), x1 = Math.floor((f.ox + f.w - 1) / N), y0 = Math.floor(f.oy / N), y1 = Math.floor((f.oy + f.h - 1) / N);
    const C = f.color, W = f.w, Hh = f.h;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0) continue;
        const ch = this.chunk(cx, cy), b = ch.buf, sx = cx * N - f.ox, sy = cy * N - f.oy;
        const ya = Math.max(0, -sy), yb = Math.min(N, Hh - sy), xa = Math.max(0, -sx), xb = Math.min(N, W - sx);
        for (let y = ya; y < yb; y++) {
          const src = y * N, dst = (sy + y) * W + sx;
          for (let x = xa; x < xb; x++) {
            const c = b[src + x];
            if (c) C[dst + x] = c;
          }
        }
      }
  }
}
export { RAMP, INK };
