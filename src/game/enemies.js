// Enemies: critters drawn from pixelfx critter loops (their own clock, so a slime moves only while it's in the air),
// and humanoids on the dressed skeleton who fight with the melee acts. Each AI is small: notice, close in, telegraph,
// strike, recover.

import { FX, poseAt, clamp, PAL, hex } from "../pfx.js";
import { ENEMIES, COSTUME_SPECS } from "../data/enemies.js";
import { move, sight } from "./physics.js";
import { memoOf, memoBounds, blitMemo, actorOfMemo } from "../engine/fxman.js";
import { costume, drawRig, actorOf } from "./rigdraw.js";
import { strokeOf } from "./hero.js";
import * as POSE from "./poses.js";
import { WEAPONS } from "../data/weapons.js";

const costumes = {};
export const costumeFor = (id) => (costumes[id] ??= costume({ id: "c:" + id, ...COSTUME_SPECS[id] }));

let seq = 1;
export class Enemy {
  constructor(g, type, x, y, level, opts = {}) {
    const d = ENEMIES[type];
    this.g = g;
    this.type = type;
    this.def = d;
    this.uid = seq++;
    this.level = level;
    this.x = x;
    this.y = y;
    this.home = { x, y };
    this.vx = 0;
    this.vy = 0;
    this.face = opts.face ?? (Math.random() < 0.5 ? -1 : 1);
    this.t = Math.random() * 10;
    this.clock = Math.random() * 3;
    this.maxHp = Math.round(d.hp * (18 + level * 10));
    this.hp = this.maxHp;
    this.dmg = Math.round(d.dmg * (4 + level * 2.3));
    this.xp = Math.round(d.xp * (5 + level * 4));
    this.state = "idle";
    this.aggro = false;
    this.cool = 1 + Math.random();
    this.contactCd = 0;
    this.flash = 0;
    this.st = null;
    this.immune = d.immune;
    this.spawner = opts.spawner ?? null;
    this.critter = !d.rig;
    this.fly = !!d.fly;
    this.swim = !!d.swim;
    this.step = true;
    this.onGround = false;
    if (d.rig) {
      this.costume = costumeFor(d.costume);
      this.w = 10;
      this.h = 34;
      this.weapon = WEAPONS[d.weapon];
      this.pose = POSE.idle(0, this.weapon);
      this.speed = 52 * (d.speed ?? 1);
    } else {
      this.memo = memoOf(d.fx, d.opts ?? {}, false);
      this.memoF = memoOf(d.fx, d.opts ?? {}, true);
      const b = memoBounds(this.memo);
      this.box = b;
      this.w = Math.max(8, Math.round((b.x1 - b.x0) * 0.6));
      this.h = Math.max(8, Math.round((b.y1 - b.y0) * 0.75));
      // sit the drawing so its lowest pixel is at the feet
      this.oy = -b.y1;
      this.ox = -(b.x0 + b.x1) / 2;
      this.speed = 40;
    }
  }
  get cx() {
    return this.x;
  }
  get cy() {
    return this.y - this.h / 2;
  }
  /** The body, for status effects. */
  actor() {
    if (this.def.rig) return actorOf(this.pose, this.costume);
    const m = this.face < 0 ? this.memoF : this.memo;
    return actorOfMemo(m, this.clock);
  }
  get frozen() {
    const S = this.g.status;
    return S.has(this, "frozen") || S.has(this, "petrified") || S.has(this, "stunned") || S.has(this, "sleep") || this.g.timeStop > 0;
  }
  update(dt) {
    const g = this.g, h = g.hero;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.contactCd > 0) this.contactCd -= dt;
    g.status.update(this, dt);
    if (this.dead) return;
    if (this.frozen) {
      if (!this.fly) {
        this.vy = Math.min(400, this.vy + 900 * dt);
        this.vx *= 0.8;
        move(this, g.world, dt);
      }
      return;
    }
    const slow = g.status.has(this, "slowed") ? 0.5 : 1;
    this.clock += dt * slow;
    if (this.cool > 0) this.cool -= dt * slow;
    const dx = h.x - this.x, dy = h.cy - this.cy, dist = Math.hypot(dx, dy);
    // noticing the hero
    if (!this.aggro && !this.def.passive && !h.dead && dist < 170 && (this.def.phase || sight(g.world, this.x, this.cy, h.x, h.cy)) && !g.status.has(h, "hidden")) {
      this.aggro = true;
      if (this.def.rig || dist > 60) g.fx.spawn("ui/exclamation", this.x, this.y - this.h - 2, { follow: this, dy: -this.h + 34, seed: this.uid, light: 0.5 });
    }
    if (this.aggro && (dist > 420 || h.dead || g.status.has(h, "hidden"))) this.aggro = false;
    if (g.status.has(this, "charmed")) this.aggro = false;
    const confused = g.status.has(this, "confused");
    const want = this.aggro ? Math.sign(dx) * (confused ? -1 : 1) : 0;
    AI[this.def.ai](this, dt * slow, { dx, dy, dist, want, h });
    // contact damage
    if (this.aggro && this.contactCd <= 0 && this.def.dmg > 0 && !this.def.rig && overlap(this, h, 0.7)) {
      this.contactCd = 0.9;
      g.combat.enemyHitsHero(this, this.dmg, { el: this.def.el, status: this.def.onHit, dir: Math.sign(dx) || 1 });
    }
  }
  draw(screen) {
    const g = this.g;
    if (g.status.hidesBody(this)) return;
    const flash = this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0;
    const tint = this.st?.frozen ? [hex("#9bdcff"), 0.45] : this.st?.petrified ? [hex("#9a9aa8"), 0.7] : this.st?.charmed ? [hex("#ff86e6"), 0.25] : this.st?.cursed ? [hex("#6a3a9a"), 0.25] : null;
    if (this.def.rig) {
      drawRig(screen.act, this.pose, this.costume, this.x + (this.jitter ?? 0), this.y, { flip: this.face < 0, flash, tint });
    } else {
      const m = this.face < 0 ? this.memoF : this.memo, ox = this.face < 0 ? -this.ox : this.ox;
      blitMemo(screen, m, this.clock, this.x + ox, this.y + this.oy, { layer: this.def.glow ? "world" : "act", flash, tint, alpha: this.alpha ?? 1 });
    }
  }
}

