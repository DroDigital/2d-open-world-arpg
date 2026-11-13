// The interface: the HUD, words floating in the world, toasts and banners, talking, shopping, the pause menu
// (hero, bag, skills, quests, map, codex of every pixelfx effect, options), the title, transitions and the ending.

import { FX, FX_CATEGORIES, createFx, createAct, actBounds, createFrame, clearFrame, composite, hex, mix, PAL } from "../pfx.js";
import { COL, put, fill, text, width, wrap, panel, bar, icon } from "./draw.js";
import { drawRig } from "../game/rigdraw.js";
import * as POSE from "../game/poses.js";
import { SKILLS, SCHOOLS } from "../data/skills.js";
import { RARITY, ELEMENTS, BASES, CONSUMABLES, MATERIALS, SHARDS, AFFIXES } from "../data/items.js";
import { WEAPONS } from "../data/weapons.js";
import { BIOMES } from "../world/biomes.js";
import { PEOPLE } from "../game/npcs.js";
import { QUESTS } from "../game/quests.js";
import { xpFor } from "../game/rpg.js";
import { T, TS, SOLID_T, LIQUID_T } from "../world/tiles.js";
import { USES } from "../data/fxuse.js";

const TABS = ["HERO", "BAG", "SKILLS", "QUESTS", "MAP", "CODEX", "OPTIONS"];
const MID = { "transitions/blinds": 1, "transitions/burn-away": 1.5, "transitions/crt-off": 0.9, "transitions/diamond-wipe": 1, "transitions/glitch-wipe": 0.85, "transitions/iris": 1.05, "transitions/pixel-dissolve": 1.05, "transitions/shatter-wipe": 1.2, "transitions/slash-wipe": 0.8, "transitions/star-iris": 1.05 };
const STAT_NAMES = { atk: "ATTACK", spell: "SPELL", hp: "HEALTH", mp: "MANA", crit: "CRIT %", def: "DEFENSE", aspd: "SPEED %", move: "MOVE %", regen: "REGEN", leech: "LEECH %", gold: "GOLD %", cdr: "RECALL %" };

