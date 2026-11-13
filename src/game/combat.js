// Combat: damage, crits, elements, hit-stop and shake from the acts, numbers, impacts, projectiles that carry
// pixelfx loops, deaths that match how you died, and loot.

import { PAL, FX, hex } from "../pfx.js";
import { overlap } from "./enemies.js";
import { ELEMENTS, RARITY } from "../data/items.js";
import { HIT } from "../data/fxtimes.js";
import { TS, SOLID_T } from "../world/tiles.js";

// what a kill looks like, by the element that did it
const DEATH_BY_EL = { fire: "spawn/dissolve-burn", ice: "spawn/shatter-death", shock: "spawn/disintegrate", shadow: "spawn/soul-rise", holy: "spawn/disintegrate", arcane: "spawn/disintegrate" };
// projectiles: the loop that flies, what it does when it lands
const SHOTS = {
  arrow: { fx: "projectiles/arrow", speed: 330, grav: 260, hit: "impacts/hit-spark", rotate: true, r: 5 },
  bullet: { fx: "projectiles/bullet-tracer", speed: 520, hit: "impacts/bullet-impact", wall: "impacts/ricochet", r: 4, muzzle: "projectiles/muzzle-pistol" },
  shot: { fx: "projectiles/bullet-tracer", speed: 480, hit: "impacts/hit-spark", r: 4, muzzle: "projectiles/muzzle-shotgun", spread: 5 },
  smg: { fx: "projectiles/bullet-tracer", speed: 520, hit: "impacts/hit-spark", r: 3, muzzle: "projectiles/muzzle-smg" },
  rocket: { fx: "projectiles/rocket", speed: 190, accel: 220, hit: "explosions/small-explosion", splash: 40, r: 6 },
  laser: { fx: "projectiles/laser-bolt", speed: 260, hit: "lightning/zap-hit", r: 4 },
  plasma: { fx: "projectiles/plasma-shot", speed: 170, hit: "explosions/plasma-explosion", splash: 26, r: 6 },
  disc: { fx: "projectiles/energy-disc", speed: 210, hit: "lightning/zap-hit", r: 7, el: "shock", pierce: true },
  missile: { fx: "projectiles/plasma-shot", speed: 150, home: 2.2, hit: "pickups/collect-burst", r: 5, opts: { palette: PAL.arcane }, el: "arcane" },
  arcane: { fx: "projectiles/plasma-shot", speed: 150, home: 1.6, hit: "arcane/mana-burst", r: 5, opts: { palette: PAL.arcane }, el: "arcane" },
  fire: { fx: "fire/fireball", speed: 170, hit: "explosions/small-explosion", splash: 30, r: 6, el: "fire", status: "burning" },
  ice: { fx: "ice/ice-lance", speed: 230, hit: "ice/ice-shatter", r: 5, el: "ice", status: "slowed" },
  holy: { fx: "projectiles/plasma-shot", speed: 170, home: 1.2, hit: "holy/smite", r: 6, opts: { palette: PAL.holy }, el: "holy" },
  necro: { fx: "projectiles/plasma-shot", speed: 150, home: 1.5, hit: "shadow/dark-explosion", r: 6, opts: { palette: PAL.matrix }, el: "shadow", status: "cursed" },
  heroBolt: { fx: "projectiles/magic-missile", oneshot: true },
};
export { SHOTS };

