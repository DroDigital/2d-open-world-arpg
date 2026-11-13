// Things in the world that aren't fighters: props that burn and pour (pixelfx loops, switched on near the camera),
// hazards, traps, waystones, chests, barrels, beds, signs, lifts and pads, pickups, and the spawners that keep the
// lands populated.

import { FX, PAL, hex } from "../pfx.js";
import { stillOf, blitStill, memoOf, blitMemo } from "../engine/fxman.js";
import { sprite, blit, houseFront } from "../world/decor.js";
import { glow } from "../engine/render.js";
import { Enemy, overlap } from "./enemies.js";
import { ENEMIES } from "../data/enemies.js";
import { HIT } from "../data/fxtimes.js";
import { RARITY, CONSUMABLES, MATERIALS, BASES } from "../data/items.js";
import { ICONS } from "../ui/draw.js";
import { TS } from "../world/tiles.js";

const BUCKET = 256;
const PICKUP_FX = {
  heart: ["pickups/heart-pickup", {}], potion: ["pickups/potion", { palette: PAL.blood }], ether: ["pickups/potion", { palette: PAL.water }],
  elixir: ["pickups/potion", { palette: PAL.volt }], fury: ["pickups/potion", { palette: PAL.ember }], crystal: ["pickups/crystal-shard", { palette: PAL.arcane }],
  gem: ["pickups/gem-spin", {}], frostshard: ["pickups/crystal-shard", { palette: PAL.ice }], ore: ["pickups/crystal-shard", { palette: PAL.gold }],
  key: ["pickups/key-glint", {}], star: ["pickups/power-star", {}], gold: ["pickups/coin-spin", {}], xp: ["pickups/xp-orb", {}],
  feather: ["pickups/crystal-shard", { palette: PAL.holy }], scroll: ["pickups/crystal-shard", { palette: PAL.arcane }], bomb: ["pickups/potion", { palette: PAL.smoke }],
  flare: ["pickups/potion", { palette: PAL.fire }], firework: ["pickups/potion", { palette: PAL.candy }], core: ["pickups/crystal-shard", { palette: PAL.cyber }],
};