export class UI {
  constructor(g) {
    this.g = g;
    this.nums = [];
    this.parts = [];
    this.toasts = [];
    this.menu = null;
    this.dlg = null;
    this.shop = null;
    this.trans = null;
    this.bannerT = 0;
    this.intro = null;
    this.title = { sel: 0, t: 0 };
    this.opts = { shake: true, fps: false };
    this.codex = { cat: 0, sel: 0, inst: null, id: null, frame: null };
    this.fxNums = 0;
    this.mapImg = null;
  }
  get paused() {
    return !!(this.menu || this.dlg || this.shop) || this.g.scene !== "play";
  }
  get blocking() {
    return this.paused || !!(this.trans && this.trans.block);
  }
  // ---- services
  particle(x, y, vx, vy, c) {
    if (this.parts.length < 300) this.parts.push({ x, y, vx, vy, c, t: 0, life: 0.4 + Math.random() * 0.4 });
  }
  number(x, y, str, kind, color) {
    const g = this.g;
    // ordinary hits use the library's damage number, a few at a time
    if (kind === "hit" && this.fxNums < 8) {
      this.fxNums++;
      g.fx.spawn("ui/damage-number", x, y + 10, { text: str, seed: (x * 7) | 0, onEnd: () => this.fxNums--, palette: ["#2a0a10", "#5a1420", "#9a2030", "#d83a3a", "#ff6a5a", "#ffa08a", "#ffe0d8", "#ffffff"] });
      return;
    }
    const c = color ? hex(color) : { hurt: COL.red, heal: COL.green, gold: COL.gold, dot: hex("#c8a0a0"), status: COL.text }[kind] ?? COL.text;
    this.nums.push({ x, y, str, c, t: 0, vy: -38, big: kind === "hurt" });
  }
  toast(str, color) {
    this.toasts.push({ str, c: color ? hex(color) : COL.text, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  banner(str) {
    this.bannerStr = str;
    this.bannerT = 3;
  }
  bossIntro(D) {
    this.intro = { D, t: 0 };
  }
  markOver(x, y, ch) {
    (this.marks ??= []).push([x, y, ch]);
  }
  say(name, str, opts = []) {
    this.dlg = { name, lines: wrap(str, 280), full: str, chars: 0, options: opts.length ? opts : [{ label: "OK", fn: () => this.closeDlg() }], sel: 0 };
    this.g.sfx("ui");
  }
  lore(e) {
    const L = ["RECORD 7: THE LANTERN DRAWS ITS POWER FROM SIX SHARDS. SHOULD ANY BE TAKEN, THE NIGHT WILL NOT END.", "RECORD 12: THE KING ASKED FOR THE LANTERN'S LIGHT TO BE HIS ALONE. THE COUNCIL REFUSED.", "RECORD 19: CORES OVERLOADING. EVACUATE THE SPIRE. THE PAD STILL CARRIES TO THE SUMMIT.", "RECORD 3: SKY ISLES TETHERED. LIFT BEAM ACTIVE AT THE WESTERN RUIN."];
    this.say("ANCIENT RECORD", L[Math.abs(Math.round(e.x)) % L.length]);
  }
  closeDlg() {
    this.dlg = null;
    if (this.talkingTo) this.talkingTo.talking = false;
    this.talkingTo = null;
  }
  // ---- talking to people
  talk(n) {
    const g = this.g, D = n.def, opts = [];
    n.talking = true;
    this.talkingTo = n;
    n.line = ((n.line ?? -1) + 1) % D.lines.length;
    for (const id of D.quests) {
      const s = g.quests.state[id], q = QUESTS[id];
      if (id === "final" || (id === "cores" && !g.rpg.shards.tyrant && !g.rpg.shards.engine && g.rpg.level < 12)) continue;
      if (!s) opts.push({ label: "QUEST: " + q.name, fn: () => this.say(D.name, q.desc, [{ label: "ACCEPT", fn: () => (g.quests.take(id), this.closeDlg()) }, { label: "NOT NOW", fn: () => this.closeDlg() }]) });
      else if (s.done && !s.turnedIn) opts.push({ label: "COMPLETE: " + q.name, fn: () => (g.quests.turnIn(id) ? this.say(D.name, "Thank you. This is yours.") : this.say(D.name, "You don't have it all yet.")) });
    }
    if (D.shop) opts.push({ label: D.shop === "inn" ? "REST (FREE)" : "TRADE", fn: () => (D.shop === "inn" ? (this.closeDlg(), g.rest()) : this.openShop(D.shop)) });
    if (D.shop === "mystic") opts.push({ label: "LEARN SKILLS", fn: () => (this.closeDlg(), this.open("SKILLS")) });
    opts.push({ label: "BYE", fn: () => this.closeDlg() });
    this.say(D.name, D.lines[n.line], opts);
    this.talkingTo = n;
    n.talking = true;
  }
  openShop(kind) {
    const g = this.g, R = g.rpg, lv = R.level;
    this.dlg = null;
    let stock = [];
    const day = Math.floor(g.time / 360);
    if (kind === "smith") {
      if (!this.smithStock || this.smithDay !== day || this.smithLv !== lv) {
        this.smithDay = day;
        this.smithLv = lv;
        const ids = ["sword", "greatsword", "dagger", "spear", "hammer", "scythe", "claw", "whip", "bow", "pistol", "tunic", "hood", "boots"];
        this.smithStock = ids.map((id, i) => R.makeItem(id, lv, i % 4 === 0 ? 2 : 1));
        if (lv >= 10) this.smithStock.push(R.makeItem("shotgun", lv, 1), R.makeItem("smg", lv, 1), R.makeItem("launcher", lv, 2));
      }
      stock = this.smithStock.map((it) => ({ label: it.name, price: Math.round(it.value * 1.4), item: it, buy: () => (R.addGear(it), (this.smithStock = this.smithStock.filter((x) => x !== it))) }));
    } else if (kind === "alchemist") stock = ["potion", "ether", "elixir", "fury", "bomb", "flare", "firework"].map((id) => ({ label: CONSUMABLES[id].name, price: CONSUMABLES[id].price, desc: CONSUMABLES[id].desc, buy: () => R.give(id) }));
    else if (kind === "mystic") stock = ["feather", "scroll", "star"].map((id) => ({ label: CONSUMABLES[id].name, price: CONSUMABLES[id].price, desc: CONSUMABLES[id].desc, buy: () => R.give(id) }));
    this.shop = { kind, stock, sel: 0, mode: "buy" };
  }
  // ---- transitions: a pixelfx wipe that covers the screen, a change, and the wipe opening again
  transition(id, mid, o = {}) {
    const mod = FX[id];
    this.trans = { inst: createFx(mod, { x: 0, y: 0, seed: 3 }), t: 0, mid: MID[id] ?? mod.meta.duration / 2, fn: mid, fired: !mid, dur: mod.meta.duration, block: !o.half };
  }
  open(tab = "HERO", o = {}) {
    if (tab === "map") tab = "MAP";
    if (tab === "ending") {
      this.menu = { tab: "ENDING", t: 0 };
      return;
    }
    this.menu = { tab, sel: 0, scroll: 0, travel: o.travel, mapSel: 0 };
    this.g.sfx("ui", { hi: true });
  }
  close() {
    this.menu = null;
    this.codex.inst = null;
  }
  // ---- input and time
  update(dt) {
    const g = this.g, inp = g.input;
    this.fxNumsT = (this.fxNumsT ?? 0) + dt;
    for (const n of this.nums) (n.t += dt), (n.y += n.vy * dt), (n.vy *= 0.94);
    this.nums = this.nums.filter((n) => n.t < 1.1);
    for (const p of this.parts) (p.t += dt), (p.vy += 240 * dt), (p.x += p.vx * dt), (p.y += p.vy * dt), (p.vx *= 0.96);
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 3.2);
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.intro && (this.intro.t += dt) > 3) this.intro = null;
    if (this.trans) {
      const tr = this.trans;
      tr.t += dt;
      tr.inst.update(dt);
      if (!tr.fired && tr.t >= tr.mid) {
        tr.fired = true;
        tr.fn?.();
      }
      if (tr.t >= tr.dur) this.trans = null;
    }
    if (g.scene === "title") return this.titleInput(dt);
    if (this.dlg) return this.dlgInput(dt);
    if (this.shop) return this.shopInput();
    if (this.menu) return this.menuInput(dt);
    if (inp.pressed.pause || inp.pressed.menu) this.open("HERO");
    else if (inp.pressed.inv) this.open("BAG");
    else if (inp.pressed.map) this.open("MAP");
  }
  nav(n, inp) {
    if (inp.pressed.up) return (this.g.sfx("ui"), -1);
    if (inp.pressed.down) return (this.g.sfx("ui"), 1);
    void n;
    return 0;
  }
  titleInput(dt) {
    const g = this.g, inp = g.input, T = this.title;
    T.t += dt;
    const items = this.titleItems();
    T.sel = (T.sel + this.nav(items.length, inp) + items.length) % items.length;
    if (inp.pressed.confirm || inp.pressed.attack || inp.pressed.jump) items[T.sel].fn();
  }
  titleItems() {
    const g = this.g, has = typeof localStorage !== "undefined" && !!localStorage.getItem("shardlight-save");
    const items = [];
    if (has) items.push({ label: "CONTINUE", fn: () => this.startGame(true) });
    items.push({ label: "NEW GAME", fn: () => this.startGame(false) });
    items.push({ label: "CODEX: 244 EFFECTS", fn: () => ((this.g.scene = "play"), (this.fromTitle = true), this.open("CODEX")) });
    items.push({ label: "CONTROLS", fn: () => this.say("CONTROLS", "MOVE: A/D OR ARROWS. JUMP: SPACE OR K. ATTACK: J OR X. DASH: SHIFT OR L. SKILLS: 1-4. INTERACT: E OR UP. POTION: Q. BAG: TAB. MAP: M. MENU: ESC. A GAMEPAD WORKS TOO.") });
    void g;
    return items;
  }
  startGame(load) {
    const g = this.g;
    this.transition("transitions/diamond-wipe", () => {
      g.scene = "play";
      if (load) g.load();
      else {
        g.quests.take("main");
        this.say("ELDER MAREN", "You're awake. Good. The Lantern on the Stormspire has gone dark and the night grows longer every day. Come and find me by the hall when you're ready - the one with the brick front.");
      }
      g.snapCamera();
      g.fx.spawn("spawn/respawn-beam", g.hero.x, g.hero.y, { actor: g.heroActor(), seed: 4, memo: false });
    });
  }
  dlgInput(dt) {
    const d = this.dlg, inp = this.g.input;
    d.chars += dt * 90;
    if ((d.chars | 0) % 4 === 0 && d.chars < d.full.length) this.g.sfx("talk");
    if (d.chars < d.full.length) {
      if (inp.pressed.confirm || inp.pressed.attack || inp.pressed.interact) d.chars = 1e9;
      return;
    }
    d.sel = (d.sel + this.nav(d.options.length, inp) + d.options.length) % d.options.length;
    if (inp.pressed.confirm || inp.pressed.attack || inp.pressed.interact) {
      this.g.input.eat("interact");
      d.options[d.sel].fn();
    } else if (inp.pressed.back) this.closeDlg();
  }
  shopInput() {
    const s = this.shop, g = this.g, inp = g.input, R = g.rpg;
    const list = s.mode === "buy" ? s.stock : R.bag.map((it) => ({ label: it.name, price: Math.round(it.value * 0.4), item: it, sell: true }));
    if (inp.pressed.left || inp.pressed.right || inp.pressed.tabL || inp.pressed.tabR) (s.mode = s.mode === "buy" ? "sell" : "buy"), (s.sel = 0), g.sfx("ui");
    if (list.length) s.sel = (s.sel + this.nav(list.length, inp) + list.length) % list.length;
    if ((inp.pressed.confirm || inp.pressed.attack) && list[s.sel]) {
      const it = list[s.sel];
      if (it.sell) {
        R.sell(it.item);
        g.sfx("pickup", { kind: "gold" });
      } else if (R.gold >= it.price) {
        R.gold -= it.price;
        it.buy();
        g.sfx("pickup", { kind: "gold" });
        g.toast("BOUGHT " + it.label.toUpperCase());
      } else g.toast("NOT ENOUGH GOLD", "#ff4a5a");
      s.sel = Math.max(0, Math.min(s.sel, (s.mode === "buy" ? s.stock : R.bag).length - 1));
    }
    if (inp.pressed.back || inp.pressed.pause) this.shop = null;
  }
  menuInput(dt) {
    const m = this.menu, g = this.g, inp = g.input;
    m.t = (m.t ?? 0) + dt;
    if (m.tab === "ENDING") {
      if (m.t > 3 && (inp.pressed.confirm || inp.pressed.attack || inp.pressed.pause)) this.close();
      return;
    }
    if (inp.pressed.back || inp.pressed.pause || (inp.pressed.inv && m.tab === "BAG") || (inp.pressed.map && m.tab === "MAP")) {
      this.close();
      g.sfx("uiback");
      if (this.fromTitle) ((g.scene = "title"), (this.fromTitle = false));
      return;
    }
    const ti = TABS.indexOf(m.tab);
    const tabMove = inp.pressed.tabL ? -1 : inp.pressed.tabR ? 1 : 0;
    if (tabMove && !this.fromTitle) {
      m.tab = TABS[(ti + tabMove + TABS.length) % TABS.length];
      m.sel = 0;
      m.scroll = 0;
      g.sfx("ui", { hi: true });
      return;
    }
    TAB_INPUT[m.tab]?.(this, m, inp);
  }
  // ---- drawing in the world
  drawWorld(S) {
    const f = S.front, g = this.g, cx = S.camX, cy = S.camY;
    for (const p of this.parts) put(S.act, p.x - cx, p.y - cy, p.c);
    // enemy health bars
    for (const e of g.enemies) {
      if (e.hp >= e.maxHp || e.def.ambient) continue;
      const x = Math.round(e.x - cx - 10), y = Math.round(e.y - e.h - cy - 8);
      if (x < -20 || x > 330 || y < -10 || y > 190) continue;
      fill(f, x - 1, y - 1, 22, 4, COL.ink);
      fill(f, x, y, 20, 2, COL.redD);
      fill(f, x, y, Math.round((20 * Math.max(0, e.hp)) / e.maxHp), 2, COL.red);
      if (e.level) text(f, String(e.level), x - 6, y - 2, COL.dim, { shadow: COL.ink });
    }
    for (const n of this.nums) text(f, n.str, n.x - cx, n.y - cy, n.c, { outline: COL.ink, a: Math.min(1, (1.1 - n.t) * 3), k: n.big ? 1 : 1, font: n.big ? "big" : "mini", align: "center" });
    for (const [x, y, ch] of this.marks ?? []) {
      const b = Math.round(Math.sin(g.time * 5) * 2);
      text(f, ch, x - cx, y - cy + b, COL.gold, { font: "big", outline: COL.ink, align: "center" });
    }
    this.marks = [];
    // the prompt over whatever you can use
    const pr = g.prompts;
    if (pr && g.scene === "play" && !this.paused) {
      const e = pr.e, x = e.x - cx, y = (e.y ?? 0) - cy - 50;
      text(f, "E " + pr.label, x, y + Math.round(Math.sin(g.time * 4)), COL.text, { outline: COL.ink, align: "center" });
    }
  }
  // ---- drawing the interface
  draw(S) {
    const g = this.g, f = S.ui;
    if (g.scene === "title") this.drawTitle(f);
    else if (g.scene === "play" && !this.fromTitle) this.drawHud(f);
    if (this.intro) this.drawIntro(f);
    if (this.bannerT > 0 && !this.menu) {
      const a = Math.min(1, this.bannerT, (3 - this.bannerT) * 3);
      text(f, this.bannerStr, 160, 48, COL.text, { font: "big", align: "center", outline: COL.ink, a });
      fill(f, 160 - width(this.bannerStr, "big") / 2, 58, width(this.bannerStr, "big"), 1, COL.gold, a);
    }
    this.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 6, (3.2 - t.t) * 2);
      text(f, t.str, 160, 64 + i * 9, t.c, { align: "center", outline: COL.ink, a });
    });
    if (this.menu) this.drawMenu(f);
    if (this.shop) this.drawShop(f);
    if (this.dlg) this.drawDlg(f);
    if (this.trans) this.trans.inst.draw(f);
    if (this.opts.fps) text(f, `${(1000 / Math.max(1, g.frameMs ?? 16)).toFixed(0)}FPS U${g.perf.update.toFixed(1)} R${g.perf.render.toFixed(1)} FX${g.fx.list.length}`, 4, 172, COL.green);
  }
  drawHud(f) {
    const g = this.g, R = g.rpg, S = R.stats, h = g.hero;
    // health, mana, experience
    text(f, "LV" + R.level, 6, 5, COL.gold);
    bar(f, 24, 5, 76, 5, Math.max(0, R.hp) / S.maxHp, COL.red, COL.redD, { ghost: this.hpGhost });
    this.hpGhost = Math.max(R.hp / S.maxHp, (this.hpGhost ?? 1) - 0.004);
    text(f, Math.ceil(R.hp) + "/" + S.maxHp, 62, 5, COL.text, { align: "center", outline: COL.ink });
    bar(f, 24, 13, 60, 3, R.mp / S.maxMp, COL.blue, COL.blueD);
    bar(f, 24, 19, 60, 1, R.xp / xpFor(R.level), COL.xp, hex("#2a1a40"));
    if (R.points || g.skills.points) text(f, "+", 89, 12, COL.gold, { outline: COL.ink });
    // breath under water
    if (h.breath < 10) bar(f, h.x - g.screen.camX - 10, h.y - g.screen.camY - 50, 20, 2, Math.max(0, h.breath) / 10, hex("#c8f0ff"), hex("#1a3a5a"));
    // the six shards
    Object.keys(SHARDS).forEach((k, i) => {
      const got = R.shards[k], c = got ? hex(SHARDS[k].pal[5]) : hex("#2a2638");
      const x = 7 + i * 7, y = 25;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) put(f, x + dx, y + dy, c);
      if (got) put(f, x + 1, y, 0xffffffff);
    });
    // gold
    text(f, R.gold + "G", 246, 47, COL.gold, { align: "right", outline: COL.ink });
    // the minimap
    this.minimap(f, 250, 4, 66, 40);
    // skill slots and the potion
    for (let i = 0; i < 4; i++) {
      const id = g.skills.slots[i], x = 6 + i * 21, y = 158;
      panel(f, x, y, 19, 19, { bg: COL.panel2 });
      if (!id) continue;
      const s = SKILLS[id], cd = g.skills.cd[id] ?? 0, sch = SCHOOLS[s.school];
      icon(f, s.school, x + 3, y + 3, R.mp >= s.mp ? hex(sch.color) : hex("#4a4458"));
      if (cd > 0) {
        const k = cd / (s.cd * (1 - S.cdr));
        fill(f, x + 1, y + 1 + Math.round(17 * (1 - k)), 17, Math.round(17 * k), COL.ink, 0.6);
      }
      text(f, String(i + 1), x + 1, y - 6, COL.dim);
    }
    panel(f, 92, 158, 19, 19, { bg: COL.panel2 });
    icon(f, "potion", 95, 161, (R.items.potion ?? 0) ? COL.red : hex("#4a4458"));
    text(f, String(R.items.potion ?? 0), 109, 171, COL.text, { align: "right", outline: COL.ink });
    text(f, "Q", 93, 152, COL.dim);
    // combo
    if (g.comboN >= 3) text(f, g.comboN + " HITS", 314, 60, mix(COL.gold, COL.red, Math.min(1, g.comboN / 40)), { align: "right", font: "big", outline: COL.ink });
    // the boss
    const b = g.boss;
    if (b && b.active && !b.dead) {
      bar(f, 60, 168, 200, 4, Math.max(0, b.hp) / b.maxHp, b.phase > 1 ? hex("#ff3a6a") : COL.red, COL.redD);
      text(f, b.D.name, 160, 160, COL.text, { align: "center", outline: COL.ink });
    }
    // the time of day
    const hr = g.director.hour;
    text(f, (hr < 10 ? "0" : "") + hr + ":00", 316, 47, COL.dim, { align: "right" });
  }
  minimap(f, X, Y, W, H) {
    const g = this.g, w = g.world, h = g.hero, tx0 = Math.floor(h.x / TS) - (W >> 1), ty0 = Math.floor(h.y / TS) - (H >> 1);
    panel(f, X - 1, Y - 1, W + 2, H + 2, { bg: COL.ink, a: 0.8 });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = w.tile(tx0 + x, ty0 + y);
        let c = 0;
        if (SOLID_T[t]) c = t === T.GRASS ? hex("#4a8a3a") : t === T.SNOW ? hex("#c8d8ec") : hex("#5a5470");
        else if (LIQUID_T[t]) c = t === T.LAVA ? hex("#ff6a2a") : t === T.WATER ? hex("#2a6ac8") : hex("#7ac82a");
        else if (w.wall(tx0 + x, ty0 + y)) c = hex("#211d2d");
        if (c) put(f, X + x, Y + y, c, 0.9);
      }
    put(f, X + (W >> 1), Y + (H >> 1), 0xffffffff);
    put(f, X + (W >> 1), Y + (H >> 1) - 1, 0xffffffff);
    for (const e of g.enemies) {
      const ex = Math.floor(e.x / TS) - tx0, ey = Math.floor(e.y / TS) - ty0 - 1;
      if (ex >= 0 && ey >= 0 && ex < W && ey < H && !e.def.ambient) put(f, X + ex, Y + ey, COL.red);
    }
  }
  drawIntro(f) {
    const it = this.intro, a = Math.min(1, it.t * 3, (3 - it.t) * 2), D = it.D;
    fill(f, 0, 70, 320, 34, COL.ink, 0.7 * a);
    text(f, D.name, 160, 75, hex("#ffffff"), { font: "big", align: "center", a, outline: hex("#3a1a2a") });
    text(f, D.title, 160, 92, COL.gold, { align: "center", a });
  }
  drawDlg(f) {
    const d = this.dlg, n = Math.floor(d.chars);
    const h = 18 + d.lines.length * 7 + (d.chars >= d.full.length ? d.options.length * 8 : 0);
    const y = 176 - h;
    panel(f, 10, y, 300, h);
    text(f, d.name, 16, y + 4, COL.gold);
    let used = 0;
    d.lines.forEach((ln, i) => {
      const show = ln.slice(0, Math.max(0, n - used));
      used += ln.length + 1;
      text(f, show, 16, y + 13 + i * 7, COL.text);
    });
    if (d.chars >= d.full.length)
      d.options.forEach((o, i) => {
        const yy = y + 14 + d.lines.length * 7 + i * 8;
        if (i === d.sel) fill(f, 14, yy - 1, 292, 7, COL.sel, 0.25);
        text(f, (i === d.sel ? "> " : "  ") + o.label, 18, yy, i === d.sel ? COL.text : COL.dim);
      });
  }
  drawShop(f) {
    const s = this.shop, g = this.g, R = g.rpg;
    panel(f, 20, 14, 280, 152);
    text(f, s.kind === "smith" ? "BRANN'S FORGE" : s.kind === "alchemist" ? "IVY'S APOTHECARY" : "THE SEER'S WARES", 30, 20, COL.gold, { font: "big" });
    text(f, (s.mode === "buy" ? "[BUY]  SELL" : " BUY  [SELL]") + "   LEFT/RIGHT", 290, 22, COL.dim, { align: "right" });
    text(f, R.gold + "G", 290, 32, COL.gold, { align: "right" });
    const list = s.mode === "buy" ? s.stock : R.bag.map((it) => ({ label: it.name, price: Math.round(it.value * 0.4), item: it }));
    const top = Math.max(0, s.sel - 12);
    list.slice(top, top + 14).forEach((it, j) => {
      const i = top + j, y = 42 + j * 8;
      if (i === s.sel) fill(f, 26, y - 1, 160, 7, COL.sel, 0.25);
      const c = it.item ? hex(RARITY[it.item.rarity].color) : COL.text;
      text(f, it.label.slice(0, 30), 30, y, c);
      text(f, it.price + "G", 184, y, R.gold >= it.price || s.mode === "sell" ? COL.gold : COL.red, { align: "right" });
    });
    const sel = list[s.sel];
    if (sel) {
      if (sel.item) this.itemCard(f, sel.item, 192, 42);
      else wrap(sel.desc ?? "", 100).forEach((ln, i) => text(f, ln, 192, 42 + i * 7, COL.text));
    }
    text(f, "SPACE: " + (s.mode === "buy" ? "BUY" : "SELL") + "   ESC: LEAVE", 160, 156, COL.dim, { align: "center" });
  }
  itemCard(f, it, x, y) {
    const R = this.g.rpg, B = BASES[it.base], worn = R.equip[it.slot];
    text(f, RARITY[it.rarity].name + " " + (B.cls ? WEAPONS[B.cls].name : it.slot), x, y, hex(RARITY[it.rarity].color));
    let yy = y + 9;
    if (it.dmg) (text(f, "DAMAGE " + it.dmg, x, yy, COL.text), (yy += 7));
    for (const [k, v] of Object.entries(it.mods)) (text(f, "+" + v + " " + (STAT_NAMES[k] ?? k), x, yy, COL.green), (yy += 7));
    if (it.el) (text(f, ELEMENTS[it.el].name.toUpperCase() + " ELEMENT", x, yy, hex(ELEMENTS[it.el].color)), (yy += 7));
    text(f, "LEVEL " + it.level, x, yy, COL.dim);
    yy += 9;
    if (worn && worn !== it) {
      const d = R.score(it) - R.score(worn);
      text(f, d > 0 ? "BETTER THAN WORN" : d < 0 ? "WORSE THAN WORN" : "SAME AS WORN", x, yy, d > 0 ? COL.green : d < 0 ? COL.red : COL.dim);
    }
  }
  drawTitle(f) {
    const T = this.title, t = T.t;
    // the name, in gold, with a light breathing behind it
    const name = "SHARDLIGHT";
    const grad = (gx, gy) => [hex("#fff6c4"), hex("#ffe066"), hex("#f0b424"), hex("#c48412"), hex("#86520c")][Math.min(4, Math.floor(gy / 1.6))];
    const w = width(name, "big", 4), x0 = 160 - w / 2, y0 = 34;
    for (let k = 0; k < 2; k++) text(f, name, 160 + k, y0 + 2 + k, COL.ink, { font: "big", k: 4, align: "center", shadow: false });
    // per-pixel gradient letters
    const str = name;
    let cx = x0;
    for (const ch of str) {
      const cw = width(ch, "big", 4);
      for (let yy = 0; yy < 28; yy++) {
        // draw via text then recolor rows
      }
      text(f, ch, cx, y0, grad(0, Math.floor(((t * 3 + cx / 40) % 3))), { font: "big", k: 4, shadow: false });
      cx += cw + 4;
    }
    for (let i = 0; i < 80; i++) {
      const gx = 160 + Math.cos(t * 0.7 + i) * (60 + (i % 7) * 12), gy = 48 + Math.sin(t * 0.9 + i * 1.3) * 18;
      if (Math.sin(t * 3 + i) > 0.6) put(f, gx, gy, hex("#fff6c4"));
    }
    for (let y = 0; y < 30; y++) for (let x = -90; x <= 90; x++) {
      const d = Math.hypot(x / 90, (y - 15) / 22);
      if (d < 1 && (x + y) % 2 === 0) {
        const i = (y0 - 1 + y) * 320 + 160 + x;
        const l = f.light[i];
        const add = Math.round(60 * (1 - d) * (0.8 + 0.2 * Math.sin(t * 2)));
        f.light[i] = 0xff000000 | (Math.min(255, ((l >>> 16) & 255) + add * 0.4) << 16) | (Math.min(255, ((l >>> 8) & 255) + add * 0.8) << 8) | Math.min(255, (l & 255) + add);
      }
    }
    text(f, "AN OPEN WORLD PAINTED IN PIXELFX", 160, 70, COL.text, { align: "center", outline: COL.ink });
    const items = this.titleItems();
    items.forEach((it, i) => {
      const y = 96 + i * 12, sel = i === T.sel;
      if (sel) fill(f, 100, y - 2, 120, 10, COL.ink, 0.6);
      text(f, (sel ? "> " : "") + it.label + (sel ? " <" : ""), 160, y, sel ? COL.gold : COL.text, { align: "center", outline: COL.ink, font: sel ? "big" : "mini" });
    });
    text(f, "ARROWS + SPACE   GAMEPAD READY", 160, 168, COL.dim, { align: "center", outline: COL.ink });
  }
  drawMenu(f) {
    const m = this.menu;
    if (m.tab === "ENDING") return this.drawEnding(f, m);
    fill(f, 0, 0, 320, 180, COL.ink, 0.55);
    panel(f, 6, 6, 308, 168);
    if (!this.fromTitle)
      TABS.forEach((t, i) => {
        const x = 12 + i * 43, on = t === m.tab;
        if (on) fill(f, x - 3, 10, width(t) + 6, 9, COL.sel, 0.35);
        text(f, t, x, 12, on ? COL.text : COL.dim);
      });
    text(f, "[ ] TABS   ESC CLOSE", 308, 166, COL.dim, { align: "right" });
    TAB_DRAW[m.tab]?.(this, f, m);
  }
  drawEnding(f, m) {
    const t = m.t, a = Math.min(1, t / 2);
    fill(f, 0, 0, 320, 180, COL.ink, Math.min(0.85, t / 2));
    const lines = ["THE LANTERN BURNS AGAIN.", "", "THE SIX SHARDS SING IN ITS GLASS,", "AND THE LONG NIGHT LIFTS FROM THE LANDS.", "", "THE WORLD IS STILL WIDE, AND STILL YOURS.", "", "SHARDLIGHT", "EVERY EFFECT: PIXELFX BY PATCH (MIT)", "WITH SPRITE FUSION'S VFX BY HUGO DUPREZ", "AND HOLLOW CROWN'S ACTING", "", "THANK YOU FOR PLAYING"];
    lines.forEach((ln, i) => text(f, ln, 160, 30 + i * 9 - Math.max(0, t - 6) * 4, i === 7 ? COL.gold : COL.text, { align: "center", a, font: i === 7 ? "big" : "mini" }));
    if (!this.endFx) {
      this.endFx = true;
      this.g.fx.spawn("ui/confetti", 160, 170, { layer: "ui", seed: 9 });
      this.g.director.wxLock = "aurora";
    }
  }
}

