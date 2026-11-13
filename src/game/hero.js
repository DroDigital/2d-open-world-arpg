// The hero: platforming, the body's poses, and weapon combos played from pixelfx acts.

import { FX, poseAt, actTiming, clamp } from "../pfx.js";
import { move } from "./physics.js";
import * as POSE from "./poses.js";
import { WEAPONS } from "../data/weapons.js";
import { T, TS } from "../world/tiles.js";

const GRAV = 920, FALL_GRAV = 1250, MAX_FALL = 430, RUN = 104, ACC = 1300, AIR_ACC = 900, JUMP = -318, AIR_JUMP = -292;

// a melee stroke from an effect's act: when the body moves, when it hits, how far it reaches
const strokes = new Map();
export function strokeOf(id, wind = 0.3) {
  const k = id + wind;
  if (strokes.has(k)) return strokes.get(k);
  const mod = FX[id], a = mod.act, T0 = actTiming(mod), first = a.poses[0][0], fx0 = a.poses[0][1].x ?? 0;
  const hits = (a.hits ?? []).filter((h) => h.target !== false && (h.push ?? 1) !== 0 && h.straw !== 0).map((h) => ({ t: h.t, stop: h.stop ?? 0, shake: h.shake ?? 0, amp: h.amp ?? 0, push: h.push ?? 1.2, skin: h.skin }));
  const reach = (T0.targets[0] ?? 60) + 18, last = hits.length ? hits[hits.length - 1].t : 0.1;
  const s = { id, mod, poses: a.poses, first, wind, x0: fx0, hits, reach, last, end: a.poses[a.poses.length - 1][0], around: /spin|hammer|ground/.test(id) };
  strokes.set(k, s);
  return s;
}

