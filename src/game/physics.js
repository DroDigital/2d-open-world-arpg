// Bodies against tiles: boxes from (x - w/2, y - h) to (x + w/2, y), y at the feet. Solid tiles stop them, one-way
// tiles hold them up from above, a one-tile step is climbed without a jump, liquids are noticed.

import { TS, SOLID_T, ONEWAY_T, LIQUID_T, T } from "../world/tiles.js";

// sample heights from top to bottom of a body, at most a tile apart
function rows(top, bot) {
  const out = [];
  for (let py = top; py < bot; py += TS - 1) out.push(py);
  out.push(bot);
  return out;
}
function roomAt(w, x, y, hw, h) {
  for (const py of rows(y - h + 1, y - 1)) for (const px of [x - hw + 1, x, x + hw - 1]) if (SOLID_T[w.at(px, py)]) return false;
  return true;
}

export function move(e, w, dt) {
  const hw = e.w / 2;
  e.hitWall = 0;
  // ---- x
  let nx = e.x + e.vx * dt;
  if (e.vx !== 0) {
    const dir = Math.sign(e.vx), edge = nx + dir * hw, tx = Math.floor((dir > 0 ? edge - 0.001 : edge) / TS);
    let blocked = false, stepTo = null;
    for (const py of rows(e.y - e.h + 1, e.y - 1)) {
      const ty = Math.floor(py / TS);
      if (!SOLID_T[w.tile(tx, ty)]) continue;
      if (e.onGround && e.step && py > e.y - TS - 1) stepTo = ty * TS;
      else blocked = true;
    }
    if (stepTo !== null && !blocked) {
      if (e.y - stepTo <= TS + 0.01 && roomAt(w, nx, stepTo, hw, e.h)) e.y = stepTo;
      else blocked = true;
    }
    if (blocked) {
      nx = dir > 0 ? tx * TS - hw : (tx + 1) * TS + hw;
      e.hitWall = dir;
      e.vx = 0;
    }
  }
  e.x = nx;
  // ---- y
  const wasGround = e.onGround;
  e.onGround = false;
  e.bonk = false;
  let ny = e.y + e.vy * dt;
  const x0 = Math.floor((e.x - hw + 1) / TS), x1 = Math.floor((e.x + hw - 1) / TS);
  if (e.vy >= 0) {
    const ty0 = Math.floor(e.y / TS), ty1 = Math.floor(ny / TS);
    outer: for (let ty = ty0; ty <= ty1; ty++) {
      const top = ty * TS;
      if (top < e.y - 0.01 || ny < top) continue;
      for (let tx = x0; tx <= x1; tx++) {
        const t = w.tile(tx, ty);
        if (SOLID_T[t] || (ONEWAY_T[t] && !(e.drop > 0))) {
          ny = top;
          e.vy = 0;
          e.onGround = true;
          e.groundTile = t;
          break outer;
        }
      }
    }
  } else {
    const ty = Math.floor((ny - e.h) / TS);
    for (let tx = x0; tx <= x1; tx++)
      if (SOLID_T[w.tile(tx, ty)]) {
        ny = (ty + 1) * TS + e.h;
        e.vy = 0;
        e.bonk = true;
        break;
      }
  }
  e.y = ny;
  if (e.drop > 0) e.drop -= dt;
  e.landed = !wasGround && e.onGround;
  // liquids: at the middle of the body, and at the head
  const cx = Math.floor(e.x / TS);
  const mid = w.tile(cx, Math.floor((e.y - e.h * 0.45) / TS)), head = w.tile(cx, Math.floor((e.y - e.h + 3) / TS)), feet = w.tile(cx, Math.floor((e.y - 2) / TS));
  e.liquid = LIQUID_T[mid] ? mid : 0;
  e.under = LIQUID_T[head] ? head : 0;
  e.feetLiquid = LIQUID_T[feet] ? feet : 0;
  e.onVine = w.tile(cx, Math.floor((e.y - e.h * 0.5) / TS)) === T.VINE || w.tile(cx, Math.floor((e.y - 4) / TS)) === T.VINE;
}

/** Is the box free of solid tiles? */
export function free(w, x, y, wdt, h) {
  for (let py = y - h + 1; py <= y - 1; py += Math.min(TS, Math.max(1, y - 1 - py))) {
    for (let px = x - wdt / 2 + 1; px <= x + wdt / 2 - 1; px += Math.max(1, Math.min(TS, x + wdt / 2 - 1 - px))) if (SOLID_T[w.at(px, py)]) return false;
    if (py >= y - 1) break;
  }
  return true;
}

/** Cast a ray in tiles from (x0, y0) toward (x1, y1): true if nothing solid is in the way. */
export function sight(w, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
  for (let i = 1; i < n; i++) {
    const u = i / n;
    if (SOLID_T[w.at(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)]) return false;
  }
  return true;
}
