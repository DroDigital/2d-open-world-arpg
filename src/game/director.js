// The world's mood: the hour, the weather (pixelfx weather loops cross-faded across the screen), the light,
// the music, and events: meteor showers, lightning storms, the festival's fireworks, the final eclipse.

import { createFx, createFrame, clearFrame, hex, mix, clamp, smooth, PAL, FX } from "../pfx.js";
import { phase } from "../world/backdrop.js";
import { blendOver, glow } from "../engine/render.js";
import { HIT } from "../data/fxtimes.js";
import { TS } from "../world/tiles.js";

const SKY_WX = new Set(["aurora", "clouds", "shooting-stars", "god-rays"]);
const NIGHT_ONLY = new Set(["aurora", "fireflies", "shooting-stars"]);
const DAY_ONLY = new Set(["god-rays", "cherry-blossoms"]);
const DAY_LEN = 360; // seconds for a whole day

export class Director {
  constructor(g) {
    this.g = g;
    this.tod = 0.32;
    this.weathers = [];
    this.next = 20;
    this.night = 0;
    this.underground = 0;
    this.event = null;
    this.eventCd = 90;
    this.explored = new Uint8Array(Math.ceil(g.world.W / 4) * Math.ceil(g.world.H / 4));
    this.scratch = { back: createFrame(320, 180), front: createFrame(320, 180) };
    this.scratch.front.light = this.scratch.back.light;
    this.fest = 0;
    this.wxLock = null;
  }
  get hour() {
    return Math.floor(this.tod * 24);
  }
  setWeather(id, k = 1) {
    for (const w of this.weathers) if (w.id !== id) w.target = 0;
    if (!id) return;
    let w = this.weathers.find((x) => x.id === id);
    if (!w) {
      const mod = FX["weather/" + id];
      w = { id, inst: createFx(mod, { x: 0, y: 0, seed: 3 }), k: 0, target: k, sky: SKY_WX.has(id) };
      this.weathers.push(w);
    }
    w.target = k;
  }
  update(dt) {
    const g = this.g, h = g.hero;
    this.tod = (this.tod + dt / DAY_LEN) % 1;
    const ph = phase(this.tod);
    this.night = ph.night + ph.dusk * 0.4;
    const depth = g.world.depth(h.x, h.y - 10), reg = g.world.region(h.x, h.y - 10);
    const under = reg && reg.id !== "skyreach" ? clamp((depth - 40) / 90) : 0;
    this.underground += (under - this.underground) * Math.min(1, 2 * dt);
    this.region = reg;
    // explore the map around the hero
    const ex = Math.floor(h.x / TS / 4), ey = Math.floor(h.y / TS / 4), EW = Math.ceil(g.world.W / 4);
    for (let y = ey - 4; y <= ey + 3; y++) for (let x = ex - 6; x <= ex + 6; x++) if (x >= 0 && y >= 0 && x < EW && y < this.explored.length / EW) this.explored[y * EW + x] = 1;
    // weather: now and then, something new for the land and the hour
    const b = g.world.biome(h.x);
    if (this.wxLock) this.setWeather(this.wxLock);
    else if ((this.next -= dt) <= 0 || this.biomeId !== b.id || this.underground > 0.6) {
      this.next = 70 + Math.random() * 80;
      if (this.underground > 0.6) this.setWeather(null);
      else {
        const opts = b.weather.filter((w) => (!NIGHT_ONLY.has(w) || this.night > 0.5) && (!DAY_ONLY.has(w) || this.night < 0.4));
        const pick = this.biomeId !== b.id && this.cur && opts.includes(this.cur) ? this.cur : Math.random() < 0.4 ? null : opts[Math.floor(Math.random() * opts.length)];
        this.cur = pick;
        this.setWeather(pick);
      }
      this.biomeId = b.id;
    }
    // the light-only weathers end when their hour does
    for (const w of this.weathers) {
      if ((NIGHT_ONLY.has(w.id) && this.night < 0.3) || (DAY_ONLY.has(w.id) && this.night > 0.6)) w.target = 0;
      w.k += (w.target - w.k) * Math.min(1, dt * 0.5);
      w.inst.update(dt);
    }
    this.weathers = this.weathers.filter((w) => w.k > 0.01 || w.target > 0);
    this.raining = this.weathers.some((w) => (w.id === "rain" || w.id === "storm") && w.k > 0.4);
    // storms throw lightning at the land near the hero
    const storm = this.weathers.find((w) => w.id === "storm" && w.k > 0.5);
    if (storm && g.scene === "play" && this.underground < 0.3 && Math.random() < dt / 9) {
      const x = h.x + (Math.random() - 0.5) * 260;
      g.combat.areaAttack(null, "lightning/lightning-strike", x, g.world.groundY(x), { r: 30, dmg: 10 + g.rpg.level * 2, el: "shock", status: "shocked", h: 300 });
      g.timers.push({ t: 0.76, fn: () => (g.sfx("thunder"), (this.flash = 0.6)) });
    }
    // events
    this.eventCd -= dt;
    if (!this.event && this.eventCd <= 0 && g.scene === "play" && this.underground < 0.2 && this.night > 0.6 && ["crags", "vale", "frost"].includes(b.id)) {
      this.event = { id: "meteors", t: 0, dur: 35 };
      g.toast("A METEOR SHOWER LIGHTS THE NIGHT", "#ff8a2a");
      this.setWeather("shooting-stars");
    }
    if (this.event) {
      const e = this.event;
      e.t += dt;
      if (e.id === "meteors" && Math.random() < dt / 2.4) {
        const x = h.x + (Math.random() - 0.3) * 300 * (Math.random() < 0.5 ? -1 : 1);
        g.combat.areaAttack(null, "fire/meteor", x, g.world.groundY(x), { r: 40, dmg: 20 + g.rpg.level * 3, el: "fire", status: "burning", shake: 3 });
        // a meteor leaves a glowing shard to pick up, sometimes
        if (Math.random() < 0.3) g.timers.push({ t: 1.2, fn: () => g.ents.drop(x, g.world.groundY(x), "star") });
      }
      if (e.t > e.dur) {
        this.event = null;
        this.eventCd = 240 + Math.random() * 200;
      }
    }
    if (this.flash > 0) this.flash -= dt * 2;
    // music follows where you are
    const theme = g.boss?.active ? "boss" : g.scene === "title" ? "title" : reg && this.underground > 0.4 ? reg.music : b.music;
    g.audio.music(theme, this.night);
  }
  /** Fire a signal flare: light the land around and reveal the map. */
  flare(x, y) {
    const g = this.g;
    g.fx.spawn("projectiles/flare", x, y, { seed: 2 });
    g.sfx("flare");
    const ex = Math.floor(x / TS / 4), ey = Math.floor(y / TS / 4), EW = Math.ceil(g.world.W / 4);
    for (let yy = ey - 20; yy <= ey + 8; yy++) for (let xx = ex - 40; xx <= ex + 40; xx++) if (xx >= 0 && yy >= 0 && xx < EW && yy < this.explored.length / EW) this.explored[yy * EW + xx] = 1;
    g.toast("THE FLARE REVEALS THE LAND");
  }
  /** The village festival: rockets over the fountain at night once the land starts to heal. */
  festival(e, dt) {
    const g = this.g, n = Object.keys(g.rpg.shards).length;
    if (n < 2 || this.night < 0.6 || Math.abs(g.hero.x - e.x) > 400) return;
    if (!g.rpg.flags["festival:" + n]) {
      g.rpg.flags["festival:" + n] = true;
      g.fx.spawn("ui/countdown", 160, 70, { layer: "ui", seed: n });
      g.timers.push({ t: 3, fn: () => {
        g.fx.spawn("ui/confetti", e.x - 30, e.y, { seed: 1 });
        g.fx.spawn("ui/confetti", e.x + 30, e.y, { seed: 2 });
        g.toast("THE FESTIVAL OF LIGHTS BEGINS", "#ffe066");
      } });
      this.fest = 3;
    }
    this.fest -= dt;
    if (this.fest <= 0) {
      this.fest = 1.5 + Math.random() * 2.5;
      const x = e.x + (Math.random() - 0.5) * 160;
      if (Math.random() < 0.5) g.fx.spawn("explosions/firework-rocket", x, e.y, { seed: (Math.random() * 999) | 0, palette: PAL[["candy", "neon", "holy", "cyber", "fire"][Math.floor(Math.random() * 5)]].slice(0, 7) });
      else g.fx.spawn("explosions/firework-burst", x, e.y - 120 - Math.random() * 40, { seed: (Math.random() * 999) | 0, palette: PAL[["candy", "arcane", "heal", "water"][Math.floor(Math.random() * 4)]].slice(0, 7) });
      g.timers.push({ t: 1.1, fn: () => g.sfx("firework") });
    }
  }
  // ---- drawing
  /** Weather and wonders that belong to the sky (behind the land). */
  drawSky(S) {
    for (const w of this.weathers) if (w.sky && w.k > 0.01) this.drawWx(S, w, S.bg, false);
    if (this.g.boss?.id === "king" && this.g.boss.active) {
      // the eclipse hangs over the summit
      this.eclipse ??= createFx(FX["shadow/eclipse"], { x: 0, y: 0, seed: 1 });
      this.eclipse.update(1 / 60);
      this.eclipse.options.x = S.camX + 160;
      this.eclipse.options.y = S.camY + 60;
      this.eclipse.draw(S.bg);
    }
  }
  /** Weather in front of everything. */
  drawFront(S) {
    for (const w of this.weathers) if (!w.sky && w.k > 0.01 && this.underground < 0.95) this.drawWx(S, w, S.front, true);
  }
  drawWx(S, w, target, front) {
    const k = w.k * (front ? 1 - this.underground : 1 - this.underground);
    if (k <= 0.01) return;
    const { back, front: fr } = this.scratch;
    clearFrame(back);
    clearFrame(fr);
    w.inst.options.x = 160;
    w.inst.options.y = 178;
    w.inst.draw(back, "back");
    w.inst.draw(fr, "front");
    const n = 320 * 180, Tc = target.color, L = S.light, B = back.color, F = fr.color, LL = back.light;
    for (let i = 0; i < n; i++) {
      let c = F[i] || B[i];
      if (c) {
        if (F[i] && B[i]) Tc[i] = blendOver(Tc[i], B[i] | 0xff000000, ((B[i] >>> 24) / 255) * k);
        const a = ((c >>> 24) / 255) * k;
        if (a > 0.01) {
          const d = Tc[i], j = 1 - a;
          Tc[i] = (d & 0xff000000) | ((((c >>> 16) & 255) * a + ((d >>> 16) & 255) * j) << 16) | ((((c >>> 8) & 255) * a + ((d >>> 8) & 255) * j) << 8) | (((c & 255) * a + (d & 255) * j) | 0);
        }
      }
      const l = LL[i];
      if (l & 0xffffff) {
        const o = L[i];
        const r = Math.min(255, (o & 255) + (l & 255) * k), gg = Math.min(255, ((o >>> 8) & 255) + ((l >>> 8) & 255) * k), b = Math.min(255, ((o >>> 16) & 255) + ((l >>> 16) & 255) * k);
        L[i] = 0xff000000 | (b << 16) | (gg << 8) | r;
      }
    }
  }
  /** The scene's light: ambient by hour, land and depth. */
  light(S) {
    const ph = phase(this.tod), g = this.g;
    const day = [1, 1, 1], dusk = [0.92, 0.72, 0.68], night = [0.34, 0.38, 0.6];
    let a = [0, 1, 2].map((i) => day[i] * ph.day + dusk[i] * ph.dusk + night[i] * ph.night);
    const reg = this.region, U = this.underground;
    const cave = reg?.id === "magma" ? [0.42, 0.24, 0.2] : reg?.id === "crypt" ? [0.16, 0.14, 0.24] : reg?.id === "temple" ? [0.2, 0.34, 0.38] : reg?.id === "caverns" ? [0.24, 0.2, 0.34] : reg?.id === "icecaves" ? [0.26, 0.32, 0.42] : [0.16, 0.16, 0.22];
    a = a.map((v, i) => v + (cave[i] - v) * U);
    if (this.weathers.some((w) => (w.id === "storm" || w.id === "rain") && w.k > 0.3)) a = a.map((v) => v * 0.8);
    if (g.boss?.id === "king" && g.boss.active) a = [0.32, 0.22, 0.42];
    if (this.flash > 0) a = a.map((v) => v + this.flash * 0.5);
    S.amb = a;
    const dark = Math.max(U, ph.night);
    S.bloom = 0.7 + 0.3 * dark;
    S.gain = 1.5;
  }
}
