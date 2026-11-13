// The sky and the far lands: a gradient that turns with the hour, the sun and moon, stars, drifting day clouds, and
// four layers of silhouettes that scroll slower the further they are, shaped by whichever land you stand in.

import { hex, mix, rand, noise, fbm, clamp, smooth, scale } from "../pfx.js";
import { BIOMES, biomeAt } from "./biomes.js";

const W = 320, H = 180;
const sky = (b, k) => [hex(b.sky[k][0]), hex(b.sky[k][1])];

/** Day, dusk and night weights for a time of day (0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk). */
export function phase(tod) {
  const alt = Math.sin((tod - 0.25) * Math.PI * 2);
  const day = smooth(-0.05, 0.35, alt), night = 1 - smooth(-0.3, 0.02, alt), dusk = Math.max(0, 1 - day - night);
  return { alt, day, dusk, night };
}

// one land's silhouette at world column x on layer i (0 far .. 3 near): height in px above the layer's baseline
function profile(id, i, x) {
  const s = 1 + i * 0.4;
  switch (id) {
    case "frost": {
      const r = 1 - Math.abs(noise(x / (70 / s), 11 + i)), r2 = 1 - Math.abs(noise(x / (28 / s), 21 + i));
      return (r * r * 70 + r2 * 18) * (1.1 - i * 0.18);
    }
    case "woods": {
      const base = 26 + fbm(x / 90, i, 3, 2) * 14, tx = x / (6 + i * 2), k = tx - Math.floor(tx), crown = Math.sqrt(Math.max(0, 1 - (2 * k - 1) ** 2));
      return base + crown * (14 + rand(Math.floor(tx), i, 5) * 16) - i * 3;
    }
    case "vale":
      return 22 + fbm(x / 120, i * 3, 7, 3) * 26 + (i === 3 ? Math.max(0, noise(x / 9, 4)) * 6 : 0);
    case "marsh": {
      const tx = x / 14, k = tx - Math.floor(tx), willow = rand(Math.floor(tx), i, 8) < 0.4 ? Math.sqrt(Math.max(0, 1 - (2 * k - 1) ** 2)) * 26 : 0;
      return 12 + fbm(x / 60, i, 9, 2) * 8 + willow;
    }
    case "crags": {
      const sp = Math.abs(noise(x / (16 + i * 4), 31 + i));
      const volcano = i === 0 ? Math.max(0, 90 - Math.abs(((x + 400) % 900) - 450) * 0.6) : 0;
      return 20 + sp * sp * 60 + fbm(x / 50, i, 13, 2) * 10 + volcano;
    }
    default: {
      // ruined towers: blocky steps
      const bx = Math.floor(x / (18 + i * 4)), tall = rand(bx, i, 17);
      return 18 + fbm(x / 80, i, 19, 2) * 10 + (tall < 0.5 ? tall * 110 : 0) * (1 - i * 0.18);
    }
  }
}