export class Ents {
  constructor(g) {
    this.g = g;
    this.list = g.world.ents;
    this.buckets = new Map();
    for (const e of this.list) {
      e.id ??= e.kind + ":" + Math.round(e.x) + ":" + Math.round(e.y);
      const b = Math.floor(e.x / BUCKET);
      if (!this.buckets.has(b)) this.buckets.set(b, []);
      this.buckets.get(b).push(e);
      e.cd = 0;
      e.t = 0;
    }
    this.pickups = [];
    this.near = [];
  }
  /** Entities within the x range. */
  inRange(x0, x1) {
    const out = [];
    for (let b = Math.floor(x0 / BUCKET); b <= Math.floor(x1 / BUCKET); b++) for (const e of this.buckets.get(b) ?? []) if (e.x >= x0 && e.x <= x1) out.push(e);
    return out;
  }
  update(dt) {
    const g = this.g, h = g.hero, cx = g.screen.camX + 160, cy = g.screen.camY + 90;
    // switch props on near the camera, off far from it
    const near = this.inRange(cx - 420, cx + 420);
    for (const e of this.near) if (!near.includes(e)) this.sleep(e);
    this.near = near;
    for (const e of near) {
      e.t += dt;
      if (e.cd > 0) e.cd -= dt;
      if (Math.abs(e.y - cy) > 360) {
        this.sleep(e);
        continue;
      }
      this.tick(e, dt, h);
    }
    // pickups
    for (const p of this.pickups) this.pickupUpdate(p, dt, h);
    this.pickups = this.pickups.filter((p) => !p.dead);
  }
  sleep(e) {
    if (e.inst) {
      this.g.fx.kill(e.inst);
      e.inst = null;
    }
  }
  tick(e, dt, h) {
    const g = this.g, dx = h.x - e.x, dy = h.y - e.y, near = Math.abs(dx) < 22 && Math.abs(dy) < 30;
    switch (e.kind) {
      case "prop": {
        if (e.trigger) return this.trigger(e, dt, h, dx, dy);
        if (e.rainOnly && !g.director.raining) return this.sleep(e);
        if (!e.inst || e.inst.dead) e.inst = g.fx.spawn(e.fx, e.x, e.y, { seed: (e.x | 0) % 97, behind: !e.hazard, ...(e.lightK ? { lightK: e.lightK } : {}), ...(e.opts ?? {}) });
        if (e.hazard) this.hazard(e, dt, h, dx, dy);
        if (e.lift && Math.abs(dx) < 14 && h.y > e.y - 280 && h.y <= e.y + 2 && !h.dead) {
          h.vy = Math.max(-190, h.vy - 1400 * dt);
          h.onGround = false;
          if (h.y < g.world.isles[0].y * TS + 4) h.vx += Math.sign(g.world.isles[0].x * TS - h.x) * 300 * dt;
        }
        if (e.lore && near) g.prompt(e, "READ", () => g.ui.lore(e));
        if (e.objective === "core" && !g.rpg.flags["core:" + e.id] && near) g.prompt(e, "OVERLOAD", () => g.quests.core(e));
        if (e.pickup && Math.abs(dx) < 14 && Math.abs(dy - 6) < 20 && !g.rpg.flags["got:" + e.id]) {
          g.rpg.flags["got:" + e.id] = true;
          this.sleep(e);
          e.kind = "gone";
          this.collect(e.pickup, 1, e.x, e.y - 6);
        }
        return;
      }
      case "waystone": {
        const on = g.rpg.flags["way:" + e.id];
        if (on && (!e.inst || e.inst.dead)) e.inst = g.fx.spawn("arcane/rune-circle", e.x, e.y + 2, { seed: 4, lightK: 0.7, palette: PAL.arcane });
        if (near) g.prompt(e, on ? "WAYSTONE" : "ATTUNE", () => g.waystone(e));
        return;
      }
      case "pad":
        if (near && (e.id !== "spire" || Object.keys(g.rpg.shards).length >= 6 || g.rpg.flags.debug)) g.prompt(e, "TELEPORT", () => g.teleportPad(e));
        else if (near) g.prompt(e, "SEALED (6 SHARDS)", () => g.toast("THE PAD WANTS SIX SHARDS"));
        return;
      case "chest":
        if (!g.rpg.flags["chest:" + e.id] && near) g.prompt(e, "OPEN", () => this.openChest(e));
        return;
      case "barrel":
        return;
      case "bed":
        if (near) g.prompt(e, "REST", () => g.rest());
        return;
      case "sign":
        if (near) g.prompt(e, "READ", () => g.ui.say("SIGN", e.text));
        return;
      case "spawn":
        return this.spawner(e, dt, h);
      case "critter":
        if (!e.alive || e.alive.dead) {
          if (Math.abs(dx) > 340 || e.alive) {
            if (e.alive?.dead && !(e.respawn > 0)) e.respawn = 60;
            if (e.respawn > 0) return void (e.respawn -= dt);
          }
          if (!e.alive || e.alive.dead) {
            e.alive = g.addEnemy(e.type, e.x, e.y, 1);
            e.alive.ambient = true;
          }
        }
        return;
      case "boss":
        return g.bosses.near(e, dt, h);
      case "festival":
        return g.director.festival(e, dt);
      case "npc":
        return g.npcs.ensure(e);
    }
  }
  // ---- traps and one-shot props
  trigger(e, dt, h, dx, dy) {
    const g = this.g;
    const idle = () => {
      // what a sleeping trap looks like
      const still = { "ice/icicle-fall": 0, "explosions/barrel-explosion": 0 }[e.fx];
      if (still !== undefined && e.cd <= 0) e.show = stillOf(e.fx, still, { seed: 2 });
    };
    idle();
    if (e.cd > 0) return;
    const go = (o = {}) => {
      e.cd = o.cd ?? 6;
      e.show = null;
      g.fx.spawn(e.fx, e.x, e.y, { seed: ((g.time * 10) | 0) % 50, ...(o.opts ?? {}) });
    };
    switch (e.trigger) {
      case "spore":
        if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
          go({ cd: 10 });
          g.combat.areas.push({ t: -HIT["nature/spore-burst"], x: e.x, y: e.y, src: null, r: 40, dmg: 3, el: "poison", status: "confused", ticks: 1, every: 1, done: 0 });
        }
        break;
      case "icicle":
        if (Math.abs(dx) < 24 && dy > -10 && dy < 120) {
          go({ cd: 8 });
          g.combat.areas.push({ t: -HIT["ice/icicle-fall"], x: e.x, y: e.y, src: null, r: 14, h: 50, dmg: 14, el: "ice", status: "slowed", ticks: 1, every: 1, done: 0 });
        }
        break;
      case "vent":
        if (Math.abs(dx) < 240) {
          go({ cd: 4 + ((e.x / 8) % 3) });
          g.combat.areas.push({ t: -HIT["fire/flame-pillar"], x: e.x, y: e.y, src: null, r: 14, h: 120, dmg: 12, el: "fire", status: "burning", ticks: 5, every: 0.3, done: 0 });
        }
        break;
      case "geyser":
        if (Math.abs(dx) < 260) {
          go({ cd: 5.5 });
          g.timers.push({ t: HIT["water/geyser"], fn: () => {
            if (Math.abs(g.hero.x - e.x) < 18 && Math.abs(g.hero.y - e.y) < 30) {
              g.hero.vy = -560;
              g.hero.onGround = false;
              g.sfx("geyser");
            }
          } });
        }
        break;
      case "bloom":
        if (Math.abs(dx) < 26 && Math.abs(dy) < 30 && g.rpg.hp < g.rpg.stats.maxHp) {
          go({ cd: 45 });
          g.timers.push({ t: 1, fn: () => g.rpg.heal(g.rpg.stats.maxHp * 0.35) });
        }
        break;
      case "hex":
        if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
          go({ cd: 12 });
          g.combat.areas.push({ t: -HIT["shadow/hex-sigil"], x: e.x, y: e.y, src: null, r: 40, h: 90, dmg: 18, el: "shadow", status: "cursed", ticks: 1, every: 1, done: 0 });
        }
        break;
      case "cannon":
        if (Math.abs(dx) < 300) {
          go({ cd: 6 });
          g.combat.areas.push({ t: -1.0, x: e.x + 120, y: e.y + 12, src: null, r: 60, h: 40, dmg: 16, el: "fire", ticks: 1, every: 1, done: 0 });
        }
        break;
      case "mine":
        if (Math.abs(dx) < 10 && Math.abs(dy) < 8) {
          go({ cd: 40 });
          g.combat.areas.push({ t: -0.05, x: e.x, y: e.y, src: null, r: 40, h: 60, dmg: 18, el: "fire", ticks: 1, every: 1, done: 0, shake: 4 });
          g.hero.vy = -320;
        }
        break;
      case "flare":
        if (Math.abs(dx) < 18 && Math.abs(dy) < 30) g.prompt(e, "FIRE FLARE", () => {
          go({ cd: 30 });
          g.director.flare(e.x, e.y);
        });
        break;
      case "blessing":
        if (!e.inst || e.inst.dead) e.inst = g.fx.spawn("holy/blessing", e.x, e.y, { seed: 2 });
        if (Math.abs(dx) < 18 && Math.abs(dy) < 30) g.prompt(e, "PRAY", () => {
          e.cd = 30;
          g.status.apply(h, "haloed");
          g.status.apply(h, "blessed");
          g.rpg.hp = g.rpg.stats.maxHp;
          g.rpg.mp = g.rpg.stats.maxMp;
          g.fx.spawn("holy/feather-burst", h.x, h.y - 30, { seed: 5 });
          g.toast("THE LIGHT WATCHES OVER YOU");
        });
        break;
    }
  }
  hazard(e, dt, h, dx, dy) {
    const g = this.g, z = e.hazard;
    if (z.pull && Math.abs(dx) < z.r * 2 && Math.abs(dy) < z.r * 2 && h.liquid) {
      h.vx -= Math.sign(dx) * z.pull * dt * 3;
      h.vy += 40 * dt;
    }
    if (z.push && Math.abs(dx) < z.r * 1.6 && Math.abs(dy) < 50) h.vx += Math.sign(dx || 1) * z.push * dt * 4;
    if (!z.dmg) return;
    const active = !z.pulse || e.t % z.pulse < 0.5;
    if (active && Math.abs(dx) < z.r && dy > -20 && dy < 40 && h.inv <= 0) g.damageHero(z.dmg + Math.round(g.rpg.level * 0.6), { el: z.el, status: z.status, dir: Math.sign(dx) || 1 });
    // hazards bite enemies too
    if (active) for (const en of g.enemies) if (!en.dead && Math.abs(en.x - e.x) < z.r && Math.abs(en.y - e.y) < 30 && (en.hazCd = (en.hazCd ?? 0) - dt) <= 0) {
      en.hazCd = 0.6;
      g.combat.damageEnemy(en, z.dmg, { el: z.el, status: z.status });
    }
  }
  // ---- breakables and chests
  hitBox(box, src) {
    for (const e of this.inRange(box.x0 - 10, box.x1 + 10)) {
      if (e.kind === "barrel" && !e.blown && e.x > box.x0 - 6 && e.x < box.x1 + 6 && e.y > box.y0 && e.y - 22 < box.y1) this.blowBarrel(e);
      if (e.kind === "prop" && e.objective === "core" && !this.g.rpg.flags["core:" + e.id] && e.x > box.x0 - 8 && e.x < box.x1 + 8 && Math.abs(e.y - 10 - (box.y0 + box.y1) / 2) < 40) this.g.quests.core(e);
    }
    void src;
  }
  blowBarrel(e) {
    const g = this.g;
    e.blown = true;
    g.fx.spawn("explosions/barrel-explosion", e.x, e.y, { seed: e.x % 31 });
    g.timers.push({ t: HIT["explosions/barrel-explosion"], fn: () => {
      for (const en of g.combat.targets({ x0: e.x - 56, x1: e.x + 56, y0: e.y - 80, y1: e.y + 10 })) g.combat.damageEnemy(en, 30 + g.rpg.level * 6, { el: "fire", status: "burning", dir: Math.sign(en.x - e.x), heavy: true });
      const h = g.hero;
      if (Math.abs(h.x - e.x) < 50 && Math.abs(h.y - e.y) < 50) g.damageHero(12 + g.rpg.level * 2, { el: "fire", dir: Math.sign(h.x - e.x) || 1 });
      g.shake(4, 0.4);
      g.sfx("boom", { big: true });
      for (const b of this.inRange(e.x - 60, e.x + 60)) if (b.kind === "barrel" && !b.blown) g.timers.push({ t: 0.25, fn: () => this.blowBarrel(b) });
    } });
    e.respawn = 90;
  }
  openChest(e) {
    const g = this.g;
    g.rpg.flags["chest:" + e.id] = true;
    g.fx.spawn("pickups/chest-open", e.x, e.y, { seed: e.x % 13 });
    g.sfx("chest");
    const lv = Math.max(g.rpg.level, e.tier * 5);
    g.timers.push({ t: 1.4, fn: () => {
      g.ents.dropGold(e.x, e.y - 10, 20 * e.tier + Math.round(Math.random() * 30 * e.tier));
      g.ents.dropLoot(e.x, e.y - 10, g.rpg.rollLoot(lv, 0.2 + e.tier * 0.15));
      if (e.tier >= 2) g.ents.dropLoot(e.x, e.y - 10, g.rpg.rollLoot(lv, 0.3));
      if (Math.random() < 0.3) g.ents.drop(e.x, e.y - 10, "potion");
    } });
    g.quests.onChest(e);
  }
  // ---- spawners: packs that appear near the hero and come back later
  spawner(e, dt, h) {
    const g = this.g;
    e.cool = (e.cool ?? 0) - dt;
    e.alive = (e.alive ?? []).filter((x) => !x.dead && !x.gone);
    const night = g.director.night > 0.5;
    if (e.night && !night) {
      for (const x of e.alive) x.gone = true;
      return;
    }
    if (!e.alive.length && e.cool <= 0 && Math.abs(h.x - e.x) < 400 && Math.abs(h.x - e.x) > 140 && Math.abs(h.y - e.y) < 300) {
      e.cool = 160;
      const n = e.n;
      for (let i = 0; i < n; i++) {
        const type = e.list[Math.floor(Math.random() * e.list.length)], lv = e.level[0] + Math.floor(Math.random() * (e.level[1] - e.level[0] + 1));
        const d = ENEMIES[type];
        if (!d) continue;
        if (e.water && !d.swim) continue;
        const x = e.x + (i - (n - 1) / 2) * 26, y = d.fly ? e.y - 30 - Math.random() * 30 : g.world.floorBelow(x, e.y - 24);
        const en = g.addEnemy(type, x, y, lv);
        en.spawnerRef = e;
        e.alive.push(en);
        if (d.rig && Math.random() < 0.3) g.fx.spawn("spawn/spawn-portal", x, y, { seed: i, light: 0.6 });
      }
    }
    // despawn when far away (they'll come back when the timer allows)
    if (Math.abs(h.x - e.x) > 900) {
      for (const x of e.alive) x.gone = true;
      if (e.alive.length) e.cool = Math.min(e.cool, 20);
    }
  }
  // ---- drops and pickups
  dropGold(x, y, n) {
    if (n <= 0) return;
    this.g.fx.spawn("spawn/coin-drop", x, y, { seed: (x | 0) % 50, coins: Math.min(9, 3 + Math.floor(n / 10)) });
    this.spawnPickup("gold", x, y - 8, n, { delay: 1 });
  }
  dropXp(x, y, n) {
    for (let i = 0; i < n; i++) this.spawnPickup("xp", x, y, 0, { vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, home: 0.35 + i * 0.05 });
  }
  drop(x, y, id, n = 1) {
    this.spawnPickup(id, x, y - 8, n);
  }
  dropLoot(x, y, loot) {
    if (loot.type === "gold") return this.dropGold(x, y, loot.n);
    if (loot.type === "item") return this.drop(x, y, loot.id, loot.n);
    // gear: a pillar of light in its rarity's color
    this.spawnPickup("gear", x, y - 8, 1, { item: loot.item });
  }
  spawnPickup(kind, x, y, n, o = {}) {
    const p = { kind, x, y, n, vx: o.vx ?? (Math.random() - 0.5) * 70, vy: o.vy ?? -140, t: 0, delay: o.delay ?? 0, item: o.item, home: o.home ?? 0, dead: false, w: 8, h: 8, onGround: false };
    this.pickups.push(p);
    return p;
  }
  pickupUpdate(p, dt, h) {
    const g = this.g;
    p.t += dt;
    if (p.t < p.delay) return;
    const dx = h.x - p.x, dy = h.cy - p.y, d = Math.hypot(dx, dy);
    if (p.kind === "xp") {
      if (p.t > p.home) {
        p.vx += (dx / (d || 1)) * 900 * dt;
        p.vy += (dy / (d || 1)) * 900 * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else p.vy += 300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < 10 || p.t > 3) p.dead = true;
      return;
    }
    // fall and settle
    const magnet = p.kind === "gold" ? 70 : 0;
    if (d < magnet && !h.dead) {
      p.vx += (dx / d) * 700 * dt;
      p.vy += (dy / d) * 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else {
      p.vy = Math.min(300, p.vy + 600 * dt);
      p.vx *= 1 - 3 * dt;
      p.x += p.vx * dt;
      const fy = g.world.floorBelow(p.x, p.y - 6);
      p.y = Math.min(fy, p.y + p.vy * dt);
      if (p.y >= fy) p.vy = 0;
    }
    if (Math.abs(dx) < 12 && Math.abs(h.y - 8 - p.y) < 26 && !h.dead && p.t > p.delay + 0.3) {
      p.dead = true;
      this.collect(p.kind, p.n, p.x, p.y, p.item);
    }
    if (p.t > 120) p.dead = true;
  }
  collect(kind, n, x, y, item) {
    const g = this.g;
    g.fx.spawn("pickups/collect-burst", x, y + 10, { seed: (x | 0) % 40, light: 0.7, ...(kind === "gear" ? { palette: RARITY[item.rarity].beam } : {}) });
    g.sfx("pickup", { kind });
    if (kind === "gold") {
      g.rpg.gold += n;
      if (n >= 40) g.fx.spawn("ui/coin-collect", 236, 26, { layer: "ui", count: Math.min(12, Math.round(n / 8)), from: Math.max(0, g.rpg.gold - n), seed: 4 });
      g.number(x, y - 10, "+" + n + "G", "gold");
      g.quests.onGold?.(n);
      return;
    }
    if (kind === "heart") return g.rpg.heal(g.rpg.stats.maxHp * 0.2);
    if (kind === "gear") {
      g.rpg.addGear(item);
      g.toast(item.name.toUpperCase(), RARITY[item.rarity].color);
      return;
    }
    if (kind === "star") {
      g.status.apply(g.hero, "star");
      return;
    }
    g.rpg.give(kind, n);
    const name = (CONSUMABLES[kind] ?? MATERIALS[kind])?.name ?? kind;
    g.toast("+" + n + " " + name.toUpperCase());
    g.quests.onItem?.(kind);
  }
  // ---- drawing
  /** Scenery and still props, into the bg layer (behind everyone). */
  drawBg(screen) {
    const g = this.g, f = screen.bg, cx = screen.camX;
    const list = this.inRange(cx - 120, cx + 440);
    const night = g.director.night;
    for (const e of list) {
      if (e.kind === "deco") {
        const s = sprite(e.type, e.v);
        if (blit(f, s, e.x, e.y, (e.v & 1) === 1)) for (const [gx, gy, r, c, k, blink] of s.glow) if (!blink || Math.sin(g.time * 4) > 0) glow(f, e.x - s.ox + gx, e.y - s.oy + gy, r, c, k * (0.4 + night));
      } else if (e.kind === "house") houseFront(f, screen.back, e, night, g.time, (x, y, r, c, k) => glow(f, x, y, r, c, k));
    }
  }
  /** Things that stand in the world at character depth. */
  drawAct(screen) {
    const g = this.g, cx = screen.camX;
    for (const e of this.inRange(cx - 120, cx + 440)) {
      if (e.kind === "chest" && !g.rpg.flags["chest:" + e.id]) blitStill(screen, stillOf("pickups/chest-open", 0, { seed: 1 }), e.x, e.y, { layer: "act" });
      else if (e.kind === "barrel") {
        if (e.blown) {
          if ((e.respawn -= 1 / 60) <= 0) e.blown = false;
        } else blitStill(screen, stillOf("explosions/barrel-explosion", 0, { seed: 1 }), e.x, e.y, { layer: "act" });
      } else if (e.kind === "waystone") drawWaystone(screen, e, g.rpg.flags["way:" + e.id], g.time);
      else if (e.kind === "sign") drawSign(screen, e);
      else if (e.kind === "prop" && e.show) blitStill(screen, e.show, e.x, e.y, { layer: "act" });
      else if (e.kind === "prop" && e.trigger === "spore" && e.cd <= 0) blit(screen.act, sprite("small_woods", 1), e.x, e.y);
      else if (e.kind === "prop" && e.trigger === "flare" && e.cd <= 0) drawSign(screen, e, true);
      else if (e.kind === "prop" && e.trigger === "mine" && e.cd <= 0) drawMine(screen, e, g.time);
      else if (e.kind === "bed") drawBed(screen, e);
    }
    for (const p of this.pickups) {
      if (p.t < p.delay) continue;
      if (p.kind === "gear") {
        if (p.item.rarity >= 2) blitMemo(screen, memoOf("pickups/loot-beam", { palette: RARITY[p.item.rarity].beam }, false), g.time, p.x, p.y + 4, { layer: "world" });
        else {
          const f = screen.act, c = hex(RARITY[p.item.rarity].color), bob = Math.round(Math.sin(g.time * 3 + p.x) * 1.5);
          const B = BASES[p.item.base], name = B.cls ?? { armor: "armor", helm: "helm", boots: "boots", ring: "ring", amulet: "amulet" }[B.slot];
          iconAt(f, ICONS[name] ?? ICONS.ring, Math.round(p.x) - 7 - f.ox, Math.round(p.y) - 15 + bob - f.oy, c);
          if (Math.sin(g.time * 4 + p.x) > 0.7) glow(f, p.x, p.y - 8, 10, c, 0.4);
        }
        continue;
      }
      const [id, o] = PICKUP_FX[p.kind] ?? PICKUP_FX.crystal;
      const m = memoOf(id, o, false), b = FX[id].meta;
      blitMemo(screen, m, g.time + p.x * 0.01, p.x, p.y + (b.size[1] - b.origin[1]) * 0 + 2, { layer: "world", alpha: p.t > 110 ? 0.5 : 1 });
    }
  }
}