// ---- the tabs
const TAB_INPUT = {
  HERO(ui, m, inp) {
    const g = ui.g, attrs = ["vigor", "might", "focus", "agility"];
    m.sel = (m.sel + ui.nav(4, inp) + 4) % 4;
    if ((inp.pressed.confirm || inp.pressed.attack) && g.rpg.spend(attrs[m.sel])) g.sfx("equip");
  },
  BAG(ui, m, inp) {
    const g = ui.g, R = g.rpg, rows = bagRows(R);
    m.sel = Math.max(0, Math.min(rows.length - 1, m.sel + ui.nav(rows.length, inp)));
    const r = rows[m.sel];
    if (!r) return;
    if (inp.pressed.confirm || inp.pressed.attack) {
      if (r.gear && !r.worn) R.equipItem(r.gear);
      else if (r.use) useItem(g, r.use);
    }
    if (inp.pressed.interact && r.gear && !r.worn) (R.sell(r.gear), g.sfx("pickup", { kind: "gold" }));
  },
  SKILLS(ui, m, inp) {
    const g = ui.g, list = Object.keys(SKILLS);
    m.sel = (m.sel + ui.nav(list.length, inp) + list.length) % list.length;
    const id = list[m.sel], S = g.skills;
    if (inp.pressed.confirm || inp.pressed.attack) {
      if (S.known.has(id)) {
        const slot = S.slots.indexOf(id) >= 0 ? (S.slots.indexOf(id) + 1) % 4 : S.slots.findIndex((x) => !x) >= 0 ? S.slots.findIndex((x) => !x) : (m.nextSlot = ((m.nextSlot ?? -1) + 1) % 4);
        const old = S.slots.indexOf(id);
        if (old >= 0) S.slots[old] = null;
        S.slots[slot] = id;
        g.sfx("equip");
      } else if (S.learn(id)) g.toast("LEARNED " + SKILLS[id].name.toUpperCase(), SCHOOLS[SKILLS[id].school].color);
      else g.sfx("uiback");
    }
    for (let i = 0; i < 4; i++)
      if (inp.pressed["s" + (i + 1)] && S.known.has(id)) {
        const old = S.slots.indexOf(id);
        if (old >= 0) S.slots[old] = null;
        S.slots[i] = id;
        g.sfx("equip");
      }
  },
  QUESTS(ui, m, inp) {
    const n = ui.g.quests.list().length || 1;
    m.sel = (m.sel + ui.nav(n, inp) + n) % n;
  },
  MAP(ui, m, inp) {
    const g = ui.g, ways = g.world.ents.filter((e) => e.kind === "waystone" && g.rpg.flags["way:" + e.id]);
    if (inp.pressed.left || inp.pressed.up) (m.mapSel = (m.mapSel - 1 + ways.length) % ways.length), g.sfx("ui");
    if (inp.pressed.right || inp.pressed.down) (m.mapSel = (m.mapSel + 1) % ways.length), g.sfx("ui");
    if ((inp.pressed.confirm || inp.pressed.attack) && ways[m.mapSel]) {
      if (g.boss) return g.toast("NO ESCAPE FROM A WARDEN'S ARENA", "#ff4a5a");
      g.travel(ways[m.mapSel].id);
    }
  },
  CODEX(ui, m, inp) {
    const C = ui.codex, cats = FX_CATEGORIES, list = Object.keys(FX).filter((id) => id.startsWith(cats[C.cat].id + "/"));
    if (inp.pressed.left) (C.cat = (C.cat - 1 + cats.length) % cats.length), (C.sel = 0), ui.g.sfx("ui");
    if (inp.pressed.right) (C.cat = (C.cat + 1) % cats.length), (C.sel = 0), ui.g.sfx("ui");
    C.sel = (C.sel + ui.nav(list.length, inp) + list.length) % list.length;
    if (inp.pressed.confirm || inp.pressed.attack) C.id = null;
  },
  OPTIONS(ui, m, inp) {
    const g = ui.g, A = g.audio, rows = optionRows(ui);
    m.sel = (m.sel + ui.nav(rows.length, inp) + rows.length) % rows.length;
    const r = rows[m.sel], d = inp.pressed.left ? -1 : inp.pressed.right ? 1 : 0;
    if (d && r.adj) (r.adj(d), g.sfx("ui"));
    if ((inp.pressed.confirm || inp.pressed.attack) && r.fn) r.fn();
    void A;
  },
};

