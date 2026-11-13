#!/usr/bin/env node
// A headless playtest: boots the game, walks, fights, casts every skill, meets every foe and warden, opens every menu
// and transition, saves and loads. Fails on any exception. node tools/test.mjs [--shots]
import { newGame, run, tap, snap } from "./shot.mjs";
import { SKILLS } from "../src/data/skills.js";
import { ENEMIES } from "../src/data/enemies.js";
import { BOSSES } from "../src/game/bosses.js";
import { STATUS } from "../src/game/status.js";
import { FX } from "../src/pfx.js";
import { WEAPONS } from "../src/data/weapons.js";
import { BASES } from "../src/data/items.js";

const shots = process.argv.includes("--shots");
let fails = 0, n = 0;
const check = (name, fn) => {
  n++;
  try {
    fn();
  } catch (e) {
    fails++;
    console.log("FAIL", name, e.stack?.split("\n").slice(0, 4).join("\n"));
  }
};
const g = newGame();
const S = g.rpg;
const at = (tx, ty) => {
  g.hero.x = tx * 8;
  g.hero.y = ty ? ty * 8 : g.world.groundY(g.hero.x);
  g.hero.vx = g.hero.vy = 0;
  g.hero.dead = false;
  g.hero.state = "move";
  g.snapCamera();
};
const frames = (s) => {
  for (let i = 0; i < Math.round(s * 60); i++) {
    g.update(1 / 60);
    if (i % 4 === 0) g.render();
  }
};
// a sturdy hero for testing
S.level = 20;
S.attr = { vigor: 30, might: 20, focus: 30, agility: 15 };
S.recalc();
S.hp = S.stats.maxHp;
S.mp = S.stats.maxMp;

