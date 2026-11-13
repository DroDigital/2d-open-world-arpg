// Casting: mana, cooldowns, and the behaviours named in data/skills.js. Act skills hand the body to the effect's own
// act, so the hero winds up, lets go and recovers exactly as the library choreographed it.

import { FX, actTiming, PAL } from "../pfx.js";
import { SKILLS, START_SKILLS } from "../data/skills.js";
import { HIT } from "../data/fxtimes.js";
import * as POSE from "./poses.js";
import { SHOTS } from "./combat.js";
import { memoOf, blitMemo } from "../engine/fxman.js";

const hitsOf = (id) => {
  const a = FX[id].act;
  if (!a) return [];
  return (a.hits ?? []).filter((h) => !(h.push === 0 && h.straw === 0) && h.target !== false);
};

export class Skills {
  constructor(g) {
    this.g = g;
    this.known = new Set(START_SKILLS);
    this.slots = ["firebolt", "frostnova", "heal", "threefold"];
    this.cd = {};
    this.points = 1;
    this.summons = [];
    this.allies = [];
  }
  serialize() {
    return { known: [...this.known], slots: this.slots, points: this.points };
  }
  load(d) {
    if (!d) return;
    this.known = new Set(d.known);
    this.slots = d.slots;
    this.points = d.points;
  }
  canLearn(id) {
    const s = SKILLS[id];
    return !this.known.has(id) && this.g.rpg.level >= s.lv && this.points >= s.cost;
  }
  learn(id) {
    if (!this.canLearn(id)) return false;
    this.points -= SKILLS[id].cost;
    this.known.add(id);
    const empty = this.slots.indexOf(null);
    if (empty >= 0) this.slots[empty] = id;
    this.g.sfx("attune");
    return true;
  }
  ready(id) {
    return (this.cd[id] ?? 0) <= 0;
  }
  update(dt) {
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    for (const s of this.summons) this.summonUpdate(s, dt);
    this.summons = this.summons.filter((s) => !s.dead);
    for (const a of this.allies) a.update?.(dt);
    this.allies = this.allies.filter((a) => !a.dead);
  }
  /** The nearest foe in front (or anywhere close), for aimed skills. */
  aim(range = 220) {
    const h = this.g.hero;
    let best = null, bd = 1e9;
    for (const e of this.g.combat.targets({ x0: h.x - range, x1: h.x + range, y0: h.y - 140, y1: h.y + 100 })) {
      const d = Math.abs(e.x - h.x) + Math.abs(e.y - h.y) * 0.5 + (Math.sign(e.x - h.x) === h.face ? 0 : 80);
      if (d < bd) (bd = d), (best = e);
    }
    return best;
  }
  cast(slot) {
    const g = this.g, h = g.hero, id = this.slots[slot];
    if (!id) return;
    const s = SKILLS[id], S = g.rpg.stats;
    if (!this.ready(id)) return g.sfx("uiback");
    if (g.rpg.mp < s.mp) return g.toast("NOT ENOUGH MANA", "#6ab0ff");
    if (s.type === "act" && !h.onGround && !s.air) return;
    g.rpg.mp -= s.mp;
    this.cd[id] = s.cd * (1 - S.cdr);
    const power = (s.phys ? S.atk : S.spell) * (s.k ?? 1);
    g.sfx(s.school === "blade" ? "swing" : s.school === "fire" ? "fire" : s.school === "ice" ? "ice" : s.school === "storm" ? "shock" : s.school === "holy" ? "holy" : s.school === "shadow" ? "shadow" : s.school === "nature" ? "nature" : s.school === "tide" ? "water" : s.school === "tech" ? "tech" : "arcane");
    this[s.type](id, s, power, slot);
    g.quests.onCast?.(id);
  }
  // ---- the hero performs an effect's act
  act(id, s, power, slot) {
    const g = this.g, h = g.hero, mod = FX[s.fx], a = mod.act, T = actTiming(mod), hits = hitsOf(s.fx);
    const first = a.poses[0][0], x0 = a.poses[0][1].x ?? 0, speed = 1.25;
    const ox = h.x - h.face * x0;
    const inst = { t: first, spawned: false };
    const targets = T.targets.length ? T.targets : [60];
    const dur = s.dur ?? Math.min(a.poses[a.poses.length - 1][0], (hits[hits.length - 1]?.t ?? 0.4) + 0.5);
    let hi = 0;
    h.state = "cast";
    h.armed = s.phys ? 2 : 0;
    h.cast = {
      t: 0, t0: first, end: a.poses[a.poses.length - 1][0], dur: dur - first, speed, track: a.poses, ox, x0, moveBody: s.moveBody ? true : false, air: s.air, baseY: h.y, slot,
      update: (dt, t) => {
        const tt = t + first;
        if (!inst.spawned && tt >= 0) {
          inst.spawned = true;
          inst.fx = g.fx.spawn(s.fx, ox, h.cast.baseY, { flip: h.face < 0, seed: (g.time * 100) | 0, speed, ...(s.onBody ? { actor: g.heroActor(), follow: h, memo: false } : {}) });
        }
        if (s.moveBody && tt > s.moveBody) h.cast.moveBody = false;
        while (hi < hits.length && tt >= hits[hi].t) {
          const hit = hits[hi++];
          const boxes = [];
          if (s.area === "around") boxes.push({ x0: h.x - (s.r ?? 80), x1: h.x + (s.r ?? 80) });
          else if (s.area === "path") boxes.push({ x0: Math.min(ox, h.x) - 20, x1: Math.max(ox, h.x) + 30 });
          else if (s.area === "line") boxes.push(h.face > 0 ? { x0: h.x, x1: h.x + targets[0] + 30 } : { x0: h.x - targets[0] - 30, x1: h.x });
          else if (s.area === "targets") for (const tx of targets) boxes.push({ x0: ox + h.face * tx - 22, x1: ox + h.face * tx + 22 });
          else {
            const tx = ox + h.face * targets[Math.min(hi - 1, targets.length - 1)], r = s.r ?? 34;
            boxes.push({ x0: tx - r, x1: tx + r });
          }
          const seen = new Set();
          for (const b of boxes)
            for (const e of g.combat.targets({ x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1), y0: h.y - (s.air ? 120 : 90), y1: h.y + 12 })) {
              if (seen.has(e)) continue;
              seen.add(e);
              const crit = Math.random() < g.rpg.stats.crit;
              const per = power / Math.max(1, hits.length * 0.6);
              const d = g.combat.damageEnemy(e, Math.round(per * (crit ? 1.8 : 1)), { el: elOf(s), crit, dir: Math.sign(e.x - h.x) || h.face, src: "hero", status: s.status, heavy: hit.stop > 0.15, push: hit.push });
              if (s.leech) g.rpg.heal(d * s.leech);
            }
          g.ents.hitBox(boxes.map((b) => ({ x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1), y0: h.y - 80, y1: h.y + 10 }))[0], h);
          if (hit.stop) g.freeze(hit.stop * 0.8);
          if (hit.shake) g.shake(hit.amp || 2, hit.shake);
          if (seen.size) g.combo(seen.size);
        }
      },
      end_: () => {
        if (s.air) h.vy = 0;
      },
    };
  }
  proj(id, s, power) {
    const g = this.g, h = g.hero;
    h.state = "cast";
    h.cast = { t: 0, dur: 0.32, pose: (t) => ({ crouch: 3, lean: 2, fx: t < 0.12 ? 4 : 17, fy: t < 0.12 ? -28 : -23, bx: 8, by: -21, ffx: 6, fbx: -7 }) };
    if (s.shot === "fire" || s.shot === "ice") g.fx.spawn("arcane/spell-charge", h.x, h.y, { flip: h.face < 0, seed: 2, life: 0.3, palette: s.shot === "fire" ? PAL.fire : PAL.ice, memo: false });
    g.timers.push({ t: 0.12, fn: () => {
      const tg = this.aim(260), x = h.x + h.face * 14, y = h.y - 23;
      const ang = tg ? Math.atan2(tg.cy - y, tg.x - x) : h.face > 0 ? 0 : Math.PI;
      const clamped = h.face > 0 ? Math.max(-0.7, Math.min(0.7, ang)) : ang > 0 ? Math.max(Math.PI - 0.7, ang) : Math.min(-Math.PI + 0.7, ang);
      g.combat.shoot({ kind: s.shot, x, y, vx: Math.cos(clamped), vy: Math.sin(clamped), owner: "hero", dmg: Math.round(power), el: elOf(s), status: s.status });
    } });
  }
  place(id, s, power) {
    const g = this.g, h = g.hero, tg = s.at === "self" ? null : this.aim(240);
    let x = tg ? tg.x : h.x + h.face * (s.at === "self" ? 0 : 70), y = tg ? g.world.floorBelow(tg.x, tg.y - 6) : h.y;
    if (s.at === "self") (x = h.x), (y = h.y);
    h.state = "cast";
    h.cast = { t: 0, dur: 0.4, pose: (t) => POSE.cast(t) };
    const area = { r: s.r ?? 34, h: s.h, dmg: Math.round(power / (s.ticks ?? 1)), el: elOf(s), status: s.status, ticks: s.ticks ?? 1, every: s.every ?? 0.3, flip: h.face < 0, shake: s.k > 2 ? 2 : 0 };
    if (s.line) {
      // a line along the floor ahead: the effect stands at the hero and reaches out
      const cx = h.x + h.face * s.r * 0.5;
      g.fx.spawn(s.fx, h.x + h.face * 6, h.y, { flip: h.face < 0, seed: (g.time * 100) | 0 });
      g.combat.areas.push({ t: -(HIT[s.fx] ?? 0.3), x: cx, y: h.y, src: "hero", ...area, r: s.r * 0.5, done: 0 });
      return;
    }
    g.combat.areaAttack("hero", s.fx, x, y, area);
    if (s.launch || s.push || s.pull) g.timers.push({ t: HIT[s.fx] ?? 0.3, fn: () => {
      for (const e of g.combat.targets({ x0: x - area.r, x1: x + area.r, y0: y - 100, y1: y + 10 })) {
        if (e.boss) continue;
        if (s.launch) e.vy = -420;
        if (s.push) e.vx += Math.sign(e.x - x || h.face) * 120 * s.push;
        if (s.pull) e.vx -= Math.sign(e.x - x) * 160;
      }
    } });
  }
  channel(id, s, power, slot) {
    const g = this.g, h = g.hero;
    const inst = g.fx.spawn(s.fx, h.x + h.face * 12, h.y - 24, { follow: h, dx: h.face * 12, dy: s.beam ? 0 : -24, flip: h.face < 0, seed: 3, memo: false, light: 0.9, ...(s.beam ? { dy: 0, dx: 0 } : {}) });
    let tick = 0;
    h.state = "cast";
    h.cast = {
      t: 0, dur: 6, channel: true, slot, pose: (t) => ({ crouch: 3, lean: 2, fx: 17, fy: -25, bx: 13, by: -24, ffx: 7, fbx: -8, hy: Math.floor(t * 12) % 2 }),
      update: (dt) => {
        g.rpg.mp -= s.mp * 0.5 * dt;
        if (g.rpg.mp <= 0) h.cast.dur = 0;
        tick -= dt;
        if (tick <= 0) {
          tick = 0.2;
          const x0 = h.face > 0 ? h.x : h.x - s.len, x1 = h.face > 0 ? h.x + s.len : h.x;
          for (const e of g.combat.targets({ x0, x1, y0: h.y - 60, y1: h.y + 10 })) {
            const d = g.combat.damageEnemy(e, Math.max(1, Math.round(power)), { el: elOf(s), dir: h.face, src: "hero", status: Math.random() < 0.25 ? s.status : null, push: s.push ? 0.6 : 0.1 });
            if (s.leech) g.rpg.heal(d * s.leech);
            if (s.push && !e.boss) e.vx += h.face * 60;
          }
        }
      },
      end_: () => g.fx.stop(inst),
    };
  }
  buff(id, s) {
    const g = this.g, h = g.hero;
    g.status.apply(h, s.status);
    h.state = "cast";
    h.cast = { t: 0, dur: 0.45, pose: (t) => POSE.cast(t) };
  }
  target(id, s, power) {
    const g = this.g, h = g.hero, e = this.aim(220);
    h.state = "cast";
    h.cast = { t: 0, dur: 0.45, pose: (t) => ({ ...POSE.cast(t), fx: 18, fy: -28 }) };
    if (!e) return g.toast("NO TARGET");
    if (e.boss) {
      g.combat.damageEnemy(e, Math.round(power * 2), { el: elOf(s), src: "hero" });
      return;
    }
    g.fx.spawn(s.fx, e.x, e.y, { actor: e.actor?.() ?? undefined, follow: e, memo: false, seed: e.uid, flip: e.face < 0 && !e.critter });
    g.status.apply(e, s.status, { dur: s.dur });
    g.combat.damageEnemy(e, Math.round(power), { el: elOf(s), src: "hero" });
    if (s.fx === "ice/freeze") g.timers.push({ t: 2.52, fn: () => !e.dead && g.combat.damageEnemy(e, Math.round(power * 1.5), { el: "ice", src: "hero", crit: true }) });
  }
  summon(id, s, power) {
    const g = this.g, h = g.hero;
    const x = h.x + (s.follow || s.orbit ? 0 : h.face * 40), y = s.follow ? h.y + (s.dy ?? 0) : g.world.floorBelow(h.x + h.face * 40, h.y - 20);
    h.state = "cast";
    h.cast = { t: 0, dur: 0.45, pose: (t) => POSE.cast(t) };
    const inst = g.fx.spawn(s.fx, x, y + (s.dy && !s.follow ? s.dy : 0), { seed: (g.time * 10) | 0, light: 0.8 });
    this.summons.push({ s, inst, x, y, t: 0, dir: h.face, power, acc: 0, shootT: 0 });
  }
  summonUpdate(m, dt) {
    const g = this.g, h = g.hero, s = m.s;
    m.t += dt;
    if (s.follow) {
      m.x += (h.x - m.x) * Math.min(1, 6 * dt);
      m.y += (h.y + (s.dy ?? 0) - m.y) * Math.min(1, 6 * dt);
    } else if (s.orbit) {
      m.x += (h.x - h.face * 22 - m.x) * Math.min(1, 3 * dt);
      m.y += (h.y - 30 + Math.sin(m.t * 2) * 4 - m.y) * Math.min(1, 3 * dt);
    } else if (s.move) {
      // drift toward the nearest foe, or onward
      const tg = this.aimFrom(m.x, m.y, 200);
      const dir = tg ? Math.sign(tg.x - m.x) : m.dir;
      m.x += dir * s.move * dt;
      m.y = g.world.floorBelow(m.x, m.y - 20);
    }
    if (m.inst) {
      m.inst.x = m.x;
      m.inst.y = m.y + (s.orbit ? 30 : 0);
    }
    m.acc -= dt;
    if (m.acc <= 0 && s.k) {
      m.acc = s.pulse ?? 0.4;
      for (const e of g.combat.targets({ x0: m.x - (s.r ?? 30), x1: m.x + (s.r ?? 30), y0: m.y - (s.r ?? 30) - 40, y1: m.y + 20 })) {
        g.combat.damageEnemy(e, Math.max(1, Math.round(m.power)), { el: elOf(s), src: "hero", status: Math.random() < 0.3 ? s.status : null, dir: Math.sign(e.x - m.x) });
        if (s.pull && !e.boss) e.vx -= Math.sign(e.x - m.x) * s.pull * 0.4;
        if (s.push && !e.boss) (e.vx += Math.sign(e.x - m.x) * s.push * 0.4), (e.vy = Math.min(e.vy, -120));
      }
    }
    if (s.heal) g.rpg.heal(g.rpg.stats.maxHp * s.heal * dt * 3);
    if (s.shoot && (m.shootT -= dt) <= 0) {
      const tg = this.aimFrom(m.x, m.y, 180);
      if (tg) {
        m.shootT = 1.2;
        const ang = Math.atan2(tg.cy - (m.y - 30), tg.x - m.x);
        g.combat.shoot({ kind: "arcane", x: m.x, y: m.y - 30, vx: Math.cos(ang), vy: Math.sin(ang), owner: "hero", dmg: Math.round(m.power * 2), el: "arcane" });
      }
    }
    if (m.t >= s.life) {
      m.dead = true;
      g.fx.stop(m.inst);
    }
  }
  aimFrom(x, y, r) {
    let best = null, bd = 1e9;
    for (const e of this.g.combat.targets({ x0: x - r, x1: x + r, y0: y - r, y1: y + r })) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) (bd = d), (best = e);
    }
    return best;
  }
  // ---- the bespoke ones
  special(id, s) {
    const g = this.g, h = g.hero, S = g.rpg.stats;
    const castPose = (dur) => ((h.state = "cast"), (h.cast = { t: 0, dur, pose: (t) => POSE.cast(t) }));
    switch (id) {
      case "heal":
        g.fx.spawn("holy/heal", h.x, h.y, { actor: g.heroActor(), follow: h, memo: false, seed: 1 });
        g.timers.push({ t: 0.5, fn: () => g.rpg.heal(S.maxHp * 0.4) });
        castPose(0.5);
        break;
      case "healring":
        g.fx.spawn("holy/heal-aoe", h.x, h.y, { seed: 2 });
        castPose(0.5);
        for (let i = 0; i < 6; i++) g.timers.push({ t: 0.4 + i * 0.4, fn: () => g.rpg.heal(S.maxHp * 0.06) });
        g.combat.areas.push({ t: -0.4, x: h.x, y: h.y, src: "hero", r: 104, dmg: Math.round(S.spell * 1.2), el: "holy", ticks: 3, every: 0.6, done: 0, h: 60 });
        break;
      case "bloom":
        g.fx.spawn("nature/healing-bloom", h.x + h.face * 18, h.y, { seed: 3 });
        castPose(0.5);
        g.timers.push({ t: 1.2, fn: () => g.rpg.heal(S.maxHp * 0.5) });
        break;
      case "timestop":
        g.fx.spawn("arcane/time-stop", h.x, h.y, { seed: 1 });
        g.timeStop = 5;
        castPose(0.6);
        g.toast("TIME HOLDS ITS BREATH", "#c684ff");
        break;
      case "recall":
        g.fx.spawn("arcane/portal", h.x + h.face * 24, h.y, { seed: 1, life: 2.4 });
        castPose(1.2);
        g.timers.push({ t: 1.4, fn: () => g.travel("brightwater") });
        break;
      case "decoy": {
        const x = h.x + h.face * 30, y = h.y;
        const inst = g.fx.spawn("scifi/hologram", x, y, { seed: 2, life: 8 });
        g.decoy = { x, y, t: 8, inst };
        for (const e of g.enemies) if (Math.abs(e.x - x) < 200) (e.aggro = false), (e.distracted = 8);
        castPose(0.4);
        break;
      }
      case "scan":
        g.fx.spawn("scifi/scanner", h.x, h.y, { actor: g.heroActor(), follow: h, memo: false, seed: 1 });
        for (const e of g.enemies) if (Math.abs(e.x - h.x) < 200 && Math.abs(e.y - h.y) < 120) (g.status.apply(e, "cursed", { dur: 10 }), (e.scanned = 12));
        castPose(0.4);
        break;
      case "smokebomb":
        g.fx.spawn("explosions/smoke-bomb", h.x, h.y, { seed: 2 });
        g.timers.push({ t: 0.95, fn: () => {
          g.status.apply(h, "haste", { dur: 4 });
          for (const e of g.enemies) e.aggro = false;
          g.hiddenT = 4;
        } });
        castPose(0.3);
        break;
      case "phase": {
        g.fx.spawn("scifi/warp-out", h.x, h.y, { actor: g.heroActor(), memo: false, seed: 2 });
        g.heroHidden = 0.9;
        h.inv = 1.2;
        castPose(0.9);
        g.timers.push({ t: 0.9, fn: () => {
          let nx = h.x;
          for (let d = 0; d < 110; d += 4) if (!g.world.solid(h.x + h.face * d, h.y - 20) && !g.world.solid(h.x + h.face * d, h.y - 4)) nx = h.x + h.face * d; else break;
          h.x = nx;
          g.fx.spawn("scifi/warp-in", h.x, h.y, { actor: g.heroActor(), memo: false, seed: 2 });
        } });
        break;
      }
      case "brute":
        g.fx.spawn("spawn/summon-rise", h.x + h.face * 40, h.y, { seed: 3 });
        castPose(1);
        g.timers.push({ t: 2.4, fn: () => this.addAlly("brute", h.x + h.face * 40, h.y) });
        break;
      case "egg":
        g.fx.spawn("spawn/egg-hatch", h.x + h.face * 20, h.y, { seed: 4 });
        castPose(0.5);
        g.timers.push({ t: 2.6, fn: () => this.addAlly("slime", h.x + h.face * 20, h.y) });
        break;
    }
  }
  blink() {
    const g = this.g, h = g.hero;
    if (h.dashCd > 0) return;
    h.dashCd = 0.9;
    g.fx.spawn("arcane/blink-out", h.x, h.y, { actor: g.heroActor(), memo: false, seed: 1, flip: h.face < 0 });
    let nx = h.x, ny = h.y;
    for (let d = 0; d <= 96; d += 4) {
      const tx = h.x + h.face * d, ty = h.y - (g.input.down.up ? d * 0.6 : 0);
      if (g.world.solid(tx, ty - 4) || g.world.solid(tx, ty - 30)) break;
      nx = tx;
      ny = ty;
    }
    h.x = nx;
    h.y = ny;
    h.vy = Math.min(h.vy, 0);
    h.inv = Math.max(h.inv, 0.25);
    g.fx.spawn("arcane/blink-in", h.x, h.y, { actor: g.heroActor(), memo: false, seed: 1, flip: h.face < 0 });
    g.sfx("arcane");
  }
  /** Allies: a summoned brute or a hatched slime that fight beside you for a while. */
  addAlly(kind, x, y) {
    const g = this.g;
    const memo = kind === "slime" ? memoOf("critters/slime", { palette: PAL.candy.slice(0, 7) }) : null;
    const ally = {
      kind, x, y, t: 0, life: kind === "brute" ? 25 : 60, face: 1, hitT: 0,
      update: (dt) => {
        ally.t += dt;
        const tg = this.aimFrom(ally.x, ally.y, 200), h = g.hero;
        const tx = tg ? tg.x : h.x - h.face * 30;
        ally.face = Math.sign(tx - ally.x) || ally.face;
        if (Math.abs(tx - ally.x) > 16) ally.x += ally.face * (kind === "brute" ? 60 : 45) * dt;
        ally.y = g.world.floorBelow(ally.x, ally.y - 16);
        ally.hitT -= dt;
        if (tg && Math.abs(tg.x - ally.x) < 30 && ally.hitT <= 0) {
          ally.hitT = kind === "brute" ? 1.2 : 0.9;
          g.combat.damageEnemy(tg, Math.round(g.rpg.stats.spell * (kind === "brute" ? 2.2 : 0.8)), { src: "hero", dir: ally.face, heavy: kind === "brute" });
          if (kind === "brute") g.fx.spawn("melee/hammer-smash", ally.x, ally.y, { flip: ally.face < 0, seed: (ally.t * 10) | 0, palette: PAL.ember });
        }
        if (ally.t > ally.life) {
          ally.dead = true;
          g.fx.spawn(kind === "brute" ? "spawn/dissolve-burn" : "spawn/poof", ally.x, ally.y, { seed: 1, ...(kind === "brute" ? { actor: undefined } : {}) });
        }
      },
      draw: (S) => {
        if (kind === "slime") blitMemo(S, memo, ally.t, ally.x, ally.y - 12, { layer: "act" });
        else g.drawAllyBrute?.(S, ally);
      },
    };
    this.allies.push(ally);
    return ally;
  }
  draw(S) {
    for (const a of this.allies) a.draw(S);
  }
}

function elOf(s) {
  return { fire: "fire", ice: "ice", storm: "shock", arcane: "arcane", holy: "holy", shadow: "shadow", nature: "poison", tide: "water", tech: "shock" }[s.school] ?? null;
}
export { SKILLS, SHOTS };
