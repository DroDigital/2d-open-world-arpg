// The game: owns the world, the hero and every system, steps them, and paints a frame.

import { Screen, W, H, glow, rect } from "../engine/render.js";
import { FxMan } from "../engine/fxman.js";
import { Input } from "../engine/input.js";
import { World } from "../world/world.js";
import { TileArt } from "../world/tileart.js";
import { Backdrop } from "../world/backdrop.js";
import { drawLiquids } from "../world/liquids.js";
import { TS } from "../world/tiles.js";
import { Hero } from "./hero.js";
import { RPG } from "./rpg.js";
import { Status } from "./status.js";
import { Combat } from "./combat.js";
import { Enemy } from "./enemies.js";
import { Ents } from "./ents.js";
import { Skills } from "./skills.js";
import { Bosses } from "./bosses.js";
import { Npcs } from "./npcs.js";
import { Quests } from "./quests.js";
import { Director } from "./director.js";
import { UI } from "../ui/ui.js";
import { Audio } from "../engine/audio.js";
import { drawRig, actorOf, joints } from "./rigdraw.js";
import { hex, mix, PAL } from "../pfx.js";

export class Game {
  constructor(opts = {}) {
    this.opts = opts;
    this.screen = new Screen();
    this.input = opts.input ?? new Input();
    this.fx = new FxMan();
    this.audio = opts.audio ?? new Audio(null);
    this.world = new World(opts.seed ?? 7);
    this.tiles = new TileArt(this.world);
    this.backdrop = new Backdrop(this.world);
    this.time = 0;
    this.timers = [];
    this.enemies = [];
    this.freezeT = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.timeStop = 0;
    this.comboN = 0;
    this.comboT = 0;
    this.prompts = null;
    this.boss = null;
    this.rpg = new RPG(this);
    this.status = new Status(this);
    this.combat = new Combat(this);
    this.ents = new Ents(this);
    this.skills = new Skills(this);
    this.bosses = new Bosses(this);
    this.npcs = new Npcs(this);
    this.quests = new Quests(this);
    this.director = new Director(this);
    this.ui = new UI(this);
    const start = this.world.ents.find((e) => e.kind === "waystone" && e.id === "brightwater");
    this.hero = new Hero(this, start.x - 40, start.y);
    this.spawnPoint = { x: start.x - 40, y: start.y, id: "brightwater" };
    this.rpg.flags["way:brightwater"] = true;
    this.cam = { x: this.hero.x - W / 2, y: this.hero.y - H * 0.62 };
    this.out = new Uint8ClampedArray(W * H * 4);
    this.perf = { update: 0, render: 0 };
    this.scene = opts.scene ?? "title";
  }
  // ---- small services every system uses
  sfx(name, o) {
    this.audio.play(name, o);
  }
  shake(amp, dur) {
    if (amp * dur > this.shakeAmp * this.shakeT) {
      this.shakeAmp = amp;
      this.shakeT = dur;
    }
  }
  freeze(t) {
    this.freezeT = Math.max(this.freezeT, Math.min(0.22, t));
  }
  dust(x, y, n = 3, dir = 0) {
    const pal = { frost: "#e8f2ff", marsh: "#6a6a4a", crags: "#5a5050", storm: "#8a94a4" }[this.world.biome(x).id] ?? "#c8b898";
    for (let i = 0; i < n; i++) this.ui.particle(x + (Math.random() - 0.5) * 8, y - 1, (dir || (Math.random() < 0.5 ? -1 : 1)) * (20 + Math.random() * 50), -10 - Math.random() * 30, hex(pal));
  }
  number(x, y, text, kind = "hit", color) {
    this.ui.number(x, y, text, kind, color);
  }
  toast(text, color) {
    this.ui.toast(text, color);
  }
  prompt(e, label, fn) {
    const h = this.hero, d = Math.abs(h.x - e.x);
    if (!this.prompts || d < this.prompts.d) this.prompts = { e, label, fn, d };
  }
  combo(n) {
    this.comboN += n;
    this.comboT = 2.2;
    if (this.comboN >= 5 && this.comboN % 5 < n) this.fx.spawn("ui/combo-counter", 230, 70, { layer: "ui", count: this.comboN, seed: this.comboN });
    if (this.comboN >= 25 && this.comboN % 25 < n) this.fx.spawn("explosions/cartoon-pow", this.hero.x + this.hero.face * 30, this.hero.y - 30, { seed: this.comboN, text: "POW!" });
  }
  heroActor() {
    return actorOf(this.hero.pose, this.rpg.costume);
  }
  addEnemy(type, x, y, level, opts) {
    const e = new Enemy(this, type, x, y, level, opts);
    this.enemies.push(e);
    return e;
  }
  // ---- the hero takes a blow
  damageHero(dmg, o = {}) {
    const h = this.hero, S = this.rpg.stats;
    if (h.dead || this.scene !== "play") return 0;
    if (!o.dot && h.inv > 0) return 0;
    if (this.status.has(h, "star")) return 0;
    for (const k of ["shielded", "forcefield"]) if (this.status.has(h, k) && !o.dot) {
      const st = h.st[k];
      st.hp = (st.hp ?? S.maxHp * 0.4) - dmg;
      this.fx.spawn("impacts/shield-block", h.x, h.y, { flip: (o.dir ?? 1) > 0, seed: 3, palette: k === "shielded" ? PAL.holy : PAL.cyber });
      this.sfx("block");
      if (st.hp <= 0) this.status.clear(h, k);
      h.inv = 0.3;
      return 0;
    }
    let d = Math.max(1, Math.round(dmg * (100 / (100 + S.def * 4))));
    if (this.status.has(h, "cursed")) d = Math.round(d * 1.3);
    if (this.status.has(h, "haloed")) d = Math.round(d * 0.75);
    this.rpg.hp -= d;
    this.status.onHit(h);
    if (o.status && Math.random() < 0.5) this.status.apply(h, o.status, { src: o.src });
    if (!o.quiet && !o.dot) {
      h.inv = 0.7;
      h.flash = 0.7;
      h.hurt(o.dir ?? -h.face, d > S.maxHp * 0.2 ? 1.4 : 1);
      this.fx.spawn("impacts/hit-flash", h.x, h.y, { actor: this.heroActor(), flip: h.face < 0, seed: 3, memo: false });
      this.freeze(o.stop ?? 0.06);
      this.shake(o.amp || 2, o.shake || 0.2);
      this.sfx("hurt");
      if (d > S.maxHp * 0.25) this.fx.spawn("ui/heart-lost", 18, 30, { layer: "ui", seed: 2 });
    }
    this.number(h.x, h.y - h.h - 4, "-" + d, "hurt");
    if (this.rpg.hp <= 0) this.heroDies(o);
    return d;
  }
  heroDies(o) {
    const h = this.hero;
    this.rpg.hp = 0;
    // a Phoenix Feather: rise again on the spot
    if (this.rpg.take("feather")) {
      this.fx.spawn("holy/resurrection", h.x, h.y, { actor: this.heroActor(), seed: 7, memo: false });
      this.rpg.hp = Math.round(this.rpg.stats.maxHp * 0.6);
      h.inv = 3;
      this.toast("THE FEATHER BURNS - YOU RISE");
      this.sfx("revive");
      return;
    }
    h.dead = true;
    this.status.clearAll(h);
    const deathFx = { fire: "spawn/dissolve-burn", ice: "spawn/shatter-death", shock: "spawn/disintegrate", shadow: "spawn/soul-rise", poison: "spawn/soul-rise" }[o.el] ?? "spawn/disintegrate";
    this.fx.spawn(deathFx, h.x, h.y, { actor: this.heroActor(), flip: h.face < 0, seed: 9, memo: false });
    this.heroHidden = 3.2;
    this.sfx("death");
    this.timers.push({ t: 2.6, fn: () => this.ui.transition("transitions/burn-away", () => this.respawn()) });
  }
  respawn() {
    const h = this.hero, s = this.spawnPoint;
    h.dead = false;
    h.x = s.x;
    h.y = s.y;
    h.vx = h.vy = 0;
    h.state = "move";
    this.rpg.hp = this.rpg.stats.maxHp;
    this.rpg.mp = this.rpg.stats.maxMp;
    const lost = Math.floor(this.rpg.gold * 0.15);
    this.rpg.gold -= lost;
    this.heroHidden = 0;
    if (this.boss) this.bosses.reset();
    this.fx.spawn("spawn/respawn-beam", h.x, h.y, { actor: this.heroActor(), seed: 4, memo: false });
    this.snapCamera();
    if (lost) this.toast("LOST " + lost + " GOLD");
    this.save();
  }
  onLevelUp() {
    const h = this.hero;
    this.fx.spawn("ui/level-up", h.x, h.y, { actor: this.heroActor(), seed: this.rpg.level, follow: h, memo: false });
    this.sfx("levelup");
    this.toast("LEVEL " + this.rpg.level + " - 3 POINTS TO SPEND", "#ffe066");
  }
  waystone(e) {
    if (!this.rpg.flags["way:" + e.id]) {
      this.rpg.flags["way:" + e.id] = true;
      this.fx.spawn("arcane/magic-circle-cast", e.x, e.y, { seed: 2 });
      this.fx.spawn("ui/achievement", 160, 26, { layer: "ui", title: "WAYSTONE", text: e.name.toUpperCase(), seed: 3 });
      this.sfx("attune");
      this.quests.onWaystone(e);
    }
    this.spawnPoint = { x: e.x - 20, y: e.y, id: e.id };
    this.rpg.hp = this.rpg.stats.maxHp;
    this.rpg.mp = this.rpg.stats.maxMp;
    this.save();
    this.ui.open("map", { travel: true });
  }
  /** Fast travel to a waystone, with a star iris. */
  travel(id) {
    const e = this.world.ents.find((x) => x.kind === "waystone" && x.id === id);
    if (!e) return;
    this.ui.close();
    this.ui.transition("transitions/star-iris", () => {
      this.hero.x = e.x - 20;
      this.hero.y = e.y;
      this.hero.vx = this.hero.vy = 0;
      this.snapCamera();
      this.fx.spawn("arcane/blink-in", this.hero.x, this.hero.y, { actor: this.heroActor(), seed: 5, memo: false });
    });
  }
  teleportPad(e) {
    const to = this.world.ents.find((x) => x.kind === "pad" && x.id === e.to), h = this.hero;
    this.fx.spawn("scifi/warp-out", h.x, h.y, { actor: this.heroActor(), seed: 3, memo: false });
    this.heroHidden = 1.6;
    this.sfx("warp");
    this.timers.push({ t: 1.4, fn: () => this.ui.transition("transitions/glitch-wipe", () => {
      h.x = to.x + 20;
      h.y = to.y;
      h.vx = h.vy = 0;
      this.snapCamera();
      this.heroHidden = 0;
      this.fx.spawn("scifi/warp-in", h.x, h.y, { actor: this.heroActor(), seed: 3, memo: false });
    }) });
  }
  rest() {
    this.ui.transition("transitions/pixel-dissolve", () => {
      this.director.tod = 0.3;
      this.rpg.hp = this.rpg.stats.maxHp;
      this.rpg.mp = this.rpg.stats.maxMp;
      this.status.clearAll(this.hero);
      this.toast("YOU WAKE RESTED");
      this.save();
    });
  }
  snapCamera() {
    this.cam.x = this.hero.x - W / 2;
    this.cam.y = this.hero.y - H * 0.62;
    this.clampCam();
  }
  clampCam() {
    this.cam.x = Math.max(16, Math.min(this.world.pw - W - 16, this.cam.x));
    this.cam.y = Math.max(0, Math.min(this.world.ph - H - 24, this.cam.y));
  }
  save() {
    if (this.opts.noSave || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("shardlight-save", JSON.stringify({ v: 1, rpg: this.rpg.serialize(), hero: { x: this.hero.x, y: this.hero.y }, spawn: this.spawnPoint, tod: this.director.tod, quests: this.quests.serialize(), skills: this.skills.serialize(), time: this.time }));
    } catch {}
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem("shardlight-save"));
      if (!d) return false;
      this.rpg.load(d.rpg);
      this.spawnPoint = d.spawn;
      this.hero.x = d.spawn.x;
      this.hero.y = d.spawn.y;
      this.director.tod = d.tod;
      this.quests.load(d.quests);
      this.skills.load(d.skills);
      this.snapCamera();
      return true;
    } catch {
      return false;
    }
  }
  // ---- a tick
  update(dt) {
    const t0 = performance.now();
    this.input.poll();
    this.ui.update(dt);
    if (this.scene === "title" || this.ui.paused) {
      this.director.update(dt * (this.scene === "title" ? 1 : 0));
      this.fx.update(this.scene === "title" ? dt : 0);
      if (this.scene === "title") this.titleCam(dt);
      this.perf.update = performance.now() - t0;
      return;
    }
    this.time += dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    else this.comboN = 0;
    if (this.heroHidden > 0) this.heroHidden -= dt;
    if (this.timeStop > 0) this.timeStop -= dt;
    // hit-stop: the world holds still for a moment on a heavy blow
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      this.perf.update = performance.now() - t0;
      return;
    }
    this.prompts = null;
    for (const tm of this.timers) if ((tm.t -= dt) <= 0 && !tm.done) (tm.done = true), tm.fn();
    this.timers = this.timers.filter((t) => !t.done);
    const h = this.hero;
    h.update(dt);
    this.status.update(h, dt);
    // regeneration
    const S = this.rpg.stats;
    if (!h.dead) {
      if (!this.status.has(h, "cursed")) this.rpg.hp = Math.min(S.maxHp, this.rpg.hp + S.regen * dt);
      this.rpg.mp = Math.min(S.maxMp, this.rpg.mp + S.mregen * dt);
    }
    for (const e of this.enemies) if (!e.dead && !e.gone && Math.abs(e.x - h.x) < 700) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead && !e.gone);
    this.bosses.update(dt);
    this.combat.update(dt);
    this.skills.update(dt);
    this.ents.update(dt);
    this.npcs.update(dt);
    this.quests.update(dt);
    this.director.update(dt);
    this.fx.update(this.timeStop > 0 ? dt * 0.15 : dt);
    // interact
    if (this.prompts && this.input.pressed.interact && !h.dead) {
      this.input.eat("interact");
      this.prompts.fn();
    }
    if (this.input.pressed.up && this.prompts && !h.onVine && !h.dead) this.prompts.fn();
    this.updateCamera(dt);
    this.perf.update = performance.now() - t0;
  }
  titleCam(dt) {
    this.titleT = (this.titleT ?? 0) + dt;
    this.cam.x = 3700 + this.titleT * 14;
    this.cam.y = 64 * 8 - 140;
    this.clampCam();
  }
  updateCamera(dt) {
    const h = this.hero, look = h.face * 28 + h.vx * 0.18;
    const tx = h.x - W / 2 + look, ty = h.y - H * 0.6 - (h.onGround ? 0 : Math.min(0, h.vy) * 0.05);
    this.cam.x += (tx - this.cam.x) * Math.min(1, 5 * dt);
    const dy = ty - this.cam.y;
    this.cam.y += dy * Math.min(1, (Math.abs(dy) > 40 ? 6 : 3) * dt);
    if (this.boss?.arena && this.boss.active) {
      const a = this.boss.arena;
      this.cam.x = Math.max(a.x0 - 24, Math.min(a.x1 - W + 24, this.cam.x));
    }
    this.clampCam();
  }
  // ---- a frame
  render() {
    const t0 = performance.now(), S = this.screen, d = this.director;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      const k = this.shakeAmp * Math.min(1, this.shakeT * 4), f = Math.floor(this.time * 60);
      sx = Math.round(Math.sin(f * 2.4) * k);
      sy = Math.round(Math.cos(f * 3.7) * k * 0.7);
    }
    S.clear();
    S.camera(this.cam.x + sx, this.cam.y + sy);
    // the sky, the far lands, sky weather
    const sky = this.backdrop.drawSky(S.bg, d.tod, this.time + (this.titleT ?? 0));
    d.drawSky(S);
    this.backdrop.drawFar(S.bg, d.tod, sky);
    // the land
    this.tiles.draw(S.bg);
    this.ents.drawBg(S);
    // people and things
    this.ents.drawAct(S);
    this.npcs.draw(S);
    for (const e of this.enemies) if (Math.abs(e.x - S.camX - 160) < 260) e.draw(S);
    this.bosses.draw(S);
    if (this.scene === "play" && !(this.heroHidden > 0) && !this.status.hidesBody(this.hero)) this.drawHero(S);
    this.skills.draw(S);
    drawLiquids(S, this.world, this.time);
    this.fx.draw(S);
    d.drawFront(S);
    this.ui.drawWorld(S);
    d.light(S);
    this.ui.draw(S);
    S.composite(this.out);
    this.perf.render = performance.now() - t0;
    return this.out;
  }
  drawHero(S) {
    const h = this.hero, flash = h.flash > 0 && Math.floor(h.flash * 20) % 2 === 0;
    // the scarf: a little chain that trails from the neck
    const J = joints(h.pose), nx = h.x + (h.face > 0 ? J.neck[0] : -J.neck[0]), ny = h.y + J.neck[1] + 1;
    h.scarf ??= Array.from({ length: 10 }, () => [nx, ny]);
    const sc = h.scarf;
    sc[0] = [nx - h.face * 1, ny];
    const wind = this.world.biome(h.x).id === "frost" ? 0.5 : 0.2;
    for (let i = 1; i < sc.length; i++) {
      const p = sc[i], q = sc[i - 1];
      p[0] += -h.vx * 0.016 - h.face * (0.6 + wind) + Math.sin(this.time * 8 + i * 0.9) * 0.45;
      p[1] += 0.5 + Math.cos(this.time * 6 + i * 0.7) * 0.3 - Math.max(0, -h.vy) * 0.004 + Math.max(0, h.vy) * -0.006;
      const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1;
      p[0] = q[0] + (dx / d) * 2;
      p[1] = q[1] + (dy / d) * 2;
    }
    const f = S.act, C1 = hex("#f53cd1"), C2 = hex("#a31f8a"), C3 = hex("#ff8fe6"), INK = hex("#120c18");
    const dot = (x, y, c) => {
      x = Math.round(x) - f.ox;
      y = Math.round(y) - f.oy;
      if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.color[y * f.w + x] = c;
    };
    // an outline first, then the cloth: two pixels wide, lit on top
    for (const pass of [0, 1])
      for (let i = 1; i < sc.length; i++) {
        const [x0, y0] = sc[i - 1], [x1, y1] = sc[i];
        for (let k = 0; k <= 2; k++) {
          const x = x0 + (x1 - x0) * (k / 2), y = y0 + (y1 - y0) * (k / 2), w = i < sc.length - 2 ? 1 : 0;
          if (pass === 0) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1 + w]]) dot(x + dx, y + dy, INK);
          else {
            dot(x, y, i < 3 ? C3 : C1);
            if (w) dot(x, y + 1, C2);
          }
        }
      }
    const tint = this.status.has(h, "star") ? [hex(["#ff6a6a", "#ffe066", "#6aff8a", "#6ab0ff", "#c684ff"][Math.floor(this.time * 15) % 5]), 0.45] : null;
    drawRig(S.act, h.pose, this.rpg.costume, h.x, h.y, { flip: h.face < 0, flash, tint, alpha: h.inv > 0 && !flash && h.state !== "dash" ? (Math.floor(this.time * 20) % 2 ? 1 : 0.6) : 1 });
    // a lantern's glow round the hero underground and at night
    const dark = Math.max(this.director.underground, this.director.night * 0.7);
    if (dark > 0.05) glow(S.act, h.x, h.y - 20, 70, hex("#ffd8a0"), 0.32 * dark);
    // dash after-images
    if (h.state === "dash") glow(S.act, h.x - h.face * 10, h.y - 18, 22, hex("#9ad8ff"), 0.25);
  }
}
export { W, H, TS, rect, mix };