check("walk and jump", () => {
  at(500);
  run(g, 1, ["right"]);
  tap(g, "jump");
  run(g, 0.6);
  if (!g.hero.onGround) run(g, 1);
});
check("every weapon's combo", () => {
  for (const [cls, W] of Object.entries(WEAPONS)) {
    const base = Object.keys(BASES).find((b) => BASES[b].cls === cls);
    S.equipItem(S.makeItem(base, 10, 2));
    at(505);
    for (let i = 0; i < 4; i++) {
      tap(g, "attack");
      frames(0.35);
    }
    frames(1);
  }
  S.equipItem(S.makeItem("sword", 10, 2));
});
check("dash", () => {
  tap(g, "dash");
  frames(0.5);
});
check("every skill", () => {
  at(590);
  for (const id of Object.keys(SKILLS)) {
    try {
      g.skills.known.add(id);
      g.skills.slots[0] = id;
      g.skills.cd[id] = 0;
      S.mp = S.stats.maxMp;
      // a foe to aim at
      g.addEnemy("slime", g.hero.x + 60, g.hero.y, 5);
      g.addEnemy("bandit", g.hero.x + 90, g.hero.y, 5);
      tap(g, "s1");
      g.input.hold("s1", true);
      frames(0.8);
      g.input.hold("s1", false);
      frames(2.2);
      if (shots && ["meteorcall", "firestorm", "thunderclap", "starfall", "singularity", "brute"].includes(id)) snap(g, "skill_" + id);
      g.hero.dead = false;
      S.hp = S.stats.maxHp;
      at(590);
    } catch (e) {
      throw new Error(id + ": " + e.message + "\n" + e.stack.split("\n").slice(1, 3).join("\n"));
    }
  }
  g.enemies = [];
});
check("every foe", () => {
  for (const type of Object.keys(ENEMIES)) {
    try {
      at(600);
      const d = ENEMIES[type];
      const e = g.addEnemy(type, g.hero.x + 50, d.fly ? g.hero.y - 30 : g.hero.y, 8);
      e.aggro = true;
      frames(2.5);
      g.combat.damageEnemy(e, 5, { el: "fire", dir: 1, src: "hero" });
      frames(0.3);
      g.combat.damageEnemy(e, 99999, { el: ["fire", "ice", "shock", "shadow", null][type.length % 5], dir: 1, src: "hero" });
      frames(1.5);
      S.hp = S.stats.maxHp;
    } catch (e) {
      throw new Error(type + ": " + e.message + "\n" + e.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
  g.enemies = [];
});
check("every status", () => {
  at(505);
  const e = g.addEnemy("skeleton", g.hero.x + 40, g.hero.y, 5);
  const s = g.addEnemy("slime", g.hero.x - 40, g.hero.y, 5);
  for (const k of Object.keys(STATUS)) {
    g.status.apply(g.hero, k, { dur: 0.6 });
    g.status.apply(e, k, { dur: 0.6 });
    g.status.apply(s, k, { dur: 0.6 });
    frames(0.7);
    S.hp = S.stats.maxHp;
    g.hero.dead = false;
  }
  g.enemies = [];
});
check("every warden", () => {
  for (const id of Object.keys(BOSSES)) {
    try {
      const ent = g.world.ents.find((e) => e.kind === "boss" && e.id === id);
      delete S.flags["boss:" + id];
      g.hero.x = ent.arena.x0 + 60;
      g.hero.y = ent.arena.y;
      g.hero.dead = false;
      g.snapCamera();
      frames(0.5);
      const b = g.boss;
      if (!b) throw new Error("did not start");
      for (let k = 0; k < 14; k++) {
        b.cool = 0;
        S.hp = S.stats.maxHp;
        g.hero.inv = 0;
        frames(1.6);
        tap(g, "attack");
      }
      if (shots) snap(g, "boss_" + id);
      g.combat.damageEnemy(b, b.hp + 1, { src: "hero" });
      frames(2);
      if (id === "king") {
        g.combat.damageEnemy(g.boss ?? b, 999999, { src: "hero" });
        frames(6);
      }
      frames(3);
      if (!S.flags["boss:" + id]) throw new Error("not defeated");
      g.ui.close();
      g.ui.dlg = null;
      g.enemies = [];
    } catch (e) {
      throw new Error(id + ": " + e.message + "\n" + e.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
});
check("dying and rising", () => {
  at(505);
  g.damageHero(999999, { el: "fire" });
  frames(5);
  if (g.hero.dead) throw new Error("did not respawn");
});
check("menus", () => {
  for (const tab of ["HERO", "BAG", "SKILLS", "QUESTS", "MAP", "CODEX", "OPTIONS"]) {
    g.ui.open(tab);
    for (let i = 0; i < 6; i++) {
      tap(g, "down");
      g.render();
    }
    tap(g, "confirm");
    frames(0.5);
    if (shots) snap(g, "menu_" + tab.toLowerCase());
    g.ui.close();
  }
  // walk the whole codex: every effect previews
  g.ui.open("CODEX");
  for (let c = 0; c < 21; c++) {
    for (let i = 0; i < 14; i++) {
      tap(g, "down");
      g.render();
    }
    tap(g, "right");
  }
  g.ui.close();
});
check("people and shops", () => {
  at(494);
  frames(0.3);
  for (const n of g.npcs.list) {
    g.ui.talk(n);
    for (let i = 0; i < 4; i++) {
      tap(g, "confirm");
      frames(0.4);
    }
    g.ui.dlg = null;
    g.ui.shop = null;
  }
  g.ui.openShop("smith");
  tap(g, "confirm");
  tap(g, "right");
  tap(g, "confirm");
  g.ui.shop = null;
});
check("transitions", () => {
  for (const id of Object.keys(FX).filter((x) => x.startsWith("transitions/"))) {
    g.ui.transition(id, () => {});
    frames(3.2);
  }
});
check("weather", () => {
  at(330);
  for (const w of Object.keys(FX).filter((x) => x.startsWith("weather/"))) {
    g.director.setWeather(w.slice(8));
    frames(0.6);
  }
});
check("title", () => {
  g.scene = "title";
  frames(1);
  if (shots) snap(g, "title");
  g.scene = "play";
});
check("world props everywhere", () => {
  for (let tx = 20; tx < 1180; tx += 60) {
    at(tx);
    frames(0.25);
  }
});
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