export const overlap = (a, b, k = 1) => Math.abs(a.x - b.x) < ((a.w + b.w) / 2) * k && Math.abs(a.cy - b.cy) < ((a.h + b.h) / 2) * k;

function walk(e, dt, dir, speed, g) {
  e.vx += (dir * speed - e.vx) * Math.min(1, 8 * dt);
  if (!e.fly) e.vy = Math.min(420, e.vy + 950 * dt);
  move(e, g.world, dt);
  // don't walk off cliffs or into lava when nobody's chasing
  if (e.onGround && dir) {
    const ahead = e.x + dir * (e.w / 2 + 4);
    if (g.world.floorBelow(ahead, e.y) - e.y > 40 || g.world.liquid(ahead, e.y + 4)) {
      if (!e.aggro) e.face = -e.face;
      e.vx = 0;
    }
  }
  if (e.hitWall && e.onGround && e.aggro) e.vy = -260;
}
function fly(e, dt, tx, ty, speed, g, phase = false) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.vx += ((dx / d) * speed - e.vx) * Math.min(1, 3 * dt);
  e.vy += ((dy / d) * speed - e.vy) * Math.min(1, 3 * dt);
  if (phase) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  } else move(e, g.world, dt);
  if (Math.abs(e.vx) > 5) e.face = Math.sign(e.vx);
}

