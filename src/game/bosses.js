// The Wardens who took the shards, and the Hollow King behind them. Giants are the dressed skeleton drawn twice the
// size, swinging effects blown up to match; the Mire King and the Watcher are critter loops three times the size.
// Each boss is a list of telegraphed moves built from the library's effects.

import { FX, PAL, poseAt, clamp, hex } from "../pfx.js";
import { costume, drawRig, actorOf } from "./rigdraw.js";
import { memoOf, memoBounds, blitMemo, actorOfMemo } from "../engine/fxman.js";
import { strokeOf } from "./hero.js";
import { move } from "./physics.js";
import { HIT } from "../data/fxtimes.js";
import { SHARDS } from "../data/items.js";
import * as POSE from "./poses.js";
import { T, TS } from "../world/tiles.js";
import { WEAPONS } from "../data/weapons.js";

const C = (spec) => costume(spec);
export const BOSSES = {
  warden: { name: "THE GROVE WARDEN", title: "KEEPER OF THE VERDANT SHARD", lv: 6, hp: 520, rig: true, k: 2, weapon: "scythe", pal: PAL.leaf, el: "poison",
    costume: C({ id: "b:warden", hair: ["#7cc048", "#4f9a3a", "#357530", "#225224"], skin: ["#b47c40", "#8e5c2c", "#6a421e", "#4a2c14"], tunic: ["#6a421e", "#4a2c14", "#2e1a0c", "#160c06"], arm: ["#8e5c2c", "#6a421e", "#4a2c14", "#2e1a0c"], belt: ["#4f9a3a", "#357530", "#225224", "#163418"], legs: ["#4a2c14", "#2e1a0c", "#160c06", "#0a0603"], boots: ["#6a421e", "#4a2c14", "#2e1a0c", "#160c06"], glowEye: "#c8ff6a" }),
    moves: ["reap", "vines", "thorns", "roots", "wisps", "gale"] },
  mireking: { name: "THE MIRE KING", title: "KEEPER OF THE TIDAL SHARD", lv: 9, hp: 760, critter: "critters/slime", k: 3, opts: { palette: ["#140a1a", "#2c1240", "#4a1c60", "#6a3a8a", "#9a6ad0", "#c8a0f0", "#f4e8ff"] }, el: "poison",
    moves: ["leap", "acid", "miasma", "spawn", "spores"] },
  colossus: { name: "THE RIME COLOSSUS", title: "KEEPER OF THE RIME SHARD", lv: 12, hp: 1100, rig: true, k: 2, weapon: "greatsword", pal: PAL.ice, el: "ice",
    costume: C({ id: "b:colossus", hair: ["#ffffff", "#d8f4ff", "#9bdcff", "#58b4ec"], skin: ["#d8f4ff", "#9bdcff", "#58b4ec", "#2f7fcc"], tunic: ["#a8c8ec", "#6a8ab8", "#40588a", "#22345c"], arm: ["#d8f4ff", "#9bdcff", "#58b4ec", "#2f7fcc"], belt: ["#58b4ec", "#2f7fcc", "#1f4f94", "#162c5c"], legs: ["#6a8ab8", "#40588a", "#22345c", "#121c34"], boots: ["#d8f4ff", "#9bdcff", "#58b4ec", "#2f7fcc"], glowEye: "#7cf0ff", steel: ["#ffffff", "#d8f4ff", "#9bdcff", "#58b4ec"] }),
    moves: ["cleave", "nova", "spikes", "icicles", "vortex", "breath"] },
  tyrant: { name: "THE CINDER TYRANT", title: "KEEPER OF THE CINDER SHARD", lv: 15, hp: 1500, rig: true, k: 2, weapon: "hammer", pal: PAL.fire, el: "fire",
    costume: C({ id: "b:tyrant", hair: ["#ffe27a", "#ffae35", "#f2701f", "#cc3a1a"], skin: ["#6a3a32", "#4a2626", "#321a1c", "#1e1012"], tunic: ["#4a2626", "#321a1c", "#1e1012", "#100608"], arm: ["#8c1d1c", "#4a1118", "#2a0a0e", "#1f0b10"], belt: ["#ffae35", "#f2701f", "#cc3a1a", "#8c1d1c"], legs: ["#321a1c", "#1e1012", "#100608", "#080304"], boots: ["#4a2626", "#321a1c", "#1e1012", "#100608"], glowEye: "#ffe27a" }),
    moves: ["smash", "pillars", "meteors", "ring", "firestorm", "fbreath"] },
  engine: { name: "THE ENGINE", title: "KEEPER OF THE STORM SHARD", lv: 18, hp: 1900, rig: true, k: 2, weapon: "launcher", pal: PAL.electric, el: "shock",
    costume: C({ id: "b:engine", hair: ["#c8d4e0", "#94a4b8", "#6a7a90", "#4c586c"], skin: ["#94a4b8", "#6a7a90", "#4c586c", "#343c4c"], tunic: ["#6a7a90", "#4c586c", "#343c4c", "#20262e"], arm: ["#ffd84a", "#c48412", "#86520c", "#4a2c08"], belt: ["#4ce8d8", "#18b4b0", "#108088", "#0c5260"], legs: ["#4c586c", "#343c4c", "#20262e", "#12161c"], boots: ["#343c4c", "#20262e", "#12161c", "#08090c"], glowEye: "#4ce8d8" }),
    moves: ["rocket", "missiles", "grid", "emp", "discs", "chain", "strikes"] },
  watcher: { name: "THE WATCHER BELOW", title: "KEEPER OF THE UMBRAL SHARD", lv: 11, hp: 980, critter: "critters/eyeball", k: 3, opts: { hover: 0, iris: ["#0f0a18", "#432468", "#8048b8", "#d8a0ff", "#ffffff"] }, fly: true, el: "shadow",
    moves: ["lasers", "tendrils", "hands", "skulls", "voidorb", "darkstar", "pull"] },
  king: { name: "THE HOLLOW KING", title: "WHO SHATTERED THE LANTERN", lv: 22, hp: 3200, rig: true, k: 2, weapon: "greatsword", pal: PAL.shadow, el: "shadow",
    costume: C({ id: "b:king", hair: ["#ffe066", "#f0b424", "#c48412", "#86520c"], skin: ["#2c1a4a", "#1c1230", "#0f0a18", "#050308"], tunic: ["#1c1230", "#0f0a18", "#050308", "#020104"], arm: ["#ffe066", "#c48412", "#86520c", "#4a2c08"], belt: ["#ffe066", "#f0b424", "#c48412", "#86520c"], legs: ["#0f0a18", "#050308", "#020104", "#000000"], boots: ["#ffe066", "#c48412", "#86520c", "#4a2c08"], glowEye: "#ffffff", steel: ["#ffffff", "#ecc8ff", "#a970e0", "#5e3290"] }),
    moves: ["kcleave", "pillar", "stars", "darkstar", "timestop", "summon", "smite"] },
};