function optionRows(ui) {
  const g = ui.g, A = g.audio, v = (k) => Math.round(A.vol[k] * 10);
  return [
    { label: "MASTER VOLUME " + "#".repeat(v("master")) + "-".repeat(10 - v("master")), adj: (d) => A.setVolume("master", Math.max(0, Math.min(1, A.vol.master + d * 0.1))) },
    { label: "MUSIC VOLUME  " + "#".repeat(v("music")) + "-".repeat(10 - v("music")), adj: (d) => A.setVolume("music", Math.max(0, Math.min(1, A.vol.music + d * 0.1))) },
    { label: "EFFECTS       " + "#".repeat(v("sfx")) + "-".repeat(10 - v("sfx")), adj: (d) => A.setVolume("sfx", Math.max(0, Math.min(1, A.vol.sfx + d * 0.1))) },
    { label: "SCREEN SHAKE  " + (ui.opts.shake ? "ON" : "OFF"), adj: () => (ui.opts.shake = !ui.opts.shake), fn: () => (ui.opts.shake = !ui.opts.shake) },
    { label: "SHOW FPS      " + (ui.opts.fps ? "ON" : "OFF"), adj: () => (ui.opts.fps = !ui.opts.fps), fn: () => (ui.opts.fps = !ui.opts.fps) },
    { label: "SAVE GAME", fn: () => (g.save(), g.toast("SAVED")) },
    { label: "QUIT TO TITLE", fn: () => (ui.close(), g.save(), (g.scene = "title")) },
  ];
}