// ---- the AIs
const AI = {
  // slimes: wind up, leap, land; they only travel while airborne (the critter's own hop is drawn)
  hopper(e, dt, { want, dist, h }) {
    const g = e.g, D = 1.8, ph = e.clock % D;
    const inAir = ph >= 0.9 && ph < 1.44;
    if (want) e.face = want;
    const dir = e.aggro ? e.face : e.wander ?? (e.wander = Math.random() < 0.5 ? -1 : 1);
    e.vx = inAir ? dir * (e.aggro ? 78 : 30) : 0;
    e.vy = Math.min(420, e.vy + 950 * dt);
    move(e, g.world, dt);
    if (e.hitWall) e.wander = -dir;
    if (!inAir && ph > 1.44 && ph < 1.44 + dt * 1.5) {
      g.dust(e.x, e.y, 2);
      if (e.def.spitTrail) g.fx.spawn("nature/toxic-puddle", e.x, e.y + 4, { life: 2 });
    }
    void dist;
    void h;
  },
  bat(e, dt, { dx, dy, dist, h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.7) * 40, e.home.y + Math.cos(e.t * 1.3) * 12, 40, g);
    e.dive ??= 0;
    if (e.dive > 0) {
      e.dive -= dt;
      fly(e, dt, h.x, h.cy + 6, 190, g);
    } else {
      fly(e, dt, h.x - Math.sign(dx) * 50, h.y - 70 + Math.sin(e.t * 3) * 10, 90, g);
      if (e.cool <= 0 && dist < 120) {
        e.dive = 0.7;
        e.cool = 2 + Math.random();
        g.sfx("screech");
      }
    }
    void dy;
  },
  crawler(e, dt, { want, dist }) {
    const g = e.g;
    if (want) e.face = want;
    const lunge = e.lunge > 0 ? (e.lunge -= dt) : 0;
    walk(e, dt, e.aggro ? e.face : 0, lunge > 0 ? 150 : e.aggro ? 38 : 0, g);
    if (e.aggro && dist < 60 && e.cool <= 0) {
      e.lunge = 0.3;
      e.cool = 1.6;
      g.sfx("hiss");
    }
  },
  frog(e, dt, { want, dist, h }) {
    const g = e.g;
    if (want) e.face = want;
    e.vx = 0;
    e.vy = Math.min(420, e.vy + 950 * dt);
    move(e, g.world, dt);
    if (e.def.spit && e.aggro && e.cool <= 0 && dist < 150) {
      e.cool = 2.6;
      g.combat.areaAttack(e, "nature/acid-splash", h.x, g.world.floorBelow(h.x, h.y - 10), { r: 22, dmg: e.dmg, el: "poison", status: "poisoned", delay: 0 });
    }
  },
  wisp(e, dt, { dx, dist, h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.5) * 50, e.home.y - 20 + Math.sin(e.t * 1.7) * 10, 30, g);
    fly(e, dt, h.x - Math.sign(dx) * 90, h.y - 40 + Math.sin(e.t * 2) * 14, 70, g);
    if (e.cool <= 0 && dist < 200) {
      e.cool = 2.4 + Math.random();
      g.combat.enemyShoot(e, e.def.spell ?? "arcane", h);
    }
  },
  ghost(e, dt, { h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.4) * 60, e.home.y - 10, 20, g, true);
    fly(e, dt, h.x, h.cy, 46, g, true);
    e.alpha = 0.55 + 0.35 * Math.sin(e.t * 3);
  },
  skull(e, dt, { dx, dist, h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.6) * 40, e.home.y - 30, 30, g);
    fly(e, dt, h.x - Math.sign(dx) * 110, h.y - 50 + Math.sin(e.t * 2.2) * 16, 60, g);
    if (e.cool <= 0 && dist < 220) {
      e.cool = 2.2 + Math.random();
      g.combat.enemyShoot(e, e.def.spell ?? "fire", h);
    }
  },
  imp(e, dt, { dx, dist, h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.6) * 40, e.home.y - 30, 30, g);
    if (e.breath > 0) {
      e.breath -= dt;
      e.vx *= 0.9;
      e.vy *= 0.9;
      move(e, g.world, dt);
      if ((e.breathTick = (e.breathTick ?? 0) - dt) <= 0) {
        e.breathTick = 0.25;
        g.combat.cone(e, e.face, 90, 0.35, Math.round(e.dmg * 0.35), "fire", "burning");
      }
      return;
    }
    fly(e, dt, h.x - Math.sign(dx) * 60, h.y - 26, 80, g);
    if (e.cool <= 0 && dist < 100) {
      e.cool = 3.4;
      e.breath = 1.3;
      e.face = Math.sign(dx) || 1;
      e.breathFx = g.fx.spawn("fire/fire-breath", e.x + e.face * 6, e.y - e.h / 2, { follow: e, dx: e.face * 6, dy: -e.h / 2, flip: e.face < 0, life: 1.2, light: 0.8 });
      g.sfx("breath");
    }
  },
  jelly(e, dt, { h, dist }) {
    const g = e.g, inWater = g.world.liquid(e.x, e.y - 4);
    if (!inWater) {
      e.vy = Math.min(300, e.vy + 600 * dt);
      move(e, g.world, dt);
      return;
    }
    if (e.aggro && g.world.liquid(h.x, h.cy)) fly(e, dt, h.x, h.cy + 10, 34, g);
    else fly(e, dt, e.home.x + Math.sin(e.t * 0.3) * 40, e.home.y + Math.sin(e.t * 0.9) * 14, 14, g);
    if (!g.world.liquid(e.x, e.y - e.h)) e.vy = Math.max(e.vy, 20);
    void dist;
  },
  flutter(e, dt) {
    const g = e.g;
    fly(e, dt, e.home.x + Math.sin(e.t * 0.31 + e.uid) * 90, e.home.y + Math.sin(e.t * 0.8 + e.uid) * 20, 28, g, true);
    // startled by the hero: away and up
    if (Math.abs(g.hero.x - e.x) < 40 && Math.abs(g.hero.cy - e.cy) < 50) (e.home.y -= 30 * dt), (e.home.x += Math.sign(e.x - g.hero.x) * 40 * dt);
  },
  fish(e, dt) {
    const g = e.g;
    fly(e, dt, e.home.x + Math.sin(e.t * 0.25) * 70, e.home.y + Math.sin(e.t * 0.7) * 8, 26, g);
    if (!g.world.liquid(e.x, e.y - 4)) e.vy = 30;
  },
  turret(e, dt, { dx, dist, h }) {
    const g = e.g;
    if (!e.aggro) return fly(e, dt, e.home.x + Math.sin(e.t * 0.4) * 30, e.home.y - 30 + Math.sin(e.t) * 6, 20, g);
    fly(e, dt, h.x - Math.sign(dx) * 130, h.y - 46 + Math.sin(e.t * 1.6) * 10, 45, g);
    e.face = Math.sign(dx) || 1;
    if (e.cool <= 0 && dist < 240 && sight(g.world, e.x, e.cy, h.x, h.cy)) {
      e.cool = 1.8 + Math.random();
      g.combat.enemyShoot(e, e.def.shot, h);
    }
  },
  drone(e, dt, { dx, dist, h }) {
    AI.turret(e, dt, { dx, dist, h });
  },
  // ---- humanoids
  melee(e, dt, ctx) {
    rigFight(e, dt, ctx, false);
  },
  caster(e, dt, ctx) {
    rigFight(e, dt, ctx, true);
  },
  ranged(e, dt, { dx, dist, h, want }) {
    const g = e.g;
    if (e.atk) return rigAttackUpdate(e, dt);
    if (want) e.face = want;
    let dir = 0;
    if (e.aggro) {
      if (dist < 80) dir = -Math.sign(dx);
      else if (dist > 190) dir = Math.sign(dx);
    } else dir = patrol(e, dt);
    walk(e, dt, dir, e.speed * (e.aggro ? 1 : 0.5), g);
    e.pose = Math.abs(e.vx) > 8 ? POSE.run((e.t * 1.6) % 1, e.weapon, 0.6) : POSE.idle(e.t, e.aggro ? e.weapon : null);
    if (e.aggro && e.cool <= 0 && dist < 230 && sight(g.world, e.x, e.y - 24, h.x, h.cy)) {
      e.cool = e.def.shot === "rocket" ? 3.5 : 1.7 + Math.random();
      if (e.def.grenade && Math.random() < 0.45) g.combat.enemyGrenade(e, h);
      else g.combat.enemyShoot(e, e.def.shot, h);
    }
  },
};