export class Combat {
  constructor(g) {
    this.g = g;
    this.shots = [];
    this.areas = [];
  }
  // ---- the hero's blows
  heroStroke(hero, s, hit, last) {
    const g = this.g, S = g.rpg.stats, W = hero.weapon, reach = s.reach * (W.reach ?? 1);
    const x0 = s.around ? hero.x - reach : hero.face > 0 ? hero.x - 8 : hero.x - reach, x1 = s.around ? hero.x + reach : hero.face > 0 ? hero.x + reach : hero.x + 8;
    const box = { x0, x1, y0: hero.y - 64, y1: hero.y + 8 };
    let n = 0;
    const multi = s.hits.length > 3 ? 0.4 : s.hits.length > 1 && !last ? 0.6 : 1;
    for (const e of this.targets(box)) {
      n++;
      const crit = Math.random() < S.crit, el = g.rpg.equip.weapon?.el ?? W.el;
      let dmg = S.atk * multi * (0.9 + Math.random() * 0.2);
      if (crit) dmg *= 1.8;
      this.damageEnemy(e, Math.round(dmg), { el, crit, dir: hero.face, push: hit.push, src: "hero", status: el && Math.random() < 0.25 ? ELEMENTS[el].status : null, heavy: hit.stop > 0.15 });
    }
    // breakables: barrels
    g.ents.hitBox(box, hero);
    if (n) {
      g.freeze(hit.stop * (n > 2 ? 1.1 : 0.85));
      g.shake(hit.amp || 1.5, hit.shake || 0.12);
      g.combo(n);
    }
    return n;
  }
  heroAura(a) {
    const g = this.g, h = g.hero;
    for (const e of this.targets({ x0: h.x - a.r, x1: h.x + a.r, y0: h.y - a.r - 20, y1: h.y + 10 })) this.damageEnemy(e, Math.round(g.rpg.stats.spell * a.k), { el: a.el, src: "hero", dir: Math.sign(e.x - h.x) });
  }
  heroRanged(hero, W) {
    const g = this.g;
    hero.state = "cast";
    hero.armed = 2.5;
    const kind = W.ranged, rate = 1 / (W.spd * g.rpg.stats.aspd);
    const fire = () => {
      const y = hero.y - 22, x = hero.x + hero.face * 14;
      const S = SHOTS[kind];
      const dmg = Math.round(g.rpg.stats.atk * (0.9 + Math.random() * 0.2));
      if (S.muzzle && kind !== "smg") g.fx.spawn(S.muzzle, x, hero.y, { flip: hero.face < 0, height: 22, seed: (g.time * 100) | 0 });
      const el = g.rpg.equip.weapon?.el;
      const n = kind === "shot" ? 5 : 1;
      for (let i = 0; i < n; i++) {
        const ang = (kind === "shot" ? (i - 2) * 0.09 : 0) + (kind === "arrow" ? -0.06 : 0);
        this.shoot({ kind, x, y, dir: hero.face, ang, owner: "hero", dmg: kind === "shot" ? Math.round(dmg * 0.55) : dmg, el, opts: el && kind !== "rocket" ? { palette: ELEMENTS[el].pal } : {} });
      }
      g.sfx(kind === "arrow" ? "bow" : kind === "rocket" ? "rocket" : "gun", { kind });
      if (kind === "rocket") hero.vx -= hero.face * 120;
    };
    const pose = (t) => {
      const base = { crouch: 3, ffx: 7, fbx: -7, lean: 1 };
      if (kind === "arrow") return { ...base, weapon: "bow", fx: 13, fy: -24, sa: 0, bx: t < 0.18 ? 2 : -1, by: -24, pull: true, nocked: t < 0.2, turn: 0.4 };
      if (kind === "rocket") return { ...base, crouch: 6, weapon: "launcher", two: true, fx: 6, fy: -27, sa: 0 };
      const kick = t > 0.02 && t < 0.1 ? -0.35 : 0;
      return { ...base, weapon: "pistol", fx: 15, fy: -23, sa: kick, bx: 6, by: -20 };
    };
    if (kind === "smg") {
      // hold to keep firing: the muzzle loop rides the barrel
      let acc = 0;
      const muzzle = g.fx.spawn("projectiles/muzzle-smg", hero.x + hero.face * 14, hero.y, { follow: hero, dx: hero.face * 14, flip: hero.face < 0, height: 22, memo: false });
      hero.cast = { t: 0, dur: 99, channel: true, slot: -1, pose: () => pose(0.05), update: (dt) => {
        acc += dt;
        while (acc >= rate) (acc -= rate), fire();
        if (!g.input.down.attack) hero.cast.dur = 0;
      }, end_: () => g.fx.stop(muzzle) };
      return;
    }
    hero.cast = { t: 0, dur: Math.max(0.28, rate * 0.9), pose, interruptible: true };
    setTimeout0(g, W.wind * 0.6, fire);
  }
  // ---- every hittable thing in a box
  targets(box) {
    const out = [];
    for (const e of this.g.enemies) {
      if (e.dead || e.def.ambient && !e.def.dmg) continue;
      if (e.x + e.w / 2 > box.x0 && e.x - e.w / 2 < box.x1 && e.y > box.y0 && e.y - e.h < box.y1) out.push(e);
    }
    if (this.g.boss && !this.g.boss.dead && this.g.boss.active) {
      const b = this.g.boss;
      if (b.x + b.w / 2 > box.x0 && b.x - b.w / 2 < box.x1 && b.y > box.y0 && b.y - b.h < box.y1) out.push(b);
    }
    return out;
  }
  // ---- damage to enemies (and bosses)
  damageEnemy(e, dmg, o = {}) {
    const g = this.g;
    if (e.dead || e.invuln) return 0;
    if (e.def?.block && !o.dot && o.dir && Math.sign(g.hero.x - e.x) === e.face && Math.random() < 0.3 && !e.atk) {
      e.blockT = 0.4;
      g.fx.spawn("impacts/shield-block", e.x, e.y, { flip: e.face < 0, seed: e.uid, palette: PAL.ice });
      g.sfx("block");
      dmg = Math.round(dmg * 0.2);
    }
    if (g.status.has(e, "cursed")) dmg = Math.round(dmg * 1.35);
    if (e.resist?.[o.el]) dmg = Math.round(dmg * (1 - e.resist[o.el]));
    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.flash = 0.12;
    if (!o.dot) {
      e.aggro = true;
      g.status.onHit(e);
      const px = e.x - (o.dir ?? 0) * e.w * 0.3, py = e.cy;
      if (o.crit) g.fx.spawn("impacts/crit-hit", px, py + 12, { flip: (o.dir ?? 1) < 0, seed: (g.time * 97) | 0, height: 12 });
      else if (o.heavy) g.fx.spawn("impacts/blunt-hit", px, py + 12, { seed: (g.time * 97) | 0, height: 12 });
      else if (o.el === "shock") g.fx.spawn("lightning/zap-hit", px, py, { flip: (o.dir ?? 1) < 0, seed: (g.time * 97) | 0 });
      else if (o.el === "ice") g.fx.spawn("ice/snowflake-burst", px, py + 14, { seed: (g.time * 97) | 0, count: 4 });
      else g.fx.spawn("impacts/hit-spark", px, py + 12, { flip: (o.dir ?? 1) < 0, seed: (g.time * 97) | 0, height: 12, ...(o.el ? { palette: ELEMENTS[o.el]?.pal?.slice(0, 7) } : {}) });
      // knockback
      if (!e.boss && !e.def?.heavy) {
        e.vx += (o.dir ?? 0) * 90 * (o.push ?? 1);
        if (!e.fly) e.vy = Math.min(e.vy, -60 * (o.push ?? 1));
      }
      if (o.leech !== false && g.rpg.stats.leech && o.src === "hero") g.rpg.heal(dmg * g.rpg.stats.leech);
      g.sfx(o.crit ? "crit" : "hit", { el: o.el });
    }
    if (o.status && !e.dead) g.status.apply(e, o.status, { src: "hero" });
    this.number(e, dmg, o);
    if (e.boss) g.bosses.onDamage(e, dmg, o);
    if (e.hp <= 0) this.kill(e, o);
    return dmg;
  }
  number(e, dmg, o) {
    const g = this.g;
    if (o.crit) g.fx.spawn("ui/crit-number", e.x, e.y - e.h - 6, { text: dmg + "!", label: "CRIT", seed: dmg, light: 0.7 });
    else g.number(e.x + (Math.random() - 0.5) * 10, e.y - e.h, "-" + dmg, o.dot ? "dot" : o.el ?? "hit", o.el ? ELEMENTS[o.el]?.color : null);
  }
  kill(e, o = {}) {
    const g = this.g;
    if (e.dead) return;
    e.dead = true;
    g.status.clearAll(e);
    if (e.boss) return g.bosses.onKill(e, o);
    // the death that fits the blow
    const byEl = e.def.rig ? DEATH_BY_EL[o.el] ?? e.def.death : e.def.death;
    const deathFx = FX[byEl]?.meta.actor ? byEl : byEl;
    if (FX[deathFx].meta.actor) g.fx.spawn(deathFx, e.x, e.y, { actor: e.actor(), flip: e.face < 0 && e.def.rig, seed: e.uid, memo: false });
    else g.fx.spawn(deathFx, e.x, e.y - (deathFx.startsWith("explosions") ? 0 : 0), { seed: e.uid, light: 0.8 });
    g.sfx("die", { big: e.def.heavy });
    g.rpg.gainXp(e.xp);
    g.rpg.kills[e.type] = (g.rpg.kills[e.type] ?? 0) + 1;
    g.quests.onKill(e);
    // loot: coins burst out, sometimes something better
    if (!e.def.ambient) {
      const luck = e.def.rig ? 0.15 : 0;
      if (Math.random() < 0.55) g.ents.dropGold(e.x, e.y, Math.round((2 + e.level * 2) * (0.7 + Math.random() * 0.6) * g.rpg.stats.gold));
      if (Math.random() < 0.16 + luck) g.ents.dropLoot(e.x, e.y, g.rpg.rollLoot(e.level, luck));
      if (Math.random() < 0.08) g.ents.drop(e.x, e.y, "heart");
      if (e.def.drop && Math.random() < 0.5) g.ents.drop(e.x, e.y, e.def.drop);
      g.ents.dropXp(e.x, e.y - e.h / 2, Math.min(8, 1 + Math.floor(e.xp / 12)));
    }
  }
  // ---- damage to the hero
  enemyHitsHero(src, dmg, o = {}) {
    const g = this.g, h = g.hero;
    // a parry: the hero's own stroke meets the blow at the same moment
    const a = h.attack;
    if (src?.def?.rig && h.state === "attack" && a && Math.sign(src.x - h.x) === h.face) {
      const s = a.s, wind = -s.first * s.wind, t = a.u < wind ? -1 : a.u - wind;
      if (s.hits.some((x) => Math.abs(t - x.t) < 0.12)) {
        g.fx.spawn("impacts/parry", (h.x + src.x) / 2, h.y, { seed: (g.time * 10) | 0, height: 26 });
        g.status.apply(src, "stunned", { dur: 1.6 });
        src.atk = null;
        g.freeze(0.16);
        g.shake(3, 0.25);
        g.sfx("block");
        g.toast("PARRY!", "#ffe066");
        return 0;
      }
    }
    return g.damageHero(dmg, { ...o, src });
  }
  /** A cone in front of e (a breath): angle half-width in radians. */
  cone(e, dir, len, half, dmg, el, status) {
    const h = this.g.hero, dx = h.x - e.x, dy = h.cy - e.cy;
    if (Math.sign(dx) !== dir || Math.hypot(dx, dy) > len) return;
    if (Math.abs(Math.atan2(dy, Math.abs(dx))) > half) return;
    this.enemyHitsHero(e, dmg, { el, status, dir, quiet: false });
  }
  /** Play an effect at (x, y) and hurt whoever is within r of it when it lands. */
  areaAttack(src, fxId, x, y, o) {
    const g = this.g;
    g.fx.spawn(fxId, x, y, { seed: (g.time * 31) | 0, flip: o.flip, ...(o.opts ?? {}) });
    this.areas.push({ t: -(o.delay ?? 0) - (o.at ?? HIT[fxId] ?? 0.3), x, y, src, ...o, ticks: o.ticks ?? 1, every: o.every ?? 0.3, done: 0 });
  }
  enemyShoot(e, kind, h) {
    const g = this.g, S = SHOTS[kind];
    if (!S) return;
    const x = e.x + e.face * 8, y = e.def?.rig ? e.y - 22 : e.cy;
    const ang = Math.atan2(h.cy - y, h.x - x);
    if (S.muzzle && e.def?.rig) g.fx.spawn(S.muzzle, x, e.y, { flip: e.face < 0, height: 22, seed: e.uid });
    if (e.def?.rig) {
      e.pose = kind === "arrow" ? { crouch: 3, weapon: "bow", fx: 13, fy: -24, sa: 0, bx: -1, by: -24, pull: true, ffx: 7, fbx: -7 } : { crouch: 3, weapon: e.weapon.rig, fx: 15, fy: -23, sa: -0.3, bx: 6, by: -20, ffx: 7, fbx: -7, ...(e.weapon.two ? { two: true } : {}) };
    }
    this.shoot({ kind, x, y, vx: Math.cos(ang), vy: Math.sin(ang), owner: "enemy", src: e, dmg: e.dmg, el: S.el ?? e.def?.el, status: S.status ?? e.def?.onHit, opts: S.opts });
    g.sfx("eshot", { kind });
  }
  enemyGrenade(e, h) {
    this.areaAttack(e, "explosions/grenade", h.x - e.face * 20, this.g.world.floorBelow(h.x, h.y - 8), { r: 36, dmg: Math.round(e.dmg * 1.4), el: "fire", flip: e.face < 0 });
  }
  enemySpell(e, spell, h) {
    const g = this.g, fy = g.world.floorBelow(h.x, h.y - 10);
    e.pose = { crouch: 3, fx: 12, fy: -30, bx: 9, by: -28, ffx: 6, fbx: -6, weapon: e.weapon?.rig };
    if (spell === "shadow") {
      const r = Math.random();
      if (r < 0.4) this.areaAttack(e, "shadow/grasping-hands", h.x, fy, { r: 34, dmg: e.dmg, el: "shadow", status: "slowed" });
      else if (r < 0.7) this.areaAttack(e, "shadow/hex-sigil", h.x, fy, { r: 30, dmg: Math.round(e.dmg * 1.3), el: "shadow", status: "cursed" });
      else g.fx.spawn("shadow/curse", h.x, h.y, { actor: g.heroActor(), follow: h, memo: false, seed: e.uid }), g.status.apply(h, "cursed");
    } else if (spell === "acid") this.areaAttack(e, "nature/acid-splash", h.x, fy, { r: 22, dmg: e.dmg, el: "poison", status: "poisoned" });
    g.sfx("cast");
  }
  // ---- projectiles
  shoot(p) {
    const g = this.g, S = SHOTS[p.kind];
    const speed = S.speed;
    let vx, vy;
    if (p.vx !== undefined) (vx = p.vx * speed), (vy = p.vy * speed);
    else (vx = Math.cos(p.ang ?? 0) * speed * p.dir), (vy = Math.sin(p.ang ?? 0) * speed);
    const ang = Math.atan2(vy, vx);
    const flip = vx < 0;
    const inst = g.fx.spawn(S.fx, p.x, p.y, { ...(S.opts ?? {}), ...(p.opts ?? {}), flip, angle: flip ? ang - Math.PI : ang, memo: false, seed: (g.time * 1000) | 0 });
    this.shots.push({ ...p, S, vx, vy, inst, life: 2.4, hitList: new Set() });
  }
  update(dt) {
    const g = this.g, w = g.world;
    for (const s of this.shots) {
      s.life -= dt;
      const S = s.S;
      if (S.grav) s.vy += S.grav * dt;
      if (S.accel) {
        const sp = Math.hypot(s.vx, s.vy), k = (sp + S.accel * dt) / sp;
        s.vx *= k;
        s.vy *= k;
      }
      if (S.home && s.owner === "enemy" && !g.hero.dead) {
        const want = Math.atan2(g.hero.cy - s.y, g.hero.x - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + Math.max(-S.home * dt, Math.min(S.home * dt, d));
        s.vx = Math.cos(na) * sp;
        s.vy = Math.sin(na) * sp;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.inst?.live) {
        const o = s.inst.live.options, ang = Math.atan2(s.vy, s.vx), flip = s.vx < 0;
        o.x = s.x;
        o.y = s.y;
        o.flip = flip;
        o.angle = flip ? ang - Math.PI : ang;
        s.inst.x = s.x;
        s.inst.y = s.y;
        s.inst.flip = flip;
      }
      // walls
      if (SOLID_T[w.at(s.x, s.y)]) {
        this.burst(s, true);
        continue;
      }
      // targets
      if (s.owner === "hero") {
        for (const e of this.targets({ x0: s.x - S.r, x1: s.x + S.r, y0: s.y - S.r, y1: s.y + S.r })) {
          if (s.hitList.has(e)) continue;
          s.hitList.add(e);
          const crit = Math.random() < g.rpg.stats.crit;
          this.damageEnemy(e, Math.round(s.dmg * (crit ? 1.8 : 1)), { el: s.el ?? S.el, crit, dir: Math.sign(s.vx), src: "hero", status: s.el && Math.random() < 0.3 ? ELEMENTS[s.el]?.status : S.status });
          g.freeze(0.03);
          if (!S.pierce) {
            this.burst(s, false);
            break;
          }
        }
        g.ents.hitBox({ x0: s.x - S.r, x1: s.x + S.r, y0: s.y - S.r, y1: s.y + S.r }, s);
      } else {
        const h = g.hero;
        if (!h.dead && Math.abs(h.x - s.x) < h.w / 2 + S.r && s.y > h.y - h.h - S.r && s.y < h.y + S.r) {
          g.damageHero(s.dmg, { el: s.el, status: s.status, src: s.src, dir: Math.sign(s.vx) });
          this.burst(s, false);
        }
      }
      if (s.life <= 0 && !s.dead) this.burst(s, true);
    }
    this.shots = this.shots.filter((s) => !s.dead);
    // delayed areas: hurt when the effect lands
    for (const a of this.areas) {
      a.t += dt;
      while (a.t >= a.done * a.every && a.done < a.ticks && a.t >= 0) {
        a.done++;
        if (a.src === "hero") {
          for (const e of this.targets({ x0: a.x - a.r, x1: a.x + a.r, y0: a.y - (a.h ?? a.r * 1.6), y1: a.y + 12 }))
            this.damageEnemy(e, a.dmg, { el: a.el, status: a.status, dir: Math.sign(e.x - a.x) || 1, src: "hero", crit: a.crit, heavy: a.heavy });
          if (a.shake) g.shake(a.shake, 0.3);
          g.ents.hitBox({ x0: a.x - a.r, x1: a.x + a.r, y0: a.y - a.r * 1.6, y1: a.y + 10 }, a);
        } else {
          const h = g.hero;
          if (Math.abs(h.x - a.x) < a.r + h.w / 2 && h.y > a.y - (a.h ?? a.r * 1.6) && h.y - h.h < a.y + 10) g.damageHero(a.dmg, { el: a.el, status: a.status, src: a.src, dir: Math.sign(h.x - a.x) || 1 });
          if (a.shake) g.shake(a.shake, 0.3);
        }
      }
    }
    this.areas = this.areas.filter((a) => a.done < a.ticks);
  }
  burst(s, wall) {
    const g = this.g, S = s.S;
    s.dead = true;
    if (s.inst) g.fx.stop(s.inst);
    const fx = wall && S.wall ? S.wall : S.hit;
    if (fx) g.fx.spawn(fx, s.x, fx.startsWith("explosions") || fx === "holy/smite" ? s.y + 10 : s.y + (FX[fx].meta.origin[1] > FX[fx].meta.size[1] * 0.6 ? 10 : 0), { flip: s.vx < 0, seed: (g.time * 77) | 0, ...(S.opts ?? {}), ...(s.opts?.palette && !fx.startsWith("explosions") ? { palette: s.opts.palette } : {}) });
    if (S.splash) {
      if (s.owner === "hero") for (const e of this.targets({ x0: s.x - S.splash, x1: s.x + S.splash, y0: s.y - S.splash, y1: s.y + S.splash })) if (!s.hitList.has(e)) this.damageEnemy(e, Math.round(s.dmg * 0.7), { el: s.el ?? S.el ?? "fire", src: "hero", dir: Math.sign(e.x - s.x) });
      if (s.owner === "enemy") {
        const h = g.hero;
        if (Math.hypot(h.x - s.x, h.cy - s.y) < S.splash + 8) g.damageHero(Math.round(s.dmg * 0.7), { el: S.el ?? "fire", src: s.src, dir: Math.sign(h.x - s.x) || 1 });
      }
      g.shake(2, 0.2);
      g.sfx("boom");
    }
  }
}

// run fn after a delay of game time (paused with the game)
export function setTimeout0(g, delay, fn) {
  g.timers.push({ t: delay, fn });
}
export { RARITY, hex };