function bagRows(R) {
  const rows = [];
  for (const slot of ["weapon", "armor", "helm", "boots", "ring", "amulet"]) rows.push({ head: slot.toUpperCase(), gear: R.equip[slot], worn: true });
  for (const it of R.bag) rows.push({ gear: it });
  for (const [id, n] of Object.entries(R.items)) rows.push({ label: ((CONSUMABLES[id] ?? MATERIALS[id])?.name ?? id) + " x" + n, use: CONSUMABLES[id] ? id : null, mat: id });
  return rows;
}
function useItem(g, id) {
  const R = g.rpg, h = g.hero, C = CONSUMABLES[id];
  if (!C || !(R.items[id] > 0)) return;
  if (id === "potion" || id === "ether") return R.drinkPotion();
  if (id === "feather") return g.toast("IT WILL BURN WHEN YOU FALL");
  R.take(id);
  g.ui.close();
  if (C.buff) g.status.apply(h, C.buff);
  if (id === "scroll") g.travel("brightwater");
  if (id === "bomb") g.skills.special("smokebomb", {});
  if (id === "flare") g.director.flare(h.x, h.y);
  if (id === "firework") {
    g.fx.spawn("explosions/firework-rocket", h.x + h.face * 20, h.y, { seed: (g.time * 100) | 0 });
    g.quests.onItem("firework");
  }
  g.sfx("drink");
}

