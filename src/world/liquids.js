// Water, lava and sludge, drawn every frame: a moving surface with a lit lip, translucent depths for water,
// glowing churn for lava. Water goes over the characters (lit), lava and sludge glow (emissive) and light the world.

import { hex, mix, noise2, rand } from "../pfx.js";
import { blendOver, glow } from "../engine/render.js";
import { T, TS, LIQUID_T } from "./tiles.js";

const WATER = ["#c8f0ff", "#6ac0ec", "#2e86c8", "#1c5a9a", "#123c70", "#0a2448"].map(hex);
const LAVA = ["#fff4c0", "#ffd25a", "#ff8c2a", "#e8501a", "#ac2410", "#6e1210"].map(hex);
const CRYS = hex("#b46cf0");
const TOXIC = ["#e0ff8a", "#a8e04a", "#6cb82a", "#3f8a1e", "#265e18", "#173a14"].map(hex);

export function drawLiquids(S, w, time) {
  const f = S.act, F = S.front, cx = S.camX, cy = S.camY;
  const tx0 = Math.floor(cx / TS), tx1 = Math.floor((cx + f.w) / TS), ty0 = Math.floor(cy / TS), ty1 = Math.floor((cy + f.h) / TS);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = w.tile(tx, ty);
      if (t === T.CRYSTAL) {
        if (((tx + ty) & 1) === 0) glow(f, tx * TS + 4, ty * TS + 4, 18, CRYS, 0.16 + 0.06 * Math.sin(time * 2 + tx));
        continue;
      }
      if (!LIQUID_T[t]) continue;
      const surf = !LIQUID_T[w.tile(tx, ty - 1)] && w.tile(tx, ty - 1) !== T.BRIDGE ? 1 : 0;
      const R = t === T.WATER ? WATER : t === T.LAVA ? LAVA : TOXIC, glowy = t !== T.WATER;
      for (let y = 0; y < TS; y++) {
        const wy = ty * TS + y, sy = wy - cy;
        if (sy < 0 || sy >= f.h) continue;
        for (let x = 0; x < TS; x++) {
          const wx = tx * TS + x, sx = wx - cx;
          if (sx < 0 || sx >= f.w) continue;
          let c, a = 1;
          // the surface rolls: a wave height per column
          const wave = surf ? Math.round(1.2 + Math.sin(wx * 0.18 + time * 2.2) * 0.9 + Math.sin(wx * 0.07 - time * 1.3) * 0.7) : -9;
          if (surf && y < wave) continue;
          const depth = (ty - (surf ? ty : ty - 1)) * TS + y;
          if (t === T.WATER) {
            if (surf && y === wave) (c = R[0]), (a = 0.85);
            else if (surf && y === wave + 1) (c = R[1]), (a = 0.7);
            else {
              const n = noise2(wx / 9 + time * 0.4, wy / 5 - time * 0.2, 3);
              c = n > 0.55 ? R[1] : depth > 6 ? R[3] : R[2];
              a = 0.55;
            }
            const i = sy * f.w + sx;
            f.color[i] = blendOver(f.color[i] || 0xff000000 | S.bg.color[i], c, a) | 0xff000000;
          } else {
            const n = noise2(wx / 7 + time * 0.6, wy / 4 + time * 0.3, 5) + noise2(wx / 3 - time, wy / 3, 9) * 0.3;
            if (surf && y === wave) c = R[0];
            else c = n > 0.45 ? R[1] : n > 0 ? R[2] : n > -0.4 ? R[3] : R[4];
            F.color[sy * f.w + sx] = c;
          }
        }
      }
      if (glowy && surf && (tx & 1) === 0) glow(f, tx * TS + 4, ty * TS + 2, t === T.LAVA ? 26 : 16, t === T.LAVA ? LAVA[2] : TOXIC[2], t === T.LAVA ? 0.35 : 0.2);
      // bubbles in sludge and lava
      if (glowy && surf && rand(tx, Math.floor(time * 2), 7) < 0.08) {
        const bx = tx * TS + 4 - cx, by = ty * TS - 1 - cy;
        if (bx >= 0 && by >= 0 && bx < f.w && by < f.h) F.color[by * f.w + bx] = R[0];
      }
    }
}