export class Hero {
  constructor(g, x, y) {
    Object.assign(this, {
      g, x, y, vx: 0, vy: 0, w: 10, h: 34, face: 1, step: true, onGround: false, kind: "hero",
      state: "move", t: 0, anim: 0, runPhase: 0, coyote: 0, jumpBuf: 0, airJumps: 0, dashT: 0, dashCd: 0, inv: 0, hurtT: 0,
      attack: null, queued: false, combo: 0, comboT: 0, cast: null, armed: 0, landT: 0, breath: 10, swimT: 0, drown: 0,
      flash: 0, dead: false, talking: null, pose: POSE.STAND, sitting: false, hover: 0, hoverFuel: 1.6, lastGroundY: y, peakY: y,
    });
  }
  get weapon() {
    return WEAPONS[this.g.rpg.weaponClass()] ?? WEAPONS.sword;
  }
  get cx() {
    return this.x;
  }
  get cy() {
    return this.y - this.h / 2;
  }
  update(dt) {
    const g = this.g, inp = g.input, w = g.world, S = g.rpg.stats;
    this.t += dt;
    this.anim += dt;
    if (this.inv > 0) this.inv -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.armed > 0) this.armed -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    else this.combo = 0;
    if (this.dead) return this.deadUpdate(dt);
    const locked = g.ui.blocking || this.talking || this.sitting;
    const ctl = !locked && !g.status.has(this, "frozen") && !g.status.has(this, "stunned") && !g.status.has(this, "sleep") && !g.status.has(this, "petrified");
    let ax = ctl ? inp.ax : 0;
    if (g.status.has(this, "confused") || g.status.has(this, "glitched")) ax = -ax;
    const slow = g.status.has(this, "slowed") ? 0.55 : 1, haste = g.status.has(this, "haste") ? 1.3 : 1;
    const speed = RUN * S.move * slow * haste;
    // ---- states that own the body
    if (this.state === "hurt") {
      this.hurtT -= dt;
      this.vx *= 1 - 6 * dt;
      this.gravity(dt, true);
      move(this, w, dt);
      if (this.hurtT <= 0) this.state = "move";
      this.pose = POSE.hurt();
      return;
    }
    if (this.state === "dash") return this.dashUpdate(dt);
    if (this.state === "attack") return this.attackUpdate(dt, ctl, ax);
    if (this.state === "cast") return this.castUpdate(dt, ctl, ax);
    // ---- climbing vines
    if (this.onVine && ctl && (inp.down.up || inp.down.down) && this.state !== "climb" && !this.onGround) this.state = "climb";
    if (this.onVine && ctl && inp.down.up && this.onGround) this.state = "climb";
    if (this.state === "climb") {
      if (!this.onVine) this.state = "move";
      else {
        this.vx = ax * 50;
        this.vy = (ctl ? inp.ay : 0) * 72;
        if (ctl && inp.pressed.jump) {
          this.state = "move";
          this.vy = JUMP * 0.85;
          this.vx = ax * speed;
        }
        move(this, w, dt);
        this.pose = POSE.climb(this.anim, this.vy !== 0);
        return;
      }
    }
    // ---- swimming
    const swimming = this.liquid === T.WATER;
    if (swimming) {
      this.vx += (ax * speed * 0.7 - this.vx) * Math.min(1, 6 * dt);
      this.vy += 240 * dt;
      if (ctl && (inp.down.jump || inp.down.up)) this.vy -= 620 * dt;
      if (ctl && inp.down.down) this.vy += 300 * dt;
      this.vy = clamp(this.vy, -150, 90);
      if (ctl && inp.pressed.jump && !this.under) {
        this.vy = JUMP * 0.95;
        g.fx.spawn("water/splash", this.x, this.y - 6, { seed: (this.t * 100) | 0 });
        g.sfx("splash");
      }
      this.swimT += dt;
      move(this, w, dt);
      if (Math.abs(this.vx) > 4) this.face = Math.sign(this.vx);
      this.pose = this.onGround ? POSE.run(this.runPhase, null, 0.5) : POSE.swim(this.anim);
      this.breathe(dt);
      this.combatInput(ctl);
      return;
    }
    this.breathe(dt);
    // ---- running and jumping
    const acc = this.onGround ? ACC : AIR_ACC;
    const target = ax * speed;
    if (this.onGround && g.world.at(this.x, this.y + 1) === T.ICE) this.vx += (target - this.vx) * Math.min(1, 2.2 * dt);
    else if (ax) this.vx += clamp(target - this.vx, -acc * dt, acc * dt);
    else this.vx -= clamp(this.vx, -acc * dt * 1.2, acc * dt * 1.2);
    if (ax && !this.attack) this.face = ax;
    if (this.onGround) {
      this.coyote = 0.1;
      this.airJumps = g.rpg.has("doublejump") ? 1 : 0;
      this.hoverFuel = 1.6;
    } else this.coyote -= dt;
    if (ctl && inp.pressed.jump) this.jumpBuf = 0.13;
    else this.jumpBuf -= dt;
    if (this.jumpBuf > 0) {
      if (ctl && inp.down.down && this.onGround && g.world.oneway(this.x, this.y + 2)) {
        this.drop = 0.25;
        this.jumpBuf = 0;
      } else if (this.coyote > 0) {
        this.vy = JUMP * S.jump;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.onGround = false;
        g.sfx("jump");
        g.dust(this.x, this.y, 4);
      } else if (this.airJumps > 0) {
        this.vy = AIR_JUMP * S.jump;
        this.airJumps--;
        this.jumpBuf = 0;
        g.sfx("jump2");
        g.fx.spawn("impacts/heavy-landing", this.x, this.y + 2, { light: 0.4, palette: ["#2a3a5a", "#4a6a9a", "#7aa0d0", "#a8c8f0", "#d8ecff", "#f4faff", "#ffffff"], seed: 3 });
      }
    }
    // the hover pack, once the storm's shard is yours
    this.hovering = false;
    if (ctl && !this.onGround && inp.down.jump && this.vy > 20 && g.rpg.has("hover") && this.hoverFuel > 0) {
      this.hovering = true;
      this.hoverFuel -= dt;
      this.vy = Math.min(this.vy, 30);
      this.vy -= 1800 * dt;
      if (!this.jet || this.jet.dead) this.jet = g.fx.spawn("scifi/jetpack", this.x, this.y - 22, { follow: this, dy: -20, dx: 0, memo: true, z: -1 });
    } else if (this.jet) {
      g.fx.stop(this.jet);
      this.jet = null;
    }
    this.gravity(dt, ctl && inp.down.jump);
    const wasAir = !this.onGround, vyBefore = this.vy;
    if (!this.onGround) this.peakY = Math.min(this.peakY, this.y);
    move(this, w, dt);
    if (this.landed) {
      const fall = this.y - this.peakY;
      this.landT = 0.12;
      if (fall > 140) {
        g.fx.spawn("impacts/heavy-landing", this.x, this.y, { seed: 1 });
        g.shake(2, 0.2);
        g.sfx("land_heavy");
      } else if (vyBefore > 200) {
        g.dust(this.x, this.y, 5);
        g.sfx("land");
      }
      this.peakY = this.y;
    }
    if (this.onGround) this.peakY = this.y;
    if (this.landT > 0) this.landT -= dt;
    // ---- poses
    const armed = this.armed > 0 ? this.weapon : null;
    if (this.onGround) {
      if (Math.abs(this.vx) > 10) {
        this.runPhase = (this.runPhase + dt * Math.abs(this.vx) / 52) % 1;
        this.pose = POSE.run(this.runPhase, armed, Math.abs(this.vx) / RUN);
        if (Math.floor(this.runPhase * 2) !== this.lastStep) {
          this.lastStep = Math.floor(this.runPhase * 2);
          g.sfx("step", { biome: g.world.biome(this.x).id });
          if (Math.abs(this.vx) > 80 && Math.random() < 0.3) g.dust(this.x - this.face * 4, this.y, 1, -this.face);
        }
      } else if (this.landT > 0) this.pose = POSE.land();
      else if (ctl && inp.down.down) this.pose = POSE.crouch();
      else this.pose = POSE.idle(this.anim, armed);
    } else this.pose = this.vy < 0 ? POSE.jump(armed) : POSE.fall(this.anim, armed);
    this.combatInput(ctl);
  }
  breathe(dt) {
    const g = this.g;
    if (this.under === T.WATER && !g.rpg.has("gills")) {
      this.breath -= dt;
      if (this.breath < 0) {
        this.drown += dt;
        if (this.drown > 1) {
          this.drown = 0;
          g.damageHero(Math.ceil(g.rpg.stats.maxHp * 0.08), { el: "water", src: null, quiet: true });
        }
      }
    } else this.breath = Math.min(10, this.breath + dt * 4);
    // lava and toxic sludge
    const liq = this.feetLiquid || this.liquid;
    if (liq === T.LAVA && !g.rpg.has("lavawalk")) {
      if (this.inv <= 0) g.damageHero(Math.ceil(g.rpg.stats.maxHp * 0.12), { el: "fire", status: "burning" });
      this.vy = Math.min(this.vy, -160);
    } else if (liq === T.TOXIC && this.inv <= 0) g.damageHero(4, { el: "poison", status: "poisoned" });
  }
  gravity(dt, holdJump) {
    if (this.onGround) return;
    const gg = this.vy < 0 && holdJump ? GRAV : FALL_GRAV;
    this.vy = Math.min(MAX_FALL, this.vy + gg * dt);
  }
  combatInput(ctl) {
    const g = this.g, inp = g.input;
    if (!ctl) return;
    if (inp.pressed.dash && this.dashCd <= 0) return this.startDash();
    if (inp.pressed.attack) return this.startAttack();
    for (let i = 0; i < 4; i++) if (inp.pressed["s" + (i + 1)]) return g.skills.cast(i);
    if (inp.pressed.potion) g.rpg.drinkPotion();
  }
  // ---- dash: a burst along the floor (or a blink, once learned)
  startDash() {
    const g = this.g;
    if (g.rpg.has("blink") && g.input.down.up) return g.skills.blink();
    this.state = "dash";
    this.dashT = 0.2;
    this.dashCd = 0.55;
    this.inv = Math.max(this.inv, 0.22);
    this.vy = 0;
    this.vx = this.face * 330;
    g.sfx("dash");
    g.dust(this.x, this.y, 4, -this.face);
  }
  dashUpdate(dt) {
    this.dashT -= dt;
    this.vx = this.face * 330 * (0.4 + this.dashT / 0.2 * 0.6);
    this.vy = 0;
    move(this, this.g.world, dt);
    this.pose = POSE.dash();
    if (this.dashT <= 0 || this.hitWall) {
      this.state = "move";
      this.vx *= 0.5;
    }
  }
  // ---- attacks: one stroke of the weapon's combo, timed by its act
  startAttack() {
    const g = this.g, W = this.weapon;
    if (W.ranged) return g.combat.heroRanged(this, W);
    const id = W.combo[this.combo % W.combo.length], s = strokeOf(id, W.wind), spd = g.rpg.stats.aspd * (W.spd ?? 1);
    this.attack = { s, u: 0, spd, spawned: false, hit: 0, ox: this.x - this.face * s.x0, airborne: !this.onGround };
    this.combo = (this.combo + 1) % W.combo.length;
    this.comboT = 1.1;
    this.queued = false;
    this.state = "attack";
    this.armed = 2.5;
  }
  attackUpdate(dt, ctl, ax) {
    const g = this.g, a = this.attack, s = a.s, inp = g.input;
    a.u += dt * a.spd;
    // effect time: the wind-up is played quicker than the library's, the rest as it is
    const windGame = -s.first * s.wind;
    const t = a.u < windGame ? s.first + a.u / s.wind : a.u - windGame;
    if (!a.spawned && t >= 0) {
      a.spawned = true;
      // one weapon, one look: every stroke of the combo in the first stroke's colors, or the weapon's element
      const W = this.weapon, pal = g.rpg.weaponPalette() ?? FX[W.combo[0]].meta.options.palette;
      g.fx.spawn(s.id, a.ox, this.y, { flip: this.face < 0, seed: (g.time * 1000) | 0, speed: a.spd, palette: pal });
      g.sfx("swing", { heavy: s.hits[0]?.stop > 0.15 });
    }
    while (a.hit < s.hits.length && t >= s.hits[a.hit].t) {
      g.combat.heroStroke(this, s, s.hits[a.hit], a.hit === s.hits.length - 1);
      a.hit++;
    }
    if (ctl && inp.pressed.attack && t > 0) a.queued = true;
    // the body: the act's pose, the feet carried along by the pose's own steps
    const pose = poseAt(s.poses, Math.min(t, s.end));
    const want = a.ox + this.face * (pose.x ?? 0);
    this.vx = clamp((want - this.x) / dt, -260, 260);
    if (!this.onGround) this.vy = Math.min(this.vy + FALL_GRAV * 0.5 * dt, 220);
    else this.vy = 0;
    move(this, g.world, dt);
    this.pose = { ...pose, x: 0, y: 0, ghost: pose.ghost, ...(pose.weapon ? { weapon: this.weapon.rig, ...(this.weapon.two ? { two: true } : {}) } : {}) };
    const cancel = t > s.last + 0.1;
    if (cancel && a.queued) return this.startAttack();
    if (cancel && ctl && (inp.pressed.jump || inp.pressed.dash || Math.abs(ax) > 0 && t > s.last + 0.22)) {
      this.state = "move";
      this.attack = null;
      if (inp.pressed.dash) this.startDash();
      return;
    }
    if (t >= Math.min(s.end, s.last + 0.45)) {
      this.state = "move";
      this.attack = null;
    }
  }
  // ---- casting: a skill drives the body for a while
  castUpdate(dt, ctl, ax) {
    const c = this.cast;
    c.t += dt * (c.speed ?? 1);
    const g = this.g;
    if (c.track) {
      const pose = poseAt(c.track, Math.min(c.t + c.t0, c.end));
      if (c.moveBody) {
        const want = c.ox + this.face * ((pose.x ?? 0) - c.x0);
        this.vx = clamp((want - this.x) / dt, -600, 600);
      } else this.vx *= 1 - 10 * dt;
      this.pose = { ...pose, x: 0, y: 0 };
      if (c.air) this.y = c.baseY + (pose.y ?? 0);
    } else {
      this.pose = c.pose ? c.pose(c.t) : POSE.cast(c.t);
      this.vx *= 1 - 10 * dt;
    }
    if (!c.air) {
      this.gravity(dt, false);
      move(this, g.world, dt);
    } else move(this, g.world, dt);
    c.update?.(dt, c.t);
    if (c.channel && ctl && !g.input.down["s" + (c.slot + 1)]) c.dur = Math.min(c.dur, c.t);
    if (c.t >= c.dur) {
      this.state = "move";
      c.end_?.();
      this.cast = null;
    }
  }
  deadUpdate(dt) {
    this.vx *= 1 - 4 * dt;
    if (!this.onGround) this.vy = Math.min(MAX_FALL, this.vy + FALL_GRAV * dt);
    move(this, this.g.world, dt);
  }
  hurt(dir, power = 1) {
    if (this.state === "attack" && power < 1.5) return; // a stroke carries on through a light blow
    if (this.state === "cast" && !this.cast?.interruptible) return;
    this.state = "hurt";
    this.hurtT = 0.22;
    this.vx = dir * 130 * power;
    this.vy = -120 * power;
    this.onGround = false;
    if (this.attack) this.attack = null;
  }
}