function patrol(e, dt) {
  e.pt = (e.pt ?? 0) - dt;
  if (e.pt <= 0) {
    e.pt = 1.5 + Math.random() * 2.5;
    e.pdir = Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? -1 : 1;
    if (Math.abs(e.x - e.home.x) > 80) e.pdir = Math.sign(e.home.x - e.x);
  }
  if (e.pdir) e.face = e.pdir;
  return e.pdir;
}

function rigFight(e, dt, { dx, dist, h, want }, caster) {
  const g = e.g;
  if (e.atk) return rigAttackUpdate(e, dt);
  if (e.blockT > 0) {
    e.blockT -= dt;
    e.vx *= 0.8;
    move(e, g.world, dt);
    return;
  }
  if (want) e.face = want;
  const id = e.def.attacks[(e.combo ?? 0) % e.def.attacks.length], s = strokeOf(id, 0.75), reach = s.reach * 0.8;
  let dir = 0;
  if (e.aggro) dir = Math.abs(dx) > reach * 0.7 ? Math.sign(dx) : 0;
  else dir = patrol(e, dt);
  if (caster && e.aggro && dist > 70 && e.cool <= 0) {
    e.cool = 3 + Math.random() * 1.5;
    return g.combat.enemySpell(e, e.def.spell, h);
  }
  walk(e, dt, dir, e.speed * (e.aggro ? 1 : 0.45), g);
  if (Math.abs(e.vx) > 6) e.pose = POSE.run((e.t * 1.7) % 1, e.weapon, 0.7);
  else e.pose = POSE.idle(e.t, e.aggro ? e.weapon : null);
  if (e.aggro && e.cool <= 0 && Math.abs(dx) < reach && Math.abs(h.y - e.y) < 30) {
    e.combo = (e.combo ?? 0) + 1;
    e.atk = { s, u: 0, spawned: false, hit: 0, ox: e.x - e.face * s.x0 };
    e.cool = (e.def.heavy ? 2.2 : 1.4) + Math.random() * 0.8;
  }
  // an escape: bandits vanish in smoke when they're nearly done for
  if (e.def.escape && e.hp < e.maxHp * 0.3 && !e.fled) {
    e.fled = true;
    g.fx.spawn("explosions/smoke-bomb", e.x, e.y, { seed: e.uid });
    e.aggro = false;
    e.x += -Math.sign(dx) * 70;
  }
}
// an enemy's stroke: the act's wind-up is played slower than the hero's, so it can be read and dodged
function rigAttackUpdate(e, dt) {
  const g = e.g, a = e.atk, s = a.s, h = g.hero;
  a.u += dt;
  const W = 0.75, windGame = -s.first * W, t = a.u < windGame ? s.first + a.u / W : a.u - windGame;
  if (!a.spawned && t >= 0) {
    a.spawned = true;
    const pal = e.def.pal ? PAL[e.def.pal] : PAL.blood;
    g.fx.spawn(s.id, a.ox, e.y, { flip: e.face < 0, seed: e.uid * 7 + (e.combo ?? 0), palette: pal });
    g.sfx("swing", { heavy: e.def.heavy, enemy: true });
  }
  while (a.hit < s.hits.length && t >= s.hits[a.hit].t) {
    const hit = s.hits[a.hit++];
    const x0 = s.around ? e.x - s.reach : e.face > 0 ? e.x - 6 : e.x - s.reach, x1 = s.around ? e.x + s.reach : e.face > 0 ? e.x + s.reach : e.x + 6;
    if (h.x + h.w / 2 > x0 && h.x - h.w / 2 < x1 && h.y > e.y - 60 && h.y - h.h < e.y + 6)
      g.combat.enemyHitsHero(e, Math.round(e.dmg * (s.hits.length > 3 ? 0.35 : 1)), { el: e.def.el, status: e.def.onHit, dir: e.face, stop: hit.stop * 0.6, shake: hit.shake * 0.7, amp: hit.amp });
  }
  const pose = poseAt(s.poses, Math.min(t, s.end));
  const wantX = a.ox + e.face * (pose.x ?? 0);
  e.vx = clamp((wantX - e.x) / dt, -200, 200);
  e.vy = Math.min(420, e.vy + 950 * dt);
  move(e, g.world, dt);
  e.pose = { ...pose, x: 0, y: 0 };
  if (t >= Math.min(s.end, s.last + 0.5)) e.atk = null;
}