const TAB_DRAW = {
  HERO(ui, f, m) {
    const g = ui.g, R = g.rpg, S = R.stats;
    // the hero, big
    const pose = POSE.idle(g.time + (m.t ?? 0), g.hero.weapon);
    drawRig(f, pose, R.costume, 52, 140, { k: 2 });
    text(f, "LEVEL " + R.level, 52, 146, COL.gold, { align: "center" });
    text(f, "XP " + R.xp + "/" + xpFor(R.level), 52, 154, COL.dim, { align: "center" });
    const attrs = [["VIGOR", "vigor", "HEALTH, DEFENSE"], ["MIGHT", "might", "WEAPON DAMAGE"], ["FOCUS", "focus", "SPELLS, MANA"], ["AGILITY", "agility", "CRIT, SPEED"]];
    text(f, "ATTRIBUTES  POINTS " + R.points, 104, 28, R.points ? COL.gold : COL.dim);
    attrs.forEach(([n, k, d], i) => {
      const y = 38 + i * 10, sel = i === m.sel;
      if (sel) fill(f, 100, y - 2, 110, 9, COL.sel, 0.25);
      text(f, n, 104, y, COL.text);
      text(f, String(R.attr[k]), 160, y, COL.gold, { align: "right" });
      text(f, d, 166, y, COL.dim);
    });
    const rows = [["HEALTH", Math.ceil(R.hp) + "/" + S.maxHp], ["MANA", Math.ceil(R.mp) + "/" + S.maxMp], ["ATTACK", S.atk], ["SPELL", S.spell], ["DEFENSE", S.def], ["CRIT", Math.round(S.crit * 100) + "%"], ["SPEED", Math.round(S.aspd * 100) + "%"], ["REGEN", S.regen.toFixed(1) + "/S"]];
    rows.forEach(([a, b], i) => {
      text(f, a, 104 + (i % 2) * 104, 86 + Math.floor(i / 2) * 9, COL.dim);
      text(f, String(b), 200 + (i % 2) * 104, 86 + Math.floor(i / 2) * 9, COL.text, { align: "right" });
    });
    text(f, "SHARDS AND GIFTS", 104, 128, COL.gold);
    Object.entries(SHARDS).forEach(([k, s], i) => {
      const got = R.shards[k];
      text(f, (got ? "* " : "- ") + s.name + (got ? ": " + s.desc : ""), 104, 137 + i * 6, got ? hex(s.pal[5]) : hex("#4a4458"));
    });
    text(f, "SPACE: SPEND A POINT", 104, 166, COL.dim);
  },
  BAG(ui, f, m) {
    const g = ui.g, R = g.rpg, rows = bagRows(R);
    const top = Math.max(0, Math.min(m.sel - 8, rows.length - 17));
    rows.slice(top, top + 17).forEach((r, j) => {
      const i = top + j, y = 26 + j * 8, sel = i === m.sel;
      if (sel) fill(f, 10, y - 1, 170, 7, COL.sel, 0.25);
      if (r.head) text(f, r.head, 12, y, COL.dim);
      const it = r.gear;
      if (it) {
        text(f, it.name.slice(0, 26), r.head ? 50 : 14, y, hex(RARITY[it.rarity].color));
        if (!r.worn) {
          const worn = R.equip[it.slot], d = R.score(it) - R.score(worn);
          if (d > 0.5) text(f, "+", 176, y, COL.green);
          else if (d < -0.5) text(f, "-", 176, y, COL.red);
        }
      } else if (r.head) text(f, "-", 50, y, COL.dim);
      else text(f, r.label, 14, y, r.use ? COL.text : COL.dim);
    });
    const r = rows[m.sel];
    if (r?.gear) ui.itemCard(f, r.gear, 188, 28);
    else if (r?.mat) wrap((CONSUMABLES[r.mat] ?? MATERIALS[r.mat])?.desc ?? "", 115).forEach((ln, i) => text(f, ln, 188, 28 + i * 7, COL.text));
    text(f, r?.gear && !r.worn ? "SPACE: EQUIP   E: SELL" : r?.use ? "SPACE: USE" : "", 188, 156, COL.dim);
    text(f, R.gold + "G", 300, 28, COL.gold, { align: "right" });
  },
  SKILLS(ui, f, m) {
    const g = ui.g, S = g.skills, list = Object.keys(SKILLS), top = Math.max(0, Math.min(m.sel - 8, list.length - 17));
    text(f, "SKILL POINTS " + S.points, 300, 28, S.points ? COL.gold : COL.dim, { align: "right" });
    list.slice(top, top + 17).forEach((id, j) => {
      const i = top + j, s = SKILLS[id], y = 26 + j * 8, sel = i === m.sel, known = S.known.has(id);
      if (sel) fill(f, 10, y - 1, 168, 7, COL.sel, 0.25);
      const c = known ? hex(SCHOOLS[s.school].color) : S.canLearn(id) ? COL.text : hex("#5a5470");
      text(f, s.name, 14, y, c);
      const slot = S.slots.indexOf(id);
      if (slot >= 0) text(f, "[" + (slot + 1) + "]", 176, y, COL.gold, { align: "right" });
      else if (!known) text(f, "LV" + s.lv, 176, y, g.rpg.level >= s.lv ? COL.dim : COL.red, { align: "right" });
    });
    const id = list[m.sel], s = SKILLS[id];
    icon(f, s.school, 188, 28, hex(SCHOOLS[s.school].color), 3);
    text(f, s.name, 212, 28, COL.text, { font: "big" });
    text(f, SCHOOLS[s.school].name.toUpperCase() + " - " + s.type.toUpperCase(), 212, 38, hex(SCHOOLS[s.school].color));
    wrap(s.desc, 112).forEach((ln, i) => text(f, ln, 188, 52 + i * 7, COL.text));
    text(f, "MANA " + s.mp + "   COOLDOWN " + s.cd + "S", 188, 92, COL.dim);
    text(f, "EFFECT: " + s.fx, 188, 100, COL.dim);
    text(f, S.known.has(id) ? "SPACE OR 1-4: EQUIP" : S.canLearn(id) ? "SPACE: LEARN (" + s.cost + " PT)" : "NEEDS LEVEL " + s.lv + " AND " + s.cost + " PT", 188, 150, S.canLearn(id) ? COL.gold : COL.dim);
    // the slots
    for (let i = 0; i < 4; i++) {
      const sid = S.slots[i];
      panel(f, 188 + i * 28, 112, 24, 24, { bg: COL.panel2 });
      if (sid) icon(f, SKILLS[sid].school, 193 + i * 28, 117, hex(SCHOOLS[SKILLS[sid].school].color));
      text(f, String(i + 1), 189 + i * 28, 137, COL.dim);
    }
  },
  QUESTS(ui, f, m) {
    const list = ui.g.quests.list();
    if (!list.length) return text(f, "NO QUESTS YET. TALK TO PEOPLE IN BRIGHTWATER.", 160, 80, COL.dim, { align: "center" });
    list.forEach((r, i) => {
      const y = 26 + i * 8, sel = i === m.sel;
      if (sel) fill(f, 10, y - 1, 150, 7, COL.sel, 0.25);
      const c = r.s.turnedIn ? hex("#5a5470") : r.s.done ? COL.green : r.q.main ? COL.gold : COL.text;
      text(f, (r.s.turnedIn ? "V " : r.s.done ? "! " : "  ") + r.q.name, 12, y, c);
    });
    const r = list[m.sel];
    if (!r) return;
    text(f, r.q.name, 168, 28, COL.gold, { font: "big" });
    wrap(r.q.desc, 138).forEach((ln, i) => text(f, ln, 168, 40 + i * 7, COL.text));
    const giver = PEOPLE[r.q.giver]?.name ?? "";
    text(f, "FROM " + giver, 168, 80, COL.dim);
    if (r.id === "main") text(f, "SHARDS " + Object.keys(ui.g.rpg.shards).length + "/6", 168, 90, COL.gold);
    else if (r.q.need) text(f, "PROGRESS " + r.p + "/" + r.q.need, 168, 90, COL.text);
    text(f, r.s.turnedIn ? "COMPLETE" : r.s.done ? "RETURN TO " + giver : "IN PROGRESS", 168, 100, r.s.done ? COL.green : COL.dim);
    if (r.id === "main") {
      const left = Object.keys(SHARDS).filter((k) => !ui.g.rpg.shards[k]);
      text(f, "WARDENS REMAINING:", 168, 114, COL.dim);
      const where = { warden: "WHISPERING WOODS", mireking: "SUNKEN TEMPLE", colossus: "FROSTPEAK SUMMIT", tyrant: "EMBER CRAGS CALDERA", engine: "STORMSPIRE FOUNDRY", watcher: "HOLLOW CRYPT DEPTHS" };
      left.forEach((k, i) => text(f, where[k], 172, 122 + i * 7, COL.text));
    }
  },
  MAP(ui, f, m) {
    const g = ui.g, w = g.world, D = g.director, EW = Math.ceil(w.W / 4);
    if (!ui.mapImg) {
      ui.mapImg = new Uint32Array(300 * 50);
      for (let y = 0; y < 50; y++)
        for (let x = 0; x < 300; x++) {
          const t = w.tile(x * 4 + 2, y * 4 + 2), wl = w.wall(x * 4 + 2, y * 4 + 2);
          let c = SOLID_T[t] ? hex(["#c8dcf0", "#4a8a4a", "#6aa858", "#62703e", "#5e5250", "#4e6a62"][Math.floor((x * 4) / 200)] ?? "#5a5470") : LIQUID_T[t] ? (t === T.LAVA ? hex("#ff6a2a") : t === T.WATER ? hex("#2a6ac8") : hex("#7ac82a")) : wl ? hex("#2a2638") : hex("#141228");
          if (SOLID_T[t] && y > 18) c = mix(c, hex("#3a3448"), 0.6);
          ui.mapImg[y * 300 + x] = c;
        }
    }
    const X = 10, Y = 32;
    for (let y = 0; y < 50; y++)
      for (let x = 0; x < 300; x++) {
        const seen = D.explored[y * EW + x];
        put(f, X + x, Y + y * 2, seen ? ui.mapImg[y * 300 + x] : hex("#0b0a14"));
        put(f, X + x, Y + y * 2 + 1, seen ? mix(ui.mapImg[y * 300 + x], 0xff000000, 0.15) : hex("#0b0a14"));
      }
    // biome names along the top
    for (const b of BIOMES) text(f, b.name, X + (b.x0 + b.x1) / 8, 24, COL.dim, { align: "center" });
    // waystones, bosses, the hero
    const ways = w.ents.filter((e) => e.kind === "waystone" && g.rpg.flags["way:" + e.id]);
    for (const e of w.ents.filter((e) => e.kind === "waystone")) {
      const on = g.rpg.flags["way:" + e.id], x = X + e.x / 32, y = Y + (e.y / 32) * 2 - 2;
      const sel = on && ways[m.mapSel] === e;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) put(f, x + dx, y + dy, sel ? COL.gold : on ? hex("#c684ff") : hex("#4a4458"));
      if (sel) text(f, e.name, x, y - 9, COL.gold, { align: "center", outline: COL.ink });
    }
    for (const e of w.ents.filter((e) => e.kind === "boss")) {
      if (g.rpg.flags["boss:" + e.id]) continue;
      const seen = D.explored[Math.floor(e.y / 32) * EW + Math.floor(e.x / 32)];
      if (seen) text(f, "X", X + e.x / 32, Y + (e.y / 32) * 2 - 6, COL.red, { align: "center", outline: COL.ink });
    }
    if (Math.floor(g.time * 4 + (m.t ?? 0) * 4) % 2) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(f, X + g.hero.x / 32 + dx, Y + (g.hero.y / 32) * 2 + dy - 2, 0xffffffff);
    text(f, "LEFT/RIGHT: CHOOSE A WAYSTONE   SPACE: TRAVEL", 160, 140, COL.dim, { align: "center" });
    text(f, "WAYSTONES ATTUNED " + ways.length + "/6   EXPLORED " + Math.round((D.explored.reduce((a, b) => a + b, 0) / D.explored.length) * 100) + "%", 160, 150, COL.text, { align: "center" });
  },
  CODEX(ui, f, m) {
    const C = ui.codex, cats = FX_CATEGORIES, cat = cats[C.cat], list = Object.keys(FX).filter((id) => id.startsWith(cat.id + "/"));
    text(f, "< " + cat.name.toUpperCase() + " >  " + (C.cat + 1) + "/" + cats.length, 12, 24, COL.gold);
    text(f, cat.blurb, 12, 32, COL.dim);
    const top = Math.max(0, Math.min(C.sel - 7, list.length - 15));
    list.slice(top, top + 15).forEach((id, j) => {
      const i = top + j, y = 42 + j * 8, sel = i === C.sel;
      if (sel) fill(f, 10, y - 1, 104, 7, COL.sel, 0.25);
      text(f, FX[id].meta.name.slice(0, 24), 12, y, sel ? COL.text : COL.dim);
    });
    const id = list[C.sel], mod = FX[id];
    // a live preview, the act and all if it has one
    if (C.id !== id) {
      C.id = id;
      C.t = 0;
      const acted = !!mod.act;
      const b = acted ? actBounds(mod) : null;
      const [w, h] = acted ? [b.x1 - b.x0, b.y1 - b.y0] : mod.meta.size;
      const [ox, oy] = acted ? [-b.x0, -b.y0] : mod.meta.origin;
      C.frame = createFrame(w, h);
      C.rgba = new Uint8ClampedArray(w * h * 4);
      C.inst = (acted ? createAct : createFx)(mod, { x: ox, y: oy, seed: 3 });
      C.acted = acted;
    }
    C.t += 1 / 60;
    if (C.acted ? C.inst.done() : !mod.meta.loop && C.inst.t >= mod.meta.duration + 0.4) C.id = null;
    else C.inst.update(1 / 60);
    clearFrame(C.frame);
    if (C.acted) C.inst.draw(C.frame);
    else C.inst.draw(C.frame);
    composite(C.frame, C.rgba, hex("#100e1a"));
    const PX = 122, PY = 42, PW = 186, PH = 76, fw = C.frame.w, fh = C.frame.h, k = Math.max(fw / PW, fh / PH, 1);
    fill(f, PX - 1, PY - 1, PW + 2, PH + 2, COL.ink);
    const dw = Math.floor(fw / k), dh = Math.floor(fh / k), dx = PX + ((PW - dw) >> 1), dy = PY + ((PH - dh) >> 1);
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const sx = Math.floor(x * k), sy = Math.floor(y * k), o = (sy * fw + sx) * 4, c = C.rgba;
        put(f, dx + x, dy + y, 0xff000000 | (c[o + 2] << 16) | (c[o + 1] << 8) | c[o]);
      }
    text(f, mod.meta.name, 122, 122, COL.text, { font: "big" });
    text(f, id + "   " + (mod.meta.loop ? "LOOP" : "ONCE") + " " + mod.meta.duration.toFixed(1) + "S" + (mod.act ? "   ACTED" : ""), 122, 132, COL.dim);
    wrap(mod.meta.desc, 186).slice(0, 3).forEach((ln, i) => text(f, ln, 122, 140 + i * 7, COL.text));
    text(f, "IN THE GAME: " + (USES[id] ?? "-"), 122, 162, COL.gold);
  },
  OPTIONS(ui, f, m) {
    optionRows(ui).forEach((r, i) => {
      const y = 34 + i * 12, sel = i === m.sel;
      if (sel) fill(f, 40, y - 2, 240, 10, COL.sel, 0.25);
      text(f, r.label, 48, y, sel ? COL.text : COL.dim);
    });
    text(f, "CONTROLS: MOVE A/D  JUMP SPACE  ATTACK J  DASH SHIFT", 160, 128, COL.dim, { align: "center" });
    text(f, "SKILLS 1-4  USE E  POTION Q  BAG TAB  MAP M", 160, 136, COL.dim, { align: "center" });
    text(f, "BLINK: HOLD UP AND DASH (RIME SHARD)", 160, 144, COL.dim, { align: "center" });
  },
};
export { TABS };