export class Bosses {
  constructor(g) {
    this.g = g;
    this.cur = null;
  }
  get active() {
    return this.cur;
  }
  /** The hero walks near an arena. */
  near(e, dt, h) {
    const g = this.g, a = e.arena;
    if (g.rpg.flags["boss:" + e.id] || this.cur || h.dead) return;
    if (h.x > a.x0 + 24 && h.x < a.x1 - 24 && Math.abs(h.y - a.y) < 80) this.start(e);
  }
  start(e) {
    const g = this.g, D = BOSSES[e.id], a = e.arena;
    const b = {
      id: e.id, D, ent: e, arena: a, boss: true, active: true, x: (a.x0 + a.x1) / 2 + 60, y: a.y, vx: 0, vy: 0, face: -1, t: 0, hp: 0, maxHp: Math.round(D.hp * (1 + Math.max(0, g.rpg.level - D.lv) * 0.08)),
      dmg: Math.round(8 + D.lv * 2.6), w: D.rig ? 22 : 40, h: D.rig ? 70 : 50, k: D.k, cool: 2.2, move: null, phase: 1, flash: 0, st: null, step: true, onGround: false, def: { el: D.el },
      immune: ["frozen", "petrified", "sleep", "charmed", "confused"],
    };
    b.hp = b.maxHp;
    if (D.critter) {
      b.memo = memoOf(D.critter, D.opts, false);
      b.memoF = memoOf(D.critter, D.opts, true);
      const bb = memoBounds(b.memo);
      b.ox = -((bb.x0 + bb.x1) / 2) * D.k;
      b.oy = -bb.y1 * D.k;
      b.w = Math.round((bb.x1 - bb.x0) * D.k * 0.6);
      b.h = Math.round((bb.y1 - bb.y0) * D.k * 0.7);
      if (D.fly) b.y = a.y - 50;
    } else {
      b.pose = POSE.idle(0, WEAPONS[D.weapon]);
      b.weapon = WEAPONS[D.weapon];
    }
    b.actor = () => (D.rig ? actorOf(b.pose, D.costume) : actorOfMemo(b.face < 0 ? b.memoF : b.memo, b.t));
    this.cur = b;
    g.boss = b;
    // seal the arena
    const ty = Math.floor(a.y / TS);
    b.gates = [];
    for (const x of [Math.floor(a.x0 / TS) - 1, Math.floor(a.x1 / TS)]) for (let y = ty - 14; y < ty; y++) if (g.world.tile(x, y) === T.AIR || g.world.tile(x, y) === T.WATER) {
      b.gates.push([x, y, g.world.tile(x, y)]);
      g.world.setTile(x, y, T.GATE);
    }
    g.ui.transition("transitions/slash-wipe", null, { half: true });
    g.ui.bossIntro(D);
    g.sfx("boss");
    // the giant arrives
    if (D.rig) g.fx.spawn("spawn/summon-rise", b.x, b.y, { seed: 7, palette: D.pal });
    else g.fx.spawn("spawn/spawn-portal", b.x, b.y, { seed: 7 });
    b.cool = 3;
  }
  reset() {
    const g = this.g, b = this.cur;
    if (!b) return;
    for (const [x, y, t] of b.gates) g.world.setTile(x, y, t);
    g.status.clearAll(b);
    this.cur = null;
    g.boss = null;
  }
  update(dt) {
    const g = this.g, b = this.cur;
    if (!b) return;
    if (b.dead) {
      b.deadT += dt;
      return;
    }
    b.t += dt;
    if (b.flash > 0) b.flash -= dt;
    g.status.update(b, dt);
    if (b.dead) return;
    // leave the arena (a waystone, a fall) and the warden waits for you
    if (g.hero.x < b.arena.x0 - 200 || g.hero.x > b.arena.x1 + 200 || Math.abs(g.hero.y - b.arena.y) > 300) return this.reset();
    const h = g.hero, dx = h.x - b.x, stopped = g.timeStop > 0 || g.status.has(b, "stunned");
    if (!b.move && !stopped) b.face = Math.sign(dx) || b.face;
    if (stopped) return;
    // physics
    if (b.D.fly) {
      const ty = b.arena.y - 46 + Math.sin(b.t * 1.3) * 8 - (b.move ? 0 : 0);
      b.y += (ty - b.y) * Math.min(1, 2 * dt);
      if (!b.move) b.x += clamp(h.x - b.face * 90 - b.x, -40 * dt, 40 * dt);
      b.x = clamp(b.x, b.arena.x0 + 40, b.arena.x1 - 40);
    } else if (b.D.critter) {
      b.vy = Math.min(500, b.vy + 950 * dt);
      move(b, g.world, dt);
    } else {
      if (!b.move) {
        const want = Math.abs(dx) > 70 ? Math.sign(dx) : 0;
        b.vx += (want * 46 - b.vx) * Math.min(1, 4 * dt);
        b.pose = Math.abs(b.vx) > 8 ? POSE.run((b.t * 1.1) % 1, b.weapon, 0.6) : POSE.idle(b.t, b.weapon);
      }
      b.vy = Math.min(500, b.vy + 950 * dt);
      move(b, g.world, dt);
    }
    b.x = clamp(b.x, b.arena.x0 + 20, b.arena.x1 - 20);
    // a move in progress
    if (b.move) {
      b.move.t += dt;
      b.move.fn?.(dt, b.move.t);
      if (b.move.t >= b.move.dur) {
        b.move = null;
        b.cool = (b.phase > 1 ? 0.9 : 1.4) + Math.random() * 0.8;
      }
      return;
    }
    // contact hurts
    if (Math.abs(dx) < b.w / 2 + 4 && Math.abs(h.cy - (b.y - b.h / 2)) < b.h / 2 + 10 && h.inv <= 0) g.damageHero(Math.round(b.dmg * 0.6), { el: b.D.el, src: b, dir: Math.sign(dx) || 1 });
    b.cool -= dt;
    if (b.cool <= 0) this.pick(b);
  }
  pick(b) {
    const list = b.D.moves, g = this.g, h = g.hero, dist = Math.abs(h.x - b.x);
    let id = list[Math.floor(Math.random() * list.length)];
    // close in for a melee move when near
    if (dist < 110 && Math.random() < 0.5) id = list[0];
    if (id === b.lastMove && Math.random() < 0.6) id = list[(list.indexOf(id) + 1) % list.length];
    b.lastMove = id;
    MOVES[id](this, b, g, h);
  }
  // a giant's melee stroke from an act, everything doubled
  stroke(b, fxId, dmgK = 1.4) {
    const g = this.g, s = strokeOf(fxId, 0.9), k = b.k, h = g.hero;
    const ox = b.x - b.face * s.x0 * k;
    let spawned = false, hi = 0;
    b.move = {
      t: 0, dur: -s.first * 0.9 + Math.min(s.end, s.last + 0.5),
      fn: (dt, u) => {
        const W = 0.9, wind = -s.first * W, t = u < wind ? s.first + u / W : u - wind;
        if (!spawned && t >= 0) {
          spawned = true;
          g.fx.spawn(fxId, ox, b.y, { flip: b.face < 0, seed: (b.t * 10) | 0, palette: b.D.pal, k, memo: false });
          g.sfx("swing", { heavy: true });
        }
        while (hi < s.hits.length && t >= s.hits[hi].t) {
          const hit = s.hits[hi++];
          const reach = s.reach * k, x0 = s.around ? b.x - reach : b.face > 0 ? b.x - 10 : b.x - reach, x1 = s.around ? b.x + reach : b.face > 0 ? b.x + reach : b.x + 10;
          if (h.x > x0 && h.x < x1 && h.y > b.y - 110 && h.y - h.h < b.y + 6) g.damageHero(Math.round(b.dmg * dmgK), { el: b.D.el, src: b, dir: b.face, stop: hit.stop, shake: hit.shake, amp: (hit.amp || 2) + 1 });
          g.shake((hit.amp || 2) + 1, (hit.shake || 0.2) + 0.1);
        }
        const pose = poseAt(s.poses, Math.min(t, s.end));
        b.pose = { ...pose, x: 0, y: 0 };
        const want = ox + b.face * (pose.x ?? 0) * k;
        b.vx = clamp((want - b.x) / Math.max(dt, 1e-3), -300, 300);
      },
    };
  }
  /** Cast pose and a list of timed actions. */
  cast(b, dur, steps, pose) {
    const g = this.g;
    let i = 0;
    b.vx = 0;
    b.move = { t: 0, dur, fn: (dt, t) => {
      if (b.D.rig) b.pose = pose ? pose(t) : POSE.cast(t);
      while (i < steps.length && t >= steps[i][0]) steps[i++][1]();
    } };
    g.sfx("cast");
  }
  area(b, fxId, x, y, o = {}) {
    this.g.combat.areaAttack(b, fxId, x, y, { dmg: Math.round(b.dmg * (o.k ?? 1)), el: b.D.el, ...o });
  }
  onDamage(b, dmg, o) {
    const g = this.g;
    b.flash = 0.1;
    if (dmg > b.maxHp * 0.06) g.fx.spawn("ui/health-bar-hit", 160, 166, { layer: "ui", from: Math.min(1, (b.hp + dmg) / b.maxHp), to: Math.max(0, b.hp / b.maxHp), seed: 2 });
    // phase two at half health: faster, angrier
    if (b.phase === 1 && b.hp < b.maxHp * 0.5) {
      b.phase = 2;
      g.status.apply(b, "rage", { dur: 999 });
      g.toast(b.D.name + " IS ENRAGED", "#ff5a3a");
    }
    void o;
  }
  onKill(b) {
    const g = this.g, D = b.D;
    // the Hollow King rises once
    if (b.id === "king" && !b.risen) {
      b.risen = true;
      b.dead = false;
      b.hp = Math.round(b.maxHp * 0.6);
      b.move = { t: 0, dur: 4.8, fn: () => (b.pose = POSE.dead()) };
      g.fx.spawn("holy/resurrection", b.x, b.y, { actor: b.actor(), seed: 3, memo: false, palette: PAL.shadow, k: 2 });
      g.toast("THE KING WILL NOT STAY DOWN", "#a970e0");
      b.phase = 3;
      g.timers.push({ t: 5, fn: () => (b.moveSet = 2) });
      return;
    }
    b.deadT = 0;
    g.freeze(0.25);
    g.fx.spawn("impacts/impact-frame", 160, 90, { layer: "ui", seed: 1 });
    g.timers.push({ t: 0.3, fn: () => {
      g.fx.spawn("explosions/big-explosion", b.x, b.y, { seed: 5 });
      g.shake(6, 1.2);
      g.sfx("boom", { big: true });
    } });
    if (D.rig) g.fx.spawn("spawn/disintegrate", b.x, b.y, { actor: b.actor(), memo: false, seed: 4, k: 2 });
    this.cur = null;
    g.boss = null;
    g.rpg.flags["boss:" + b.id] = true;
    for (const [x, y, t] of b.gates) g.world.setTile(x, y, t);
    g.rpg.gainXp(Math.round(80 + D.lv * 40));
    g.skills.points += 2;
    g.timers.push({ t: 2.2, fn: () => {
      if (SHARDS[b.id]) {
        g.rpg.shards[b.id] = true;
        g.fx.spawn("pickups/loot-beam", b.x, b.y, { life: 4, palette: SHARDS[b.id].pal });
        g.fx.spawn("ui/achievement", 160, 26, { layer: "ui", title: SHARDS[b.id].name.toUpperCase(), text: SHARDS[b.id].desc.toUpperCase().slice(0, 26), seed: 4 });
        g.sfx("shard");
        g.ui.say(SHARDS[b.id].name.toUpperCase(), "The shard's light runs up your arm. " + SHARDS[b.id].desc + " (2 skill points gained.)");
      }
      g.ents.dropLoot(b.x, b.y - 20, g.rpg.rollLoot(D.lv + 2, 1));
      g.ents.dropLoot(b.x + 20, b.y - 20, g.rpg.rollLoot(D.lv + 2, 0.8));
      g.ents.dropGold(b.x, b.y, 150 + D.lv * 30);
      g.quests.onBoss(b.id);
      g.save();
    } });
    if (b.id === "king") g.timers.push({ t: 4, fn: () => g.ui.transition("transitions/shatter-wipe", () => g.ui.open("ending")) });
  }
  draw(S) {
    const b = this.cur, g = this.g;
    if (!b || b.dead) return;
    if (g.status.hidesBody(b)) return;
    const flash = b.flash > 0 && Math.floor(b.flash * 40) % 2 === 0;
    const tint = b.phase > 1 ? [hex("#ff3a2a"), 0.12 + 0.08 * Math.sin(b.t * 8)] : null;
    if (b.D.rig) drawRig(S.act, b.pose, b.D.costume, b.x, b.y, { flip: b.face < 0, k: 2, flash, tint });
    else blitMemo(S, b.face < 0 ? b.memoF : b.memo, b.t, b.x + (b.face < 0 ? -b.ox : b.ox), b.y + b.oy, { k: b.k, layer: "act", flash, tint });
  }
}