// ---- small drawings
const STONE = ["#c8c4d8", "#9a96b0", "#6a6688", "#44405e", "#2a2640"].map(hex);
function drawWaystone(screen, e, on, time) {
  const f = screen.act, x0 = Math.round(e.x) - f.ox, y0 = Math.round(e.y) - f.oy;
  for (let y = 0; y < 30; y++) {
    const half = y > 26 ? 6 : 4 - Math.floor(y / 12);
    for (let x = -half; x <= half; x++) {
      const px = x0 + x, py = y0 - 1 - y;
      if (px < 0 || py < 0 || px >= f.w || py >= f.h) continue;
      const edge = Math.abs(x) === half || y === 29;
      let c = edge ? 0xff120f18 : x < -half + 2 ? STONE[0] : x > half - 2 ? STONE[3] : STONE[1];
      if (on && x === 0 && y > 8 && y < 22 && (y % 4 !== 0)) c = Math.sin(time * 3 + y) > 0 ? hex("#ecc8ff") : hex("#9a48ec");
      f.color[py * f.w + px] = c;
    }
  }
  if (on) glow(screen.act, e.x, e.y - 16, 26, hex("#9a48ec"), 0.35 + 0.1 * Math.sin(time * 3));
}
function drawSign(screen, e, flare) {
  const f = screen.act, x0 = Math.round(e.x) - f.ox, y0 = Math.round(e.y) - f.oy;
  const W = ["#c8945a", "#9a6a3e", "#6e4a2a", "#40281a"].map(hex);
  for (let y = 0; y < 18; y++)
    for (let x = -1; x <= 0; x++) if (x0 + x >= 0 && x0 + x < f.w && y0 - 1 - y >= 0 && y0 - 1 - y < f.h) f.color[(y0 - 1 - y) * f.w + x0 + x] = W[x + 2];
  for (let y = 0; y < 8; y++)
    for (let x = -8; x <= 7; x++) {
      const px = x0 + x, py = y0 - 18 + y;
      if (px < 0 || py < 0 || px >= f.w || py >= f.h) continue;
      f.color[py * f.w + px] = x === -8 || x === 7 || y === 0 || y === 7 ? 0xff120c10 : flare ? (y === 3 ? hex("#ff4a3a") : W[0]) : y % 3 === 2 && x > -6 && x < 5 ? W[2] : W[0];
    }
}
function iconAt(f, rows, x, y, c) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== "#") return;
    for (let k = 0; k < 4; k++) {
      const px = x + i * 2 + (k & 1), py = y + j * 2 + (k >> 1);
      if (px >= 0 && py >= 0 && px < f.w && py < f.h) f.color[py * f.w + px] = c;
    }
  }));
}
function drawMine(screen, e, time) {
  const f = screen.act, x0 = Math.round(e.x) - f.ox, y0 = Math.round(e.y) - f.oy;
  for (let x = -3; x <= 3; x++) for (let y = 1; y <= 2; y++) if (x0 + x >= 0 && x0 + x < f.w && y0 - y >= 0 && y0 - y < f.h) f.color[(y0 - y) * f.w + x0 + x] = y === 2 && Math.abs(x) < 2 ? (Math.sin(time * 6) > 0 ? hex("#ff3a3a") : hex("#5a2a2a")) : hex("#4a4e5a");
}
function drawBed(screen, e) {
  const f = screen.act, x0 = Math.round(e.x) - f.ox, y0 = Math.round(e.y) - f.oy;
  for (let y = 0; y < 7; y++)
    for (let x = -10; x <= 10; x++) {
      const px = x0 + x, py = y0 - 1 - y;
      if (px < 0 || py < 0 || px >= f.w || py >= f.h) continue;
      f.color[py * f.w + px] = y < 2 ? hex("#6e4a2a") : x < -5 && y < 6 ? hex("#f0ece4") : y === 6 ? 0xff120c10 : hex(x < 0 ? "#c84a5a" : "#a83a4a");
    }
}
export { overlap };