export class Backdrop {
  constructor(world) {
    this.world = world;
  }
  /** The sky colors right now at a camera, [top, bottom], and the light of day. */
  skyAt(cx, tod) {
    const tx = (cx + W / 2) / 8, b = biomeAt(tx), ph = phase(tod);
    // blend toward the neighbour land near a border
    const i = BIOMES.indexOf(b), dl = tx - b.x0, dr = b.x1 - tx;
    let other = null, k = 0;
    if (dl < 30 && i > 0) (other = BIOMES[i - 1]), (k = 0.5 * (1 - dl / 30));
    else if (dr < 30 && i < BIOMES.length - 1) (other = BIOMES[i + 1]), (k = 0.5 * (1 - dr / 30));
    const pick = (bb) => {
      const d = sky(bb, "day"), u = sky(bb, "dusk"), n = sky(bb, "night");
      const m = (j) => mix(mix(n[j], u[j], ph.dusk / Math.max(0.001, ph.dusk + ph.night)), d[j], ph.day);
      return [m(0), m(1)];
    };
    let [top, bot] = pick(b);
    if (other) {
      const [t2, b2] = pick(other);
      top = mix(top, t2, k);
      bot = mix(bot, b2, k);
    }
    return { top, bot, b, other, k, ph };
  }
  drawSky(f, tod, time) {
    const cx = f.ox, cy = f.oy, S = this.skyAt(cx, tod), C = f.color, ph = S.ph;
    // the gradient, in hard bands with a dithered seam, the way a pixel artist paints a sky
    const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const horizon = 620 - cy; // where the gradient bottoms out on screen
    for (let y = 0; y < H; y++) {
      const u = clamp((y - (horizon - 520)) / 520), band = u * 10;
      for (let x = 0; x < W; x++) {
        const b = Math.floor(band + BAY[((y & 3) << 2) | (x & 3)] / 16) / 10;
        C[y * W + x] = mix(S.top, S.bot, b);
      }
    }
    // stars
    if (ph.night + ph.dusk * 0.4 > 0.05) {
      const k = ph.night + ph.dusk * 0.3, ox = cx * 0.03, oy = cy * 0.03;
      for (let i = 0; i < 140; i++) {
        const sx = Math.floor((rand(i, 1) * 360 - ox) % 360 + 360) % 360 - 20, sy = Math.floor(rand(i, 2) * 220 - oy) % 220;
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
        const tw = 0.6 + 0.4 * Math.sin(time * (1 + rand(i, 3) * 3) + i), br = rand(i, 4);
        if (tw * k * (0.4 + br) < 0.35) continue;
        C[sy * W + sx] = mix(C[sy * W + sx], hex(br > 0.9 ? "#ffe8c0" : br > 0.75 ? "#c8d8ff" : "#ffffff"), Math.min(1, tw * k));
        if (br > 0.93 && tw > 0.85) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (sx + dx >= 0 && sx + dx < W && sy + dy >= 0 && sy + dy < H) C[(sy + dy) * W + sx + dx] = mix(C[(sy + dy) * W + sx + dx], 0xffffffff, 0.4 * k);
      }
    }
    // the sun and the moon ride an arc across the sky
    const arc = (a, r, col, glowCol, k, moon) => {
      const px = W / 2 + Math.cos(a) * 150 - cx * 0.01 % 1, py = 150 - Math.sin(a) * 120 - Math.min(0, (cy - 300) * 0.05);
      if (py < -20 || py > H + 20) return;
      for (let y = -r - 1; y <= r + 1; y++)
        for (let x = -r - 1; x <= r + 1; x++) {
          const d = Math.hypot(x, y), X = Math.round(px + x), Y = Math.round(py + y);
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          if (d <= r) {
            let c = col;
            if (moon) {
              const cr = rand(Math.floor(x / 2) + 9, Math.floor(y / 2) + 9, 3);
              if (cr < 0.18) c = mix(col, hex("#8a90b0"), 0.5);
              if (x + y > r * 0.6) c = mix(c, hex("#9aa0c0"), 0.35);
            } else if (d > r - 1) c = mix(col, glowCol, 0.4);
            C[Y * W + X] = mix(C[Y * W + X], c, k);
          }
        }
      // glow
      for (let y = -r * 4; y <= r * 4; y += 1)
        for (let x = -r * 4; x <= r * 4; x += 1) {
          const d = Math.hypot(x, y) / (r * 4), X = Math.round(px + x), Y = Math.round(py + y);
          if (d >= 1 || d * r * 4 <= r || X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const g = (1 - d) * (1 - d) * 0.35 * k;
          C[Y * W + X] = mix(C[Y * W + X], glowCol, g);
        }
    };
    const sunA = (tod - 0.25) * Math.PI * 2;
    if (Math.sin(sunA) > -0.2) arc(Math.PI - sunA + Math.PI, 0, 0, 0, 0);
    const sa = sunA, sunUp = Math.sin(sa);
    if (sunUp > -0.15) arc(Math.PI / 2 + (Math.PI / 2 - ((tod - 0.25) * 2 * Math.PI)), 8, hex("#fff6d0"), hex(ph.dusk > 0.4 ? "#ff9a5a" : "#fff0b0"), clamp((sunUp + 0.15) * 4), false);
    const moonA = (tod + 0.25) * Math.PI * 2;
    if (Math.sin(moonA - Math.PI / 2) > -0.15 || ph.night > 0.3) arc(Math.PI / 2 + (Math.PI / 2 - (((tod + 0.5) % 1) - 0.25) * 2 * Math.PI), 6, hex("#e8ecff"), hex("#8090d0"), ph.night * 0.95 + ph.dusk * 0.4, true);
    // drifting day clouds
    if (ph.day + ph.dusk > 0.1) {
      const k = (ph.day + ph.dusk * 0.6) * 0.9, lit = mix(hex("#ffffff"), hex("#ffb08a"), ph.dusk), shade = mix(hex("#c8d4ec"), hex("#8a6a9a"), ph.dusk);
      for (let i = 0; i < 7; i++) {
        const span = 700, bx = ((rand(i, 31) * span - cx * 0.06 + time * (2 + rand(i, 33) * 3)) % span + span) % span - 100;
        const by = 18 + rand(i, 32) * 60 - cy * 0.02 + 10, w = 30 + rand(i, 34) * 50;
        for (let j = 0; j < 6; j++) {
          const px = bx + (j / 5) * w, r = 5 + Math.sin((j / 5) * Math.PI) * (6 + rand(i, j) * 6), py = by - Math.sin((j / 5) * Math.PI) * 5;
          for (let y = -r; y <= r * 0.6; y++)
            for (let x = -r; x <= r; x++) {
              if (x * x + y * y > r * r) continue;
              const X = Math.round(px + x), Y = Math.round(py + y);
              if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
              C[Y * W + X] = mix(C[Y * W + X], y < -r * 0.3 ? lit : y > r * 0.3 ? shade : mix(lit, shade, 0.4), k * 0.85);
            }
        }
      }
    }
    return S;
  }
  /** The silhouettes. */
  drawFar(f, tod, S) {
    const cx = f.ox, cy = f.oy, C = f.color, ph = S.ph;
    const light = 0.35 + 0.65 * ph.day + 0.25 * ph.dusk;
    for (let i = 0; i < 4; i++) {
      const k = [0.12, 0.22, 0.36, 0.52][i], base = (62 * 8 - cy) * (0.5 + k * 0.6) + H * 0.62 * (1 - (0.5 + k * 0.6)) + i * 10;
      const fog = [0.62, 0.45, 0.28, 0.14][i];
      for (let x = 0; x < W; x++) {
        const wx = cx * k + x, tx = (cx + x) / 8;
        const b = biomeAt(tx), bi = BIOMES.indexOf(b);
        // blend shapes across a border so the skyline flows
        let h = profile(b.id, i, wx), col = hex(b.hills[i]);
        const dl = tx - b.x0, dr = b.x1 - tx;
        if (dl < 24 && bi > 0) {
          const o = BIOMES[bi - 1], u = 0.5 * (1 - dl / 24);
          h = h * (1 - u) + profile(o.id, i, wx) * u;
          col = mix(col, hex(o.hills[i]), u);
        } else if (dr < 24 && bi < BIOMES.length - 1) {
          const o = BIOMES[bi + 1], u = 0.5 * (1 - dr / 24);
          h = h * (1 - u) + profile(o.id, i, wx) * u;
          col = mix(col, hex(o.hills[i]), u);
        }
        const c = scale(mix(col, S.bot, fog), light), rim = scale(mix(col, mix(S.bot, 0xffffffff, 0.3), fog * 0.6 + 0.25), light);
        const top = Math.round(base - h);
        const snowy = b.id === "frost" && i < 2;
        for (let y = Math.max(0, top); y < H; y++) {
          let cc = y === top ? rim : c;
          if (snowy && y - top < 4 && h > 40) cc = scale(mix(hex("#f0f6ff"), S.bot, fog * 0.6), light);
          C[y * W + x] = cc;
        }
      }
    }
  }
}