// ---- the moves
const fy = (g, x, y) => g.world.floorBelow(x, y - 40);
const MOVES = {
  // grove warden
  reap: (B, b) => B.stroke(b, "melee/scythe-reap", 1.5),
  vines: (B, b, g, h) => B.cast(b, 1.2, [[0.3, () => B.area(b, "nature/vine-whip", b.x + b.face * 10, b.y, { r: 75, flip: b.face < 0, at: HIT["nature/vine-whip"] })]]),
  thorns: (B, b, g) => B.cast(b, 1.4, [[0.3, () => {
    g.fx.spawn("nature/thorns", b.x + b.face * 16, b.y, { flip: b.face < 0, seed: (b.t * 7) | 0 });
    g.combat.areas.push({ t: -0.3, x: b.x + b.face * 110, y: b.y, src: b, r: 100, dmg: Math.round(b.dmg * 1.1), el: "poison", status: "bleeding", ticks: 3, every: 0.25, done: 0 });
  }]]),
  roots: (B, b, g, h) => B.cast(b, 1.3, [[0.4, () => {
    g.fx.spawn("nature/root-snare", h.x, h.y, { actor: g.heroActor(), memo: false, seed: 2 });
    g.timers.push({ t: 0.62, fn: () => Math.abs(g.hero.x - h.x) < 20 && (g.status.apply(g.hero, "stunned", { dur: 1.3 }), g.damageHero(Math.round(b.dmg * 0.8), { el: "poison", quiet: true })) });
  }]]),
  wisps: (B, b, g) => B.cast(b, 1.2, [[0.5, () => { for (let i = 0; i < 2 + b.phase; i++) g.addEnemy("wisp", b.x + (i - 1) * 40, b.y - 60, b.D.lv - 2).aggro = true; }]]),
  gale: (B, b, g) => B.cast(b, 2.4, [[0.2, () => g.fx.spawn("nature/leaf-storm", b.x, b.y, { k: 2, seed: 3, memo: false, life: 2.2 })], [0.6, () => g.combat.areas.push({ t: 0, x: b.x, y: b.y, src: b, r: 70, h: 100, dmg: Math.round(b.dmg * 0.5), el: "poison", ticks: 5, every: 0.3, done: 0 })]]),
  // mire king
  leap: (B, b, g, h) => {
    const dir = Math.sign(h.x - b.x) || 1;
    b.move = { t: 0, dur: 1.8, fn: (dt, t) => {
      const ph = b.t % 1.8, air = ph >= 0.9 && ph < 1.44;
      b.vx = air ? dir * 150 : 0;
      if (t > 1.3 && !b.slammed && !air && ph >= 1.44) {
        b.slammed = true;
        g.fx.spawn("impacts/ground-slam", b.x, b.y, { seed: 3, palette: PAL.arcane.slice(0, 7) });
        g.shake(4, 0.4);
        if (Math.abs(g.hero.x - b.x) < 100 && g.hero.onGround) g.damageHero(Math.round(b.dmg * 1.3), { el: "poison", src: b, dir: Math.sign(g.hero.x - b.x) || 1 });
      }
    } };
    b.slammed = false;
  },
  acid: (B, b, g, h) => B.cast(b, 1.4, [0.2, 0.6, 1].map((t, i) => [t, () => B.area(b, "nature/acid-splash", h.x + (i - 1) * 36, fy(g, h.x, h.y), { r: 24, status: "poisoned" })])),
  miasma: (B, b, g) => B.cast(b, 1, [[0.2, () => {
    const x = b.x + (Math.random() - 0.5) * 140;
    g.fx.spawn("nature/poison-cloud", x, b.y, { life: 7, seed: 4 });
    g.combat.areas.push({ t: 0, x, y: b.y, src: b, r: 90, h: 40, dmg: Math.round(b.dmg * 0.25), el: "poison", status: "poisoned", ticks: 12, every: 0.6, done: 0 });
  }]]),
  spawn: (B, b, g) => B.cast(b, 1, [[0.4, () => { for (let i = 0; i < 3; i++) g.addEnemy("slime_toxic", b.x + (i - 1) * 30, b.y, b.D.lv - 3).aggro = true; }]]),
  spores: (B, b, g, h) => B.cast(b, 1, [[0.2, () => B.area(b, "nature/spore-burst", h.x, fy(g, h.x, h.y), { r: 50, status: "confused", k: 0.6 })]]),
  // rime colossus
  cleave: (B, b) => B.stroke(b, "melee/heavy-cleave", 1.6),
  nova: (B, b, g) => B.cast(b, 1.6, [[0.3, () => B.area(b, "ice/frost-nova", b.x, b.y, { r: 100, h: 60, status: "frozen", k: 1.2 })]]),
  spikes: (B, b, g) => B.cast(b, 1.6, [[0.3, () => {
    g.fx.spawn("ice/ice-spikes", b.x + b.face * 20, b.y, { flip: b.face < 0, seed: 3 });
    g.combat.areas.push({ t: -0.25, x: b.x + b.face * 110, y: b.y, src: b, r: 90, h: 56, dmg: Math.round(b.dmg * 1.2), el: "ice", status: "slowed", ticks: 2, every: 0.3, done: 0 });
  }]]),
  icicles: (B, b, g, h) => B.cast(b, 2, [0, 0.35, 0.7, 1.05].map((t, i) => [t, () => B.area(b, "ice/icicle-fall", h.x + (i % 2 ? 26 : -26) * (i > 1 ? 1 : 0.4), fy(g, h.x, h.y), { r: 14, h: 60, status: "slowed" })])),
  vortex: (B, b, g) => B.cast(b, 1, [[0.3, () => {
    const x = b.x + b.face * 60;
    g.fx.spawn("ice/blizzard-vortex", x, b.y, { life: 6, seed: 2 });
    g.combat.areas.push({ t: 0, x, y: b.y, src: b, r: 30, h: 80, dmg: Math.round(b.dmg * 0.4), el: "ice", status: "slowed", ticks: 14, every: 0.4, done: 0 });
  }]]),
  breath: (B, b, g) => {
    const inst = g.fx.spawn("ice/frost-breath", b.x + b.face * 20, b.y - 58, { flip: b.face < 0, life: 1.8, seed: 2, memo: false });
    let tick = 0;
    b.move = { t: 0, dur: 2, fn: (dt) => {
      b.pose = { crouch: 4, lean: 4, fx: 14, fy: -30, bx: 10, by: -30, ffx: 7, fbx: -8 };
      inst.x = b.x + b.face * 20;
      if ((tick -= dt) <= 0) (tick = 0.25), g.combat.cone(b, b.face, 190, 0.4, Math.round(b.dmg * 0.4), "ice", "slowed");
    } };
  },
  // cinder tyrant
  smash: (B, b) => B.stroke(b, "melee/hammer-smash", 1.8),
  pillars: (B, b, g, h) => B.cast(b, 1.8, [0.2, 0.5, 0.8].map((t, i) => [t, () => B.area(b, "fire/flame-pillar", h.x + (i - 1) * 50, fy(g, h.x, h.y), { r: 16, h: 140, status: "burning", ticks: 4, every: 0.3 })])),
  meteors: (B, b, g, h) => B.cast(b, 2.4, [0.2, 0.7, 1.2, 1.7].map((t) => [t, () => {
    const x = h.x + (Math.random() - 0.5) * 120;
    B.area(b, "fire/meteor", x, fy(g, x, h.y), { r: 40, status: "burning", k: 1.3, shake: 3 });
  }])),
  ring: (B, b, g) => B.cast(b, 1.6, [[0.2, () => B.area(b, "fire/fire-ring", b.x, b.y, { r: 92, h: 30, status: "burning" })]]),
  firestorm: (B, b, g) => B.cast(b, 1, [[0.3, () => {
    for (const d of [-1, 1]) {
      const x = b.x + d * 80;
      g.fx.spawn("fire/fire-tornado", x, b.y, { life: 5, seed: 3 + d });
      g.combat.areas.push({ t: 0, x, y: b.y, src: b, r: 22, h: 90, dmg: Math.round(b.dmg * 0.45), el: "fire", status: "burning", ticks: 12, every: 0.4, done: 0 });
    }
  }]]),
  fbreath: (B, b, g) => {
    const inst = g.fx.spawn("fire/fire-breath", b.x + b.face * 20, b.y - 58, { flip: b.face < 0, life: 1.6, seed: 2, memo: false });
    let tick = 0;
    b.move = { t: 0, dur: 1.8, fn: (dt) => {
      b.pose = { crouch: 4, lean: 4, fx: 14, fy: -30, bx: 10, by: -30, ffx: 7, fbx: -8, weapon: "hammer", two: true, sa: -1.2 };
      inst.x = b.x + b.face * 20;
      if ((tick -= dt) <= 0) (tick = 0.25), g.combat.cone(b, b.face, 170, 0.4, Math.round(b.dmg * 0.4), "fire", "burning");
    } };
  },
  // the engine
  rocket: (B, b, g, h) => B.cast(b, 1.4, [[0.6, () => {
    g.fx.spawn("projectiles/muzzle-shotgun", b.x + b.face * 30, b.y, { flip: b.face < 0, height: 50, seed: 3 });
    g.combat.shoot({ kind: "rocket", x: b.x + b.face * 34, y: b.y - 52, vx: b.face, vy: 0.05, owner: "enemy", src: b, dmg: Math.round(b.dmg * 1.5), el: "fire" });
  }]], (t) => ({ crouch: 7, weapon: "launcher", two: true, fx: 6, fy: -27, sa: 0, ffx: 8, fbx: -8 })),
  missiles: (B, b, g, h) => B.cast(b, 1.6, [0.2, 0.6, 1].map((t, i) => [t, () => B.area(b, "projectiles/homing-missile", h.x + (i - 1) * 30, fy(g, h.x, h.y), { r: 34, flip: b.face > 0 })])),
  grid: (B, b, g, h) => B.cast(b, 1, [[0.3, () => {
    const x = h.x;
    g.fx.spawn("scifi/laser-grid", x, fy(g, x, h.y), { life: 5, seed: 2 });
    g.combat.areas.push({ t: -0.6, x, y: fy(g, x, h.y), src: b, r: 30, h: 70, dmg: Math.round(b.dmg * 0.5), el: "fire", ticks: 10, every: 0.45, done: 0 });
  }]]),
  emp: (B, b, g, h) => B.cast(b, 1.2, [[0.3, () => {
    B.area(b, "scifi/emp-blast", b.x, b.y - 10, { r: 70, h: 90, k: 0.8 });
    g.timers.push({ t: 0.5, fn: () => Math.abs(g.hero.x - b.x) < 75 && (g.status.apply(g.hero, "glitched"), g.fx.spawn("scifi/glitch", g.hero.x, g.hero.y, { actor: g.heroActor(), follow: g.hero, memo: false, life: 2.4, seed: 1 })) });
  }]]),
  discs: (B, b, g, h) => B.cast(b, 1.5, [0.2, 0.5, 0.8].map((t) => [t, () => {
    const ang = Math.atan2(h.cy - (b.y - 50), h.x - b.x) + (Math.random() - 0.5) * 0.3;
    g.combat.shoot({ kind: "disc", x: b.x, y: b.y - 50, vx: Math.cos(ang), vy: Math.sin(ang), owner: "enemy", src: b, dmg: Math.round(b.dmg * 0.8), el: "shock" });
  }])),
  chain: (B, b, g, h) => B.cast(b, 1.4, [[0.4, () => {
    g.fx.spawn("lightning/chain-lightning", b.x, b.y, { flip: b.face < 0, seed: 3, k: 2, memo: false });
    g.timers.push({ t: 0.1, fn: () => Math.abs(g.hero.x - b.x) < 300 && Math.sign(g.hero.x - b.x) === b.face && g.damageHero(Math.round(b.dmg * 0.9), { el: "shock", status: "shocked", src: b, dir: b.face }) });
  }]]),
  strikes: (B, b, g, h) => B.cast(b, 2, [0.1, 0.6, 1.1].map((t) => [t, () => B.area(b, "lightning/lightning-strike", h.x, fy(g, h.x, h.y), { r: 28, h: 300, status: "shocked" })])),
  // the watcher
  lasers: (B, b, g, h) => B.cast(b, 1.6, [0.2, 0.4, 0.6, 0.8, 1.0].map((t, i) => [t, () => {
    const ang = Math.atan2(h.cy - (b.y - 40), h.x - b.x) + (i - 2) * 0.12;
    g.combat.shoot({ kind: "laser", x: b.x, y: b.y - 40, vx: Math.cos(ang), vy: Math.sin(ang), owner: "enemy", src: b, dmg: Math.round(b.dmg * 0.7), el: "shadow" });
  }])),
  tendrils: (B, b, g, h) => B.cast(b, 1.4, [[0.2, () => B.area(b, "shadow/shadow-tendrils", h.x, fy(g, h.x, h.y), { r: 40, ticks: 3, every: 0.4, k: 0.6 })]]),
  hands: (B, b, g, h) => B.cast(b, 1.4, [[0.2, () => B.area(b, "shadow/grasping-hands", h.x, fy(g, h.x, h.y), { r: 42, status: "slowed", ticks: 2, every: 0.5, k: 0.7 })]]),
  skulls: (B, b, g) => B.cast(b, 1, [[0.2, () => {
    const inst = g.fx.spawn("shadow/necro-skulls", b.x, b.arena.y, { life: 6, seed: 3 });
    g.combat.areas.push({ t: 0, x: b.x, y: b.arena.y, src: b, r: 60, h: 100, dmg: Math.round(b.dmg * 0.35), el: "shadow", status: "cursed", ticks: 12, every: 0.5, done: 0 });
    void inst;
  }]]),
  voidorb: (B, b, g, h) => B.cast(b, 1.2, [[0.3, () => {
    const x = h.x;
    g.fx.spawn("shadow/void-orb", x, b.arena.y, { life: 4.5, seed: 2 });
    let k = 0;
    const pull = () => {
      if (k++ > 40) return;
      if (Math.abs(g.hero.x - x) < 140) g.hero.vx -= Math.sign(g.hero.x - x) * 30;
      if (Math.abs(g.hero.x - x) < 28 && Math.abs(g.hero.y - b.arena.y) < 60) g.damageHero(Math.round(b.dmg * 0.4), { el: "shadow", src: b, quiet: true });
      g.timers.push({ t: 0.1, fn: pull });
    };
    pull();
  }]]),
  darkstar: (B, b, g, h) => B.cast(b, 2, [[0.3, () => B.area(b, "shadow/dark-explosion", h.x, fy(g, h.x, h.y), { r: 56, h: 90, k: 1.6 })]]),
  pull: (B, b, g) => B.cast(b, 3, [[0.2, () => {
    g.fx.spawn("shadow/black-hole", b.x, b.arena.y - 10, { life: 2.6, seed: 4 });
    let k = 0;
    const pull = () => {
      if (k++ > 26) return;
      g.hero.vx -= Math.sign(g.hero.x - b.x) * 26;
      g.timers.push({ t: 0.1, fn: pull });
    };
    pull();
    g.combat.areas.push({ t: -2.6, x: b.x, y: b.arena.y, src: b, r: 50, h: 100, dmg: Math.round(b.dmg * 1.5), el: "shadow", ticks: 1, every: 1, done: 0 });
    g.timers.push({ t: 2.6, fn: () => g.fx.spawn("explosions/implosion", b.x, b.arena.y - 40, { seed: 2 }) });
  }]]),
  // the hollow king
  kcleave: (B, b) => B.stroke(b, b.phase > 2 ? "melee/spin-slash" : "melee/heavy-cleave", 1.7),
  pillar: (B, b, g, h) => B.cast(b, 1.6, [[0.3, () => B.area(b, "holy/holy-pillar", h.x, fy(g, h.x, h.y), { r: 28, h: 200, ticks: 5, every: 0.25, k: 0.5, opts: { palette: b.phase > 2 ? PAL.shadow : PAL.holy } })]]),
  stars: (B, b, g, h) => B.cast(b, 2, [[0.3, () => B.area(b, "arcane/star-fall", h.x, fy(g, h.x, h.y), { r: 52, ticks: 6, every: 0.2, k: 0.5 })]]),
  smite: (B, b, g, h) => B.cast(b, 1.2, [[0.2, () => B.area(b, "holy/smite", h.x, fy(g, h.x, h.y), { r: 34, k: 1.3 })]]),
  timestop: (B, b, g, h) => B.cast(b, 2.6, [[0.2, () => {
    g.fx.spawn("arcane/time-stop", h.x, h.y, { seed: 2 });
    g.timers.push({ t: 0.6, fn: () => g.status.apply(g.hero, "slowed", { dur: 3 }) });
  }], [1.4, () => B.area(b, "shadow/dark-explosion", h.x, fy(g, h.x, h.y), { r: 56, h: 90, k: 1.4 })]]),
  summon: (B, b, g) => B.cast(b, 1.6, [[0.3, () => {
    for (const d of [-1, 1]) {
      g.fx.spawn("spawn/summon-rise", b.x + d * 70, b.y, { seed: 5 + d });
      g.timers.push({ t: 2.3, fn: () => (g.addEnemy("skeleton", b.x + d * 70, b.y, 18).aggro = true) });
    }
  }], [1, () => b.phase > 2 && b.hp < b.maxHp * 0.35 && !b.nuked && ((b.nuked = true), B.area(b, "explosions/nuke", b.x, b.y, { r: 400, h: 300, k: 3.5, at: 0.1 }), g.toast("DASH THROUGH THE LIGHT!", "#ffffff"))]]),
};
export { MOVES };
